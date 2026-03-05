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
}

interface CartContextType {
  items: CartItem[];
  loading: boolean;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  addItem: (item: Omit<CartItem, "id">) => Promise<void>;
  updateQuantity: (id: string, quantity: number) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  clearCart: () => Promise<void>;
  itemCount: number;
  subtotal: number;
}

const CartContext = createContext<CartContextType>({
  items: [],
  loading: false,
  drawerOpen: false,
  setDrawerOpen: () => {},
  addItem: async () => {},
  updateQuantity: async () => {},
  removeItem: async () => {},
  clearCart: async () => {},
  itemCount: 0,
  subtotal: 0,
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
        id, product_id, color, size, quantity,
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
    })));
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchCart(); }, [fetchCart]);

  const addItem = async (item: Omit<CartItem, "id">) => {
    if (!user) {
      toast({ title: "Connexion requise", description: "Connectez-vous pour ajouter au panier.", variant: "destructive" });
      return;
    }

    // Check if same product+color+size already exists
    const existing = items.find(
      i => i.productId === item.productId && i.color === item.color && i.size === item.size
    );

    if (existing) {
      await updateQuantity(existing.id, existing.quantity + item.quantity);
    } else {
      const { error } = await supabase.from("cart_items").insert({
        user_id: user.id,
        product_id: item.productId,
        color: item.color,
        size: item.size,
        quantity: item.quantity,
      });
      if (error) {
        toast({ title: "Erreur", description: error.message, variant: "destructive" });
        return;
      }
      await fetchCart();
    }
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

  const itemCount = items.reduce((s, i) => s + i.quantity, 0);
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, loading, drawerOpen, setDrawerOpen, addItem, updateQuantity, removeItem, clearCart, itemCount, subtotal }}>
      {children}
    </CartContext.Provider>
  );
}
