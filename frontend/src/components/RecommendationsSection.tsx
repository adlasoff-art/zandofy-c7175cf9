import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { Sparkles, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { imgUrl } from "@/lib/image-url";
import { fetchRecentlyViewedProductIds } from "@/lib/user-product-views";

interface RecommendedProduct {
  id: string;
  slug?: string | null;
  name: string;
  nameFr?: string | null;
  price: number;
  image: string;
  rating?: number;
}

export function RecommendationsSection() {
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const [products, setProducts] = useState<RecommendedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        let userGender: string | null = null;

        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("gender, date_of_birth")
            .eq("id", user.id)
            .maybeSingle();

          if (profile) {
            userGender = (profile as any).gender || null;
          }
        }

        const { data: allProducts } = await supabase
          .from("products")
          .select("id, slug, name, name_fr, price, rating, product_images(image_url, position), gender_target")
          .eq("publish_status", "published")
          .order("rating", { ascending: false })
          .limit(60);
        const products_list = (allProducts || []) as any[];

        let topRow: any[];

        if (userGender === "female" || userGender === "femme") {
          const female = products_list.filter(p => p.gender_target === "female" || p.gender_target === "femme");
          const unisex = products_list.filter(p => p.gender_target === "unisex" && !female.includes(p));
          topRow = [...female, ...unisex].slice(0, 4);
        } else if (userGender === "male" || userGender === "homme") {
          const male = products_list.filter(p => p.gender_target === "male" || p.gender_target === "homme");
          const unisex = products_list.filter(p => p.gender_target === "unisex" && !male.includes(p));
          topRow = [...male, ...unisex].slice(0, 4);
        } else {
          const female = products_list.filter(p => p.gender_target === "female" || p.gender_target === "femme");
          const male = products_list.filter(p => p.gender_target === "male" || p.gender_target === "homme");
          const unisex = products_list.filter(p => !["female", "femme", "male", "homme"].includes(p.gender_target || ""));
          topRow = [
            ...female.slice(0, 2),
            ...male.slice(0, 1),
            ...unisex.slice(0, 1),
          ].slice(0, 4);
        }

        if (topRow.length < 4) {
          const existingIds = new Set(topRow.map(p => p.id));
          const remaining = products_list.filter(p => !existingIds.has(p.id));
          topRow = [...topRow, ...remaining].slice(0, 4);
        }

        // Ligne 2 : pool aléatoire (mix anciens + nouveaux)
        const topIds = new Set(topRow.map(p => p.id));
        const { data: poolData } = await supabase
          .from("products")
          .select("id, slug, name, name_fr, price, rating, product_images(image_url, position)")
          .eq("publish_status", "published")
          .order("created_at", { ascending: false })
          .limit(80);
        const pool = ((poolData || []) as any[]).filter(p => !topIds.has(p.id));
        // Fisher-Yates shuffle
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        const bottomRow = pool.slice(0, 4);

        let combined = [...topRow, ...bottomRow];

        if (user) {
          const recentIds = await fetchRecentlyViewedProductIds(user.id);
          if (recentIds.size > 0) {
            const filtered = combined.filter((p: any) => !recentIds.has(p.id));
            if (filtered.length >= 4) {
              combined = filtered;
            }
          }
        }

        setProducts(
          combined.map((p: any) => ({
            id: p.id,
            slug: p.slug,
            name: p.name,
            nameFr: p.name_fr,
            price: Number(p.price),
            rating: p.rating,
            image: p.product_images?.[0]?.image_url || "/placeholder.svg",
          }))
        );
      } catch {
        const { data: popular } = await supabase
          .from("products")
          .select("id, slug, name, name_fr, price, rating, product_images(image_url, position)")
          .eq("publish_status", "published")
          .order("created_at", { ascending: false })
          .limit(8);

        setProducts(
          (popular || []).map((p: any) => ({
            id: p.id,
            slug: p.slug,
            name: p.name,
            nameFr: (p as any).name_fr,
            price: Number(p.price),
            rating: p.rating,
            image: p.product_images?.[0]?.image_url || "/placeholder.svg",
          }))
        );
      }
      setLoading(false);
    }
    load();
  }, [user]);

  if (loading) {
    return (
      <div className="container py-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!products.length) return null;

  return (
    <section className="container py-6" aria-labelledby="home-recommendations-heading">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={20} className="text-primary" aria-hidden />
        <h2 id="home-recommendations-heading" className="text-lg font-bold text-foreground">
          {user ? t("home.forYou") : t("home.popularProducts")}
        </h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {products.map((product) => {
          const displayName = locale === "fr" ? product.nameFr || product.name : product.name;
          return (
          <Link
            key={product.id}
            to={`/product/${product.slug || product.id}`}
            className="group bg-card border border-border rounded-xl overflow-hidden hover:shadow-md transition-shadow"
          >
            <div className="aspect-square overflow-hidden bg-muted">
              <img
                src={imgUrl(product.image, { width: 400, height: 400, resize: "cover" })}
                alt={displayName}
                className="w-full h-full object-cover object-center"
                loading="lazy"
              />
            </div>
            <div className="p-2.5">
              <p className="text-xs font-medium text-foreground line-clamp-2 mb-1">{displayName}</p>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-primary">${product.price.toFixed(2)}</span>
                {product.rating != null && product.rating > 0 && (
                  <span className="text-[10px] text-primary">★ {product.rating}</span>
                )}
              </div>
            </div>
          </Link>
          );
        })}
      </div>
    </section>
  );
}
