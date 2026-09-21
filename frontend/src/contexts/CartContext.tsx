import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { requestAddressOnboarding } from "@/lib/address-onboarding-bus";
import {
  clearGuestCart,
  readGuestCart,
  upsertGuestCartItem,
  writeGuestCart,
  isLikelyProductId,
  guestCartLineId,
  type GuestCartItem,
} from "@/lib/guest-cart";

export interface CartItem {
  id: string;
  productId: string;
  name: string;
  nameFr: string;
  image: string;
  price: number;
  originalPrice?: number;
  color: string | null;
  size: string | null;
  quantity: number;
  moq: number;
  selected: boolean;
}

interface CartContextType {
  items: CartItem[];
  selectedItems: CartItem[];
  loading: boolean;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  addItem: (item: Omit<CartItem, "id" | "selected">) => Promise<void>;
  updateVariant: (id: string, color: string | null, size: string | null) => Promise<void>;
  updateQuantity: (id: string, quantity: number) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  clearCart: () => Promise<void>;
  toggleSelected: (id: string) => Promise<void>;
  selectAll: () => Promise<void>;
  deselectAll: () => Promise<void>;
  removeSelectedItems: () => Promise<void>;
  itemCount: number;
  subtotal: number;
  selectedCount: number;
  selectedSubtotal: number;
}

const CartContext = createContext<CartContextType>({
  items: [],
  selectedItems: [],
  loading: false,
  drawerOpen: false,
  setDrawerOpen: () => {},
  addItem: async () => {},
  updateVariant: async () => {},
  updateQuantity: async () => {},
  removeItem: async () => {},
  clearCart: async () => {},
  toggleSelected: async () => {},
  selectAll: async () => {},
  deselectAll: async () => {},
  removeSelectedItems: async () => {},
  itemCount: 0,
  subtotal: 0,
  selectedCount: 0,
  selectedSubtotal: 0,
});

export const useCart = () => useContext(CartContext);

function guestToCart(items: GuestCartItem[]): CartItem[] {
  return items.map((i) => ({ ...i }));
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const mergeDoneForUser = useRef<string | null>(null);

  const fetchDbCart = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("cart_items")
      .select(`
        id, product_id, color, size, quantity, selected,
        products(name, name_fr, price, original_price, moq,
          product_images(image_url, position)
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Cart fetch error:", error);
      setLoading(false);
      return;
    }

    setItems((data || []).map((row: any) => ({
      id: row.id,
      productId: row.product_id,
      name: row.products?.name || "",
      nameFr: row.products?.name_fr || "",
      image: row.products?.product_images?.[0]?.image_url || "/placeholder.svg",
      price: Number(row.products?.price || 0),
      originalPrice: row.products?.original_price ? Number(row.products.original_price) : undefined,
      color: row.color,
      size: row.size,
      quantity: row.quantity,
      moq: row.products?.moq || 1,
      selected: row.selected ?? true,
    })));
    setLoading(false);
  }, [user]);

  const mergeGuestIntoDb = useCallback(async () => {
    if (!user) return;
    const guest = readGuestCart();
    if (guest.length === 0) return;

    const remaining: GuestCartItem[] = [];
    for (const g of guest) {
      if (!isLikelyProductId(g.productId) || g.quantity < 1) continue;
      const qty = Math.min(Math.floor(g.quantity), 999);
      try {
        const { data: existing } = await supabase
          .from("cart_items")
          .select("id, quantity")
          .eq("user_id", user.id)
          .eq("product_id", g.productId)
          .eq("color", g.color || "")
          .eq("size", g.size || "")
          .maybeSingle();

        if (existing) {
          const { error } = await supabase
            .from("cart_items")
            .update({ quantity: Math.min(existing.quantity + qty, 999) })
            .eq("id", existing.id);
          if (error) remaining.push(g);
        } else {
          const { error } = await supabase.from("cart_items").insert({
            user_id: user.id,
            product_id: g.productId,
            color: g.color,
            size: g.size,
            quantity: qty,
            selected: g.selected,
          } as any);
          if (error && error.code !== "23505") {
            console.warn("[Cart] guest merge skip", g.productId, error.message);
            remaining.push(g);
          }
        }
      } catch {
        remaining.push(g);
      }
    }
    if (remaining.length === 0) clearGuestCart();
    else writeGuestCart(remaining);
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) {
        mergeDoneForUser.current = null;
        setItems(guestToCart(readGuestCart()));
        setLoading(false);
        return;
      }
      // Block checkout until merge + server prices are loaded (avoid guest client prices)
      setLoading(true);
      if (mergeDoneForUser.current !== user.id) {
        mergeDoneForUser.current = user.id;
        await mergeGuestIntoDb();
      }
      if (!cancelled) await fetchDbCart();
      else setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, fetchDbCart, mergeGuestIntoDb]);

  const addItem = async (item: Omit<CartItem, "id" | "selected">) => {
    if (!user) {
      if (!isLikelyProductId(item.productId)) {
        toast({ title: "Erreur", description: "Produit invalide.", variant: "destructive" });
        return;
      }
      const safe = { ...item, quantity: Math.min(Math.max(1, Math.floor(item.quantity)), 999) };
      const current = readGuestCart();
      const { items: next, finalQty, wasExisting } = upsertGuestCartItem(current, safe);
      writeGuestCart(next);
      setItems(guestToCart(next));
      setDrawerOpen(true);
      toast({
        title: wasExisting
          ? `Panier mis à jour — ${finalQty} pièces au total`
          : `Ajouté au panier — ${finalQty} pièce${finalQty > 1 ? "s" : ""}`,
      });
      return;
    }

    const { data: existing } = await supabase
      .from("cart_items")
      .select("id, quantity")
      .eq("user_id", user.id)
      .eq("product_id", item.productId)
      .eq("color", item.color || "")
      .eq("size", item.size || "")
      .maybeSingle();

    let finalQty = item.quantity;
    let wasExisting = false;

    if (existing) {
      const newQty = existing.quantity + item.quantity;
      await supabase.from("cart_items").update({ quantity: newQty }).eq("id", existing.id);
      finalQty = newQty;
      wasExisting = true;
    } else {
      const { error } = await supabase.from("cart_items").insert({
        user_id: user.id,
        product_id: item.productId,
        color: item.color,
        size: item.size,
        quantity: item.quantity,
      });
      if (error) {
        if (error.code === "23505") {
          const { data: dup } = await supabase
            .from("cart_items")
            .select("id, quantity")
            .eq("user_id", user.id)
            .eq("product_id", item.productId)
            .eq("color", item.color || "")
            .eq("size", item.size || "")
            .maybeSingle();
          if (dup) {
            const merged = dup.quantity + item.quantity;
            await supabase.from("cart_items").update({ quantity: merged }).eq("id", dup.id);
            finalQty = merged;
            wasExisting = true;
          }
        } else {
          toast({ title: "Erreur", description: error.message, variant: "destructive" });
          return;
        }
      }
    }

    await fetchDbCart();
    setDrawerOpen(true);
    requestAddressOnboarding();
    toast({
      title: wasExisting
        ? `Panier mis à jour — ${finalQty} pièces au total`
        : `Ajouté au panier — ${finalQty} pièce${finalQty > 1 ? "s" : ""}`,
    });
  };

  const updateVariant = async (id: string, color: string | null, size: string | null) => {
    if (!user) {
      const current = readGuestCart();
      const next = current.map((i) =>
        i.id === id
          ? { ...i, color, size, id: guestCartLineId(i.productId, color, size) }
          : i,
      );
      writeGuestCart(next);
      setItems(guestToCart(next));
      return;
    }
    const { error } = await supabase.from("cart_items").update({ color, size }).eq("id", id);
    if (!error) await fetchDbCart();
  };

  const updateQuantity = async (id: string, quantity: number) => {
    if (quantity < 1) return removeItem(id);
    const safeQty = Math.min(Math.floor(quantity), 999);
    if (!user) {
      const next = readGuestCart().map((i) => (i.id === id ? { ...i, quantity: safeQty } : i));
      writeGuestCart(next);
      setItems(guestToCart(next));
      return;
    }
    const { error } = await supabase.from("cart_items").update({ quantity: safeQty }).eq("id", id);
    if (!error) setItems((prev) => prev.map((i) => (i.id === id ? { ...i, quantity: safeQty } : i)));
  };

  const removeItem = async (id: string) => {
    if (!user) {
      const next = readGuestCart().filter((i) => i.id !== id);
      writeGuestCart(next);
      setItems(guestToCart(next));
      return;
    }
    const { error } = await supabase.from("cart_items").delete().eq("id", id);
    if (!error) setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const clearCart = async () => {
    if (!user) {
      clearGuestCart();
      setItems([]);
      return;
    }
    await supabase.from("cart_items").delete().eq("user_id", user.id);
    setItems([]);
  };

  const toggleSelected = async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const newVal = !item.selected;
    if (!user) {
      const next = readGuestCart().map((i) => (i.id === id ? { ...i, selected: newVal } : i));
      writeGuestCart(next);
      setItems(guestToCart(next));
      return;
    }
    const { error } = await supabase.from("cart_items").update({ selected: newVal } as any).eq("id", id);
    if (!error) setItems((prev) => prev.map((i) => (i.id === id ? { ...i, selected: newVal } : i)));
  };

  const selectAll = async () => {
    if (!user) {
      const next = readGuestCart().map((i) => ({ ...i, selected: true }));
      writeGuestCart(next);
      setItems(guestToCart(next));
      return;
    }
    await supabase.from("cart_items").update({ selected: true } as any).eq("user_id", user.id);
    setItems((prev) => prev.map((i) => ({ ...i, selected: true })));
  };

  const deselectAll = async () => {
    if (!user) {
      const next = readGuestCart().map((i) => ({ ...i, selected: false }));
      writeGuestCart(next);
      setItems(guestToCart(next));
      return;
    }
    await supabase.from("cart_items").update({ selected: false } as any).eq("user_id", user.id);
    setItems((prev) => prev.map((i) => ({ ...i, selected: false })));
  };

  const removeSelectedItems = async () => {
    if (!user) {
      const next = readGuestCart().filter((i) => !i.selected);
      writeGuestCart(next);
      setItems(guestToCart(next));
      return;
    }
    const selectedIds = items.filter((i) => i.selected).map((i) => i.id);
    if (selectedIds.length === 0) return;
    await supabase.from("cart_items").delete().in("id", selectedIds);
    setItems((prev) => prev.filter((i) => !i.selected));
  };

  const selectedItems = items.filter((i) => i.selected);
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const selectedCount = selectedItems.reduce((s, i) => s + i.quantity, 0);
  const selectedSubtotal = selectedItems.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        selectedItems,
        loading,
        drawerOpen,
        setDrawerOpen,
        addItem,
        updateVariant,
        updateQuantity,
        removeItem,
        clearCart,
        toggleSelected,
        selectAll,
        deselectAll,
        removeSelectedItems,
        itemCount,
        subtotal,
        selectedCount,
        selectedSubtotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
