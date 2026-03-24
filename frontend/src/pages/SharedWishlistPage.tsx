import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";
import { Heart, Gift, Share2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Product } from "@/services/api";

function mapProduct(row: any): Product {
  return {
    id: row.id,
    name: row.name,
    nameFr: row.name_fr,
    price: Number(row.price),
    originalPrice: row.original_price ? Number(row.original_price) : undefined,
    currency: row.currency,
    image: row.product_images?.[0]?.image_url || "/placeholder.svg",
    category: row.categories?.name || "",
    categoryFr: row.categories?.name_fr || "",
    rating: Number(row.rating) || 0,
    reviewCount: row.review_count || 0,
    isNew: row.is_new || false,
    isSale: row.is_sale || false,
    discount: row.discount || 0,
    colors: row.product_colors?.map((c: any) => c.color_hex) || [],
    sizes: row.product_sizes?.map((s: any) => s.size_label) || [],
    moq: row.moq || 1,
    verifiedYears: row.verified_years || 0,
    originCountry: row.origin_country || "",
    storeId: row.store_id || "",
  };
}

export default function SharedWishlistPage() {
  const { userId } = useParams<{ userId: string }>();

  const { data: profile } = useQuery({
    queryKey: ["shared-wishlist-profile", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from("profiles")
        .select("first_name, last_name, avatar_url")
        .eq("id", userId)
        .single();
      return data;
    },
    enabled: !!userId,
  });

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["shared-wishlist-products", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("wishlists")
        .select(`
          product_id,
          products:product_id (
            *,
            categories(name, name_fr),
            product_images(image_url, position),
            product_colors(color_hex, color_name),
            product_sizes(size_label)
          )
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((r: any) => r.products).filter(Boolean).map(mapProduct);
    },
    enabled: !!userId,
  });

  const ownerName = profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Un utilisateur" : "...";

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Lien copié !");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Gift size={24} className="text-primary" />
              Liste de souhaits de {ownerName}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {products.length} article{products.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={copyLink} className="flex items-center gap-2">
            <Copy size={14} /> Copier le lien
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <Heart size={48} className="mx-auto text-muted-foreground/30 mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">Liste vide</h2>
            <p className="text-muted-foreground mb-6">Cette liste de souhaits ne contient aucun article.</p>
            <Button asChild><Link to="/">Découvrir les produits</Link></Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {products.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
