import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { ProductRail } from "@/components/ProductRail";
import { fetchProducts, type Product } from "@/services/api";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/contexts/I18nContext";
import { useHomeMarket } from "@/contexts/HomeMarketContext";
import { useDiscoveryPrefs } from "@/contexts/DiscoveryPrefsContext";
import { useDiscoveryRankedProducts } from "@/hooks/use-discovery-ranked";
import {
  discoveryShopTypeFilter,
  fetchWithLocalFirstBackfill,
  prefersLocalDiscoveryScope,
} from "@/lib/discovery-fetch";

export function TopTrends() {
  const [rawProducts, setRawProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { t } = useI18n();
  const { shopTypeFilter } = useHomeMarket();
  const { prefs, hasCompleted } = useDiscoveryPrefs();
  const products = useDiscoveryRankedProducts(rawProducts, "home_trends", 12);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(false);
      try {
        const { data: trending } = await (supabase
          .from("trending_products" as any)
          .select("product_id")
          .order("sort_order") as any);

        if (cancelled) return;
        const trendingIds: string[] = (trending || []).map((t: any) => t.product_id);
        const shopType = discoveryShopTypeFilter(hasCompleted, prefs.purchase_scope, shopTypeFilter);
        const localFirst = prefersLocalDiscoveryScope(hasCompleted, prefs.purchase_scope);
        const fetchLimit = hasCompleted ? 48 : 48;

        const allProducts = await fetchWithLocalFirstBackfill(
          (st) => fetchProducts({ limit: fetchLimit, shopType: st }),
          { shopType, preferLocalBackfill: localFirst, minCount: 12 },
        );
        if (cancelled) return;

        if (trendingIds.length > 0) {
          const trendingSet = new Set(trendingIds);
          const ordered = trendingIds
            .map((id) => allProducts.find((p) => p.id === id))
            .filter(Boolean) as Product[];
          const rest = allProducts.filter((p) => !trendingSet.has(p.id));
          setRawProducts([...ordered, ...rest].slice(0, 48));
        } else {
          setRawProducts(allProducts);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("[TopTrends] Load failed:", err);
        setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shopTypeFilter, hasCompleted, prefs.purchase_scope]);

  const loadProducts = () => {
    setError(false);
    setLoading(true);
    const shopType = discoveryShopTypeFilter(hasCompleted, prefs.purchase_scope, shopTypeFilter);
    const localFirst = prefersLocalDiscoveryScope(hasCompleted, prefs.purchase_scope);
    void fetchWithLocalFirstBackfill(
      (st) => fetchProducts({ limit: 48, shopType: st }),
      { shopType, preferLocalBackfill: localFirst, minCount: 12 },
    )
      .then((data) => {
        setRawProducts(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  };

  if (error) {
    return (
      <section className="py-6 bg-muted/30 dark:bg-muted/10" aria-labelledby="home-trends-heading">
        <div className="container">
          <Link to="/trends" className="flex items-center gap-2 mb-4 group cursor-pointer">
            <h2
              id="home-trends-heading"
              className="text-base md:text-lg font-bold text-foreground group-hover:text-primary transition-colors"
            >
              {t("home.topTrends")}
            </h2>
            <ChevronRight
              size={16}
              className="text-muted-foreground group-hover:text-primary transition-colors"
            />
          </Link>
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground mb-3">
              {t("common.loadProductsFailed") || "Impossible de charger les produits"}
            </p>
            <button
              onClick={loadProducts}
              className="px-6 py-2 text-sm font-medium border border-foreground text-foreground bg-card hover:bg-foreground hover:text-card transition-colors"
            >
              {t("common.retry") || "Réessayer"}
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <ProductRail
      title={t("home.topTrends")}
      titleId="home-trends-heading"
      seeAllHref="/trends"
      products={products}
      loading={loading}
      skeletonCount={12}
      className="bg-muted/30 dark:bg-muted/10 py-0"
      embedded
    />
  );
}
