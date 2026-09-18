import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { Sparkles } from "lucide-react";
import { fetchRecentlyViewedProductIds } from "@/lib/user-product-views";
import { ProductRail } from "@/components/ProductRail";
import type { Product } from "@/services/api";
import { useHomeMarket } from "@/contexts/HomeMarketContext";

function toProduct(p: {
  id: string;
  slug?: string | null;
  name: string;
  name_fr?: string | null;
  nameFr?: string | null;
  price: number;
  rating?: number | null;
  product_images?: Array<{ image_url: string }>;
  image?: string;
}): Product {
  return {
    id: p.id,
    slug: p.slug || undefined,
    name: p.name,
    nameFr: p.name_fr || p.nameFr || p.name,
    price: Number(p.price),
    currency: "USD",
    image: p.image || p.product_images?.[0]?.image_url || "/placeholder.svg",
    category: "",
    categoryFr: "",
    rating: p.rating ?? 0,
    reviewCount: 0,
  };
}

/** Fisher-Yates — mutates and returns the same array. */
function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Rotate within the top `poolSize` of a rating-sorted list, then take `n`. */
function pickFromTopN<T>(list: T[], n: number, poolSize = 10): T[] {
  const pool = shuffleInPlace(list.slice(0, poolSize));
  return pool.slice(0, n);
}

export function RecommendationsSection() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { shopTypeFilter } = useHomeMarket();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
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

        let q = supabase
          .from("products_public")
          .select(
            "id, slug, name, name_fr, price, rating, product_images(image_url, position), gender_target, shop_type",
          )
          .eq("publish_status", "published")
          .order("rating", { ascending: false })
          .limit(60);
        if (shopTypeFilter) q = (q as any).eq("shop_type", shopTypeFilter);
        const { data: allProducts } = await q;
        if (cancelled) return;
        const products_list = (allProducts || []) as any[];

        let topRow: any[];

        if (userGender === "female" || userGender === "femme") {
          const female = products_list.filter(p => p.gender_target === "female" || p.gender_target === "femme");
          const unisex = products_list.filter(p => p.gender_target === "unisex" && !female.includes(p));
          // Prefer gender pool (rotated top 10), then unisex top 10 if short
          topRow = pickFromTopN(female, 4);
          if (topRow.length < 4) {
            const taken = new Set(topRow.map((p) => p.id));
            topRow = [...topRow, ...pickFromTopN(unisex.filter((p) => !taken.has(p.id)), 4 - topRow.length)];
          }
        } else if (userGender === "male" || userGender === "homme") {
          const male = products_list.filter(p => p.gender_target === "male" || p.gender_target === "homme");
          const unisex = products_list.filter(p => p.gender_target === "unisex" && !male.includes(p));
          topRow = pickFromTopN(male, 4);
          if (topRow.length < 4) {
            const taken = new Set(topRow.map((p) => p.id));
            topRow = [...topRow, ...pickFromTopN(unisex.filter((p) => !taken.has(p.id)), 4 - topRow.length)];
          }
        } else {
          const female = products_list.filter(p => p.gender_target === "female" || p.gender_target === "femme");
          const male = products_list.filter(p => p.gender_target === "male" || p.gender_target === "homme");
          const unisex = products_list.filter(p => !["female", "femme", "male", "homme"].includes(p.gender_target || ""));
          topRow = [
            ...pickFromTopN(female, 2),
            ...pickFromTopN(male, 1),
            ...pickFromTopN(unisex, 1),
          ].slice(0, 4);
        }

        if (topRow.length < 4) {
          const existingIds = new Set(topRow.map(p => p.id));
          const remaining = products_list.filter(p => !existingIds.has(p.id));
          topRow = [...topRow, ...remaining].slice(0, 4);
        }

        // Ligne 2 : pool aléatoire (mix anciens + nouveaux)
        const topIds = new Set(topRow.map(p => p.id));
        let poolQ = supabase
          .from("products_public")
          .select("id, slug, name, name_fr, price, rating, product_images(image_url, position), shop_type")
          .eq("publish_status", "published")
          .order("created_at", { ascending: false })
          .limit(80);
        if (shopTypeFilter) poolQ = (poolQ as any).eq("shop_type", shopTypeFilter);
        const { data: poolData } = await poolQ;
        if (cancelled) return;
        const pool = ((poolData || []) as any[]).filter(p => !topIds.has(p.id));
        shuffleInPlace(pool);
        const bottomRow = pool.slice(0, 4);

        let combined = [...topRow, ...bottomRow];

        if (user) {
          const recentIds = await fetchRecentlyViewedProductIds(user.id);
          if (cancelled) return;
          if (recentIds.size > 0) {
            const filtered = combined.filter((p: any) => !recentIds.has(p.id));
            if (filtered.length >= 4) {
              combined = filtered;
            }
          }
        }

        if (cancelled) return;
        setProducts(combined.map((p: any) => toProduct(p)));
      } catch {
        if (cancelled) return;
        let fallbackQ = supabase
          .from("products_public")
          .select("id, slug, name, name_fr, price, rating, product_images(image_url, position), shop_type")
          .eq("publish_status", "published")
          .order("created_at", { ascending: false })
          .limit(8);
        if (shopTypeFilter) fallbackQ = (fallbackQ as any).eq("shop_type", shopTypeFilter);
        const { data: popular } = await fallbackQ;
        if (cancelled) return;

        setProducts((popular || []).map((p: any) => toProduct(p)));
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user, shopTypeFilter]);

  if (!loading && !products.length) return null;

  return (
    <ProductRail
      title={user ? t("home.forYou") : t("home.popularProducts")}
      titleId="home-recommendations-heading"
      products={products}
      loading={loading}
      icon={<Sparkles size={20} className="text-primary" aria-hidden />}
    />
  );
}
