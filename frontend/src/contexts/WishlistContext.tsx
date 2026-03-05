import { createContext, useContext, useCallback, useEffect, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface WishlistContextType {
  wishlistIds: Set<string>;
  count: number;
  isInWishlist: (productId: string) => boolean;
  toggleWishlist: (productId: string) => void;
  isLoading: boolean;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: wishlistItems = [], isLoading } = useQuery({
    queryKey: ["wishlist", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("wishlists")
        .select("product_id")
        .eq("user_id", user.id);
      if (error) throw error;
      return data.map((r) => r.product_id);
    },
    enabled: !!user,
  });

  const wishlistIds = new Set(wishlistItems);

  const addMutation = useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase
        .from("wishlists")
        .insert({ user_id: user!.id, product_id: productId });
      if (error) throw error;
    },
    onMutate: async (productId) => {
      await queryClient.cancelQueries({ queryKey: ["wishlist", user?.id] });
      const prev = queryClient.getQueryData<string[]>(["wishlist", user?.id]) || [];
      queryClient.setQueryData(["wishlist", user?.id], [...prev, productId]);
      return { prev };
    },
    onError: (_err, _productId, context) => {
      queryClient.setQueryData(["wishlist", user?.id], context?.prev);
      toast({ title: "Erreur", description: "Impossible d'ajouter aux favoris", variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["wishlist", user?.id] }),
  });

  const removeMutation = useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase
        .from("wishlists")
        .delete()
        .eq("user_id", user!.id)
        .eq("product_id", productId);
      if (error) throw error;
    },
    onMutate: async (productId) => {
      await queryClient.cancelQueries({ queryKey: ["wishlist", user?.id] });
      const prev = queryClient.getQueryData<string[]>(["wishlist", user?.id]) || [];
      queryClient.setQueryData(["wishlist", user?.id], prev.filter((id) => id !== productId));
      return { prev };
    },
    onError: (_err, _productId, context) => {
      queryClient.setQueryData(["wishlist", user?.id], context?.prev);
      toast({ title: "Erreur", description: "Impossible de retirer des favoris", variant: "destructive" });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["wishlist", user?.id] }),
  });

  const isInWishlist = useCallback((productId: string) => wishlistIds.has(productId), [wishlistIds]);

  const toggleWishlist = useCallback(
    (productId: string) => {
      if (!user) {
        toast({ title: "Connexion requise", description: "Veuillez vous connecter pour enregistrer vos favoris" });
        return;
      }
      if (wishlistIds.has(productId)) {
        removeMutation.mutate(productId);
      } else {
        addMutation.mutate(productId);
      }
    },
    [user, wishlistIds, addMutation, removeMutation, toast]
  );

  return (
    <WishlistContext.Provider value={{ wishlistIds, count: wishlistIds.size, isInWishlist, toggleWishlist, isLoading }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
}
