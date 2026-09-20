import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { Sparkles } from "lucide-react";
import { fetchRecentlyViewedProductIds } from "@/lib/user-product-views";
import { ProductRail } from "@/components/ProductRail";
import { mapProduct, PRODUCT_LIST_SELECT, type Product } from "@/services/api";
import { useHomeMarket } from "@/contexts/HomeMarketContext";
import { useDiscoveryPrefs } from "@/contexts/DiscoveryPrefsContext";
import { rankProductsByDiscoveryPrefs } from "@/lib/discovery-prefs";

/** List select + gender_target for ranking (rating already in PRODUCT_LIST_SELECT). */
const RECO_SELECT = `${PRODUCT_LIST_SELECT.trim()}, gender_target`;

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
  const { prefs, hasCompleted } = useDiscoveryPrefs();
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

        // Prefer discovery audience over profile gender only after completed onboarding
        if (hasCompleted) {
          if (prefs.audience === "male") userGender = "male";
          else if (prefs.audience === "female") userGender = "female";
          else if (prefs.audience === "both" || prefs.audience === "any") {
            userGender = null;
          }
        }

        let q = supabase
          .from("products_public")
          .select(RECO_SELECT)
          .eq("publish_status", "published")
          .order("rating", { ascending: false })
          .limit(80);
        if (shopTypeFilter) q = (q as any).eq("shop_type", shopTypeFilter);
        const { data: allProducts } = await q;
        if (cancelled) return;
        const products_list = (allProducts || []) as any[];

        let combined: any[];

        if (hasCompleted) {
          combined = rankProductsByDiscoveryPrefs(products_list, prefs, 12);
        } else {
          let topRow: any[];

          if (userGender === "female" || userGender === "femme") {
            const female = products_list.filter(p => p.gender_target === "female" || p.gender_target === "femme");
            const unisex = products_list.filter(p => p.gender_target === "unisex" && !female.includes(p));
            topRow = pickFromTopN(female, 6, 16);
            if (topRow.length < 6) {
              const taken = new Set(topRow.map((p) => p.id));
              topRow = [...topRow, ...pickFromTopN(unisex.filter((p) => !taken.has(p.id)), 6 - topRow.length, 16)];
            }
          } else if (userGender === "male" || userGender === "homme") {
            const male = products_list.filter(p => p.gender_target === "male" || p.gender_target === "homme");
            const unisex = products_list.filter(p => p.gender_target === "unisex" && !male.includes(p));
            topRow = pickFromTopN(male, 6, 16);
            if (topRow.length < 6) {
              const taken = new Set(topRow.map((p) => p.id));
              topRow = [...topRow, ...pickFromTopN(unisex.filter((p) => !taken.has(p.id)), 6 - topRow.length, 16)];
            }
          } else {
            const female = products_list.filter(p => p.gender_target === "female" || p.gender_target === "femme");
            const male = products_list.filter(p => p.gender_target === "male" || p.gender_target === "homme");
            const unisex = products_list.filter(p => !["female", "femme", "male", "homme"].includes(p.gender_target || ""));
            topRow = [
              ...pickFromTopN(female, 3, 12),
              ...pickFromTopN(male, 2, 12),
              ...pickFromTopN(unisex, 1, 12),
            ].slice(0, 6);
          }

          if (topRow.length < 6) {
            const existingIds = new Set(topRow.map(p => p.id));
            const remaining = products_list.filter(p => !existingIds.has(p.id));
            topRow = [...topRow, ...remaining].slice(0, 6);
          }

          const topIds = new Set(topRow.map(p => p.id));
          const pool = products_list.filter(p => !topIds.has(p.id));
          shuffleInPlace(pool);
          combined = [...topRow, ...pool.slice(0, 6)];
        }

        if (user) {
          const recentIds = await fetchRecentlyViewedProductIds(user.id);
          if (cancelled) return;
          if (recentIds.size > 0) {
            const filtered = combined.filter((p: any) => !recentIds.has(p.id));
            if (filtered.length >= 6) {
              combined = filtered.slice(0, 12);
            }
          }
        }

        if (cancelled) return;
        setProducts(combined.slice(0, 12).map((p: any) => mapProduct(p)));
      } catch {
        if (cancelled) return;
        let fallbackQ = supabase
          .from("products_public")
          .select(RECO_SELECT)
          .eq("publish_status", "published")
          .order("created_at", { ascending: false })
          .limit(12);
        if (shopTypeFilter) fallbackQ = (fallbackQ as any).eq("shop_type", shopTypeFilter);
        const { data: popular } = await fallbackQ;
        if (cancelled) return;

        setProducts((popular || []).map((p: any) => mapProduct(p)));
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user, shopTypeFilter, prefs, hasCompleted]);

  if (!loading && !products.length) return null;

  return (
    <ProductRail
      title={user || hasCompleted ? t("home.forYou") : t("home.popularProducts")}
      titleId="home-recommendations-heading"
      products={products}
      loading={loading}
      skeletonCount={12}
      className="bg-muted/30 dark:bg-muted/10"
      icon={<Sparkles size={20} className="text-primary" aria-hidden />}
    />
  );
}
