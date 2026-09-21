import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { MobileBackButton } from "@/components/navigation/MobileBackButton";
import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";
import { SEOHead } from "@/components/SEOHead";
import { Heart, Share2 } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/contexts/I18nContext";
import { toast } from "sonner";
import { mapProduct } from "@/services/api";
import { PRODUCT_GRID_CLASS } from "@/lib/product-image-fit";

export default function WishlistPage() {
  const { user } = useAuth();
  const { wishlistIds, isLoading: wishlistLoading } = useWishlist();
  const { t } = useI18n();
  const guestIdList = [...wishlistIds];

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["wishlist-products", user?.id ?? "guest", guestIdList.join(",")],
    queryFn: async () => {
      if (user) {
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
          .map(mapProduct);
      }

      if (guestIdList.length === 0) return [];
      const { data, error } = await supabase
        .from("products_public")
        .select("*")
        .in("id", guestIdList)
        .eq("publish_status", "published");
      if (error) throw error;
      const byId = new Map((data || []).map((row: any) => [row.id, mapProduct(row)]));
      // Preserve guest list order
      return guestIdList.map((id) => byId.get(id)).filter(Boolean);
    },
    enabled: !!user || guestIdList.length >= 0,
  });

  const loading = user ? isLoading || wishlistLoading : isLoading;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={t("wishlist.title") || "Mes Favoris"}
        description="Liste de favoris personnelle — page privée non indexée."
        canonical="/wishlist"
        noindex
      />
      <Header />
      <div className="lg:hidden sticky top-14 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-1">
        <MobileBackButton fallbackTo="/" />
      </div>
      <main className="container py-6 pb-24 lg:pb-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Heart size={24} className="text-sale" />
            {t("wishlist.title")}
            {products.length > 0 && (
              <span className="text-base font-normal text-muted-foreground">({products.length})</span>
            )}
          </h1>
          {user && products.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const url = `${window.location.origin}/wishlist/shared/${user.id}`;
                navigator.clipboard.writeText(url);
                toast.success(t("wishlist.shareCopied") || "Lien de partage copié !");
              }}
              className="flex items-center gap-2"
            >
              <Share2 size={14} /> {t("wishlist.share") || "Partager"}
            </Button>
          )}
        </div>

        {loading ? (
          <div className={PRODUCT_GRID_CLASS}>
            {Array.from({ length: 8 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center min-h-[50vh] px-4">
            <Heart size={48} className="text-muted-foreground/30 mb-4" />
            <h2 className="text-lg font-semibold text-foreground mb-2">{t("wishlist.empty")}</h2>
            <p className="text-muted-foreground mb-6">{t("wishlist.emptySub")}</p>
            <Button asChild className="min-h-[44px] px-6">
              <Link to="/">{t("wishlist.discover")}</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className={PRODUCT_GRID_CLASS}>
              {products.map((p: any) => (
                <Link key={p.id} to={`/product/${p.slug || p.id}`} className="cursor-pointer">
                  <ProductCard product={p} />
                </Link>
              ))}
            </div>
            {!user && (
              <div className="mt-8 text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  {t("wishlist.syncHint") ||
                    "Connectez-vous pour synchroniser vos favoris sur tous vos appareils."}
                </p>
                <Button asChild variant="outline" className="min-h-[44px]">
                  <Link to="/auth?redirect=%2Fwishlist">{t("general.loginButton")}</Link>
                </Button>
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
