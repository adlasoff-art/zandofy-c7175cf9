import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

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

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch cart from DB
  const fetchCart = useCallback(async () => {
    if (!user) { setItems([]); return; }
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

  useEffect(() => { fetchCart(); }, [fetchCart]);

  const addItem = async (item: Omit<CartItem, "id" | "selected">) => {
    if (!user) {
      toast({ title: "Connexion requise", description: "Connectez-vous pour ajouter au panier.", variant: "destructive" });
      return;
    }

    // Use upsert with ON CONFLICT to handle duplicates at DB level
    const { data: existing } = await supabase
      .from("cart_items")
      .select("id, quantity")
      .eq("user_id", user.id)
      .eq("product_id", item.productId)
      .eq("color", item.color || "")
      .eq("size", item.size || "")
      .maybeSingle();

    if (existing) {
      // Increment quantity on existing item
      const newQty = existing.quantity + item.quantity;
      await supabase.from("cart_items").update({ quantity: newQty }).eq("id", existing.id);
    } else {
      const { error } = await supabase.from("cart_items").insert({
        user_id: user.id,
        product_id: item.productId,
        color: item.color,
        size: item.size,
        quantity: item.quantity,
      });
      if (error) {
        // If unique constraint violation, try to increment instead
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
            await supabase.from("cart_items").update({ quantity: dup.quantity + item.quantity }).eq("id", dup.id);
          }
        } else {
          toast({ title: "Erreur", description: error.message, variant: "destructive" });
          return;
        }
      }
    }

    await fetchCart();
    setDrawerOpen(true);
    toast({ title: "Ajouté au panier !" });
  };

  const updateQuantity = async (id: string, quantity: number) => {
    if (quantity < 1) return removeItem(id);
    const { error } = await supabase.from("cart_items").update({ quantity }).eq("id", id);
    if (!error) {
      setItems(prev => prev.map(i => i.id === id ? { ...i, quantity } : i));
    }
  };

  const removeItem = async (id: string) => {
    const { error } = await supabase.from("cart_items").delete().eq("id", id);
    if (!error) {
      setItems(prev => prev.filter(i => i.id !== id));
    }
  };

  const clearCart = async () => {
    if (!user) return;
    await supabase.from("cart_items").delete().eq("user_id", user.id);
    setItems([]);
  };

  const toggleSelected = async (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const newVal = !item.selected;
    const { error } = await supabase.from("cart_items").update({ selected: newVal } as any).eq("id", id);
    if (!error) {
      setItems(prev => prev.map(i => i.id === id ? { ...i, selected: newVal } : i));
    }
  };

  const selectAll = async () => {
    if (!user) return;
    await supabase.from("cart_items").update({ selected: true } as any).eq("user_id", user.id);
    setItems(prev => prev.map(i => ({ ...i, selected: true })));
  };

  const deselectAll = async () => {
    if (!user) return;
    await supabase.from("cart_items").update({ selected: false } as any).eq("user_id", user.id);
    setItems(prev => prev.map(i => ({ ...i, selected: false })));
  };

  const removeSelectedItems = async () => {
    if (!user) return;
    const selectedIds = items.filter(i => i.selected).map(i => i.id);
    if (selectedIds.length === 0) return;
    await supabase.from("cart_items").delete().in("id", selectedIds);
    setItems(prev => prev.filter(i => !i.selected));
  };

  const selectedItems = items.filter(i => i.selected);
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const selectedCount = selectedItems.reduce((s, i) => s + i.quantity, 0);
  const selectedSubtotal = selectedItems.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{
      items, selectedItems, loading, drawerOpen, setDrawerOpen,
      addItem, updateQuantity, removeItem, clearCart,
      toggleSelected, selectAll, deselectAll, removeSelectedItems,
      itemCount, subtotal, selectedCount, selectedSubtotal,
    }}>
      {children}
    </CartContext.Provider>
  );
}
