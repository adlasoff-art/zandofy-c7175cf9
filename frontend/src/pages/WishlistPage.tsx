import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";
import { Heart, Share2, Copy } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/contexts/I18nContext";
import { toast } from "sonner";
import type { Product } from "@/services/api";

function mapWishlistProduct(row: any): Product {
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

export default function WishlistPage() {
  const { user } = useAuth();
  const { t } = useI18n();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["wishlist-products", user?.id],
    queryFn: async () => {
      if (!user) return [];
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
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || [])
        .map((r: any) => r.products)
        .filter(Boolean)
        .map(mapWishlistProduct);
    },
    enabled: !!user,
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-6">
        <h1 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
          <Heart size={24} className="text-sale" />
          {t("wishlist.title")}
          {products.length > 0 && (
            <span className="text-base font-normal text-muted-foreground">({products.length})</span>
          )}
        </h1>

        {!user ? (
          <div className="text-center py-20">
            <Heart size={48} className="mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground mb-4">{t("wishlist.loginRequired")}</p>
            <Button asChild><Link to="/auth">{t("general.loginButton")}</Link></Button>
          </div>
        ) : isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <Heart size={48} className="mx-auto text-muted-foreground/30 mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">{t("wishlist.empty")}</h2>
            <p className="text-muted-foreground mb-6">{t("wishlist.emptySub")}</p>
            <Button asChild><Link to="/">{t("wishlist.discover")}</Link></Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
