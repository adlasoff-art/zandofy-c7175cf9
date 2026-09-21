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
import { useDiscoveryRankedProducts } from "@/hooks/use-discovery-ranked";
import { discoveryShopTypeFilter, prefersLocalDiscoveryScope } from "@/lib/discovery-fetch";

const RECO_SELECT = `${PRODUCT_LIST_SELECT.trim()}, gender_target`;

function shuffleInPlace<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickFromTopN<T>(list: T[], n: number, poolSize = 10): T[] {
  const pool = shuffleInPlace(list.slice(0, poolSize));
  return pool.slice(0, n);
}

export function RecommendationsSection() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { shopTypeFilter } = useHomeMarket();
  const { prefs, hasCompleted } = useDiscoveryPrefs();
  const [rawProducts, setRawProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const products = useDiscoveryRankedProducts(rawProducts, "home_reco", 12);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        let userGender: string | null = null;

        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("gender")
            .eq("id", user.id)
            .maybeSingle();
          userGender = (profile as any)?.gender || null;
        }

        let q = supabase
          .from("products_public")
          .select(RECO_SELECT)
          .eq("publish_status", "published")
          .order("rating", { ascending: false })
          .limit(hasCompleted ? 80 : 80);
        const shopType = discoveryShopTypeFilter(hasCompleted, prefs.purchase_scope, shopTypeFilter);
        if (shopType) q = (q as any).eq("shop_type", shopType);
        const { data: allProducts } = await q;
        if (cancelled) return;
        let list = (allProducts || []) as any[];

        // Local-first backfill if pool too thin for ranking
        if (
          prefersLocalDiscoveryScope(hasCompleted, prefs.purchase_scope) &&
          shopType === "local" &&
          list.length < 12
        ) {
          const { data: open } = await supabase
            .from("products_public")
            .select(RECO_SELECT)
            .eq("publish_status", "published")
            .order("rating", { ascending: false })
            .limit(80);
          if (cancelled) return;
          const seen = new Set(list.map((p) => p.id));
          for (const p of open || []) {
            if (seen.has(p.id)) continue;
            seen.add(p.id);
            list.push(p);
          }
        }

        let combined: Product[];

        if (hasCompleted) {
          combined = list.map((p) => mapProduct(p));
        } else {
          let topRow: any[];
          if (userGender === "female" || userGender === "femme") {
            const female = list.filter((p) => p.gender_target === "female" || p.gender_target === "femme");
            const unisex = list.filter((p) => p.gender_target === "unisex");
            topRow = pickFromTopN(female, 6, 16);
            if (topRow.length < 6) {
              const taken = new Set(topRow.map((p) => p.id));
              topRow = [...topRow, ...pickFromTopN(unisex.filter((p) => !taken.has(p.id)), 6 - topRow.length, 16)];
            }
          } else if (userGender === "male" || userGender === "homme") {
            const male = list.filter((p) => p.gender_target === "male" || p.gender_target === "homme");
            const unisex = list.filter((p) => p.gender_target === "unisex");
            topRow = pickFromTopN(male, 6, 16);
            if (topRow.length < 6) {
              const taken = new Set(topRow.map((p) => p.id));
              topRow = [...topRow, ...pickFromTopN(unisex.filter((p) => !taken.has(p.id)), 6 - topRow.length, 16)];
            }
          } else {
            const female = list.filter((p) => p.gender_target === "female" || p.gender_target === "femme");
            const male = list.filter((p) => p.gender_target === "male" || p.gender_target === "homme");
            const unisex = list.filter((p) => !["female", "femme", "male", "homme"].includes(p.gender_target || ""));
            topRow = [
              ...pickFromTopN(female, 3, 12),
              ...pickFromTopN(male, 2, 12),
              ...pickFromTopN(unisex, 1, 12),
            ].slice(0, 6);
          }
          if (topRow.length < 6) {
            const existingIds = new Set(topRow.map((p) => p.id));
            topRow = [...topRow, ...list.filter((p) => !existingIds.has(p.id))].slice(0, 6);
          }
          const topIds = new Set(topRow.map((p) => p.id));
          const pool = list.filter((p) => !topIds.has(p.id));
          shuffleInPlace(pool);
          combined = [...topRow, ...pool.slice(0, 6)].map((p) => mapProduct(p));
        }

        if (user) {
          const recentIds = await fetchRecentlyViewedProductIds(user.id);
          if (cancelled) return;
          if (recentIds.size > 0) {
            const filtered = combined.filter((p) => !recentIds.has(p.id));
            if (filtered.length >= 6) combined = filtered;
          }
        }

        if (!cancelled) setRawProducts(combined);
      } catch {
        if (cancelled) return;
        let fallbackQ = supabase
          .from("products_public")
          .select(RECO_SELECT)
          .eq("publish_status", "published")
          .order("created_at", { ascending: false })
          .limit(48);
        if (!hasCompleted && shopTypeFilter) fallbackQ = (fallbackQ as any).eq("shop_type", shopTypeFilter);
        else {
          const st = discoveryShopTypeFilter(true, prefs.purchase_scope, shopTypeFilter);
          if (st) fallbackQ = (fallbackQ as any).eq("shop_type", st);
        }
        const { data: popular } = await fallbackQ;
        if (!cancelled) setRawProducts((popular || []).map((p: any) => mapProduct(p)));
      }
      if (!cancelled) setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [user, shopTypeFilter, prefs.audience, prefs.purchase_scope, hasCompleted]);

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
