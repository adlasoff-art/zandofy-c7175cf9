import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";
import { ProductRail } from "@/components/ProductRail";
import { fetchProducts, fetchTrendTags, fetchCategories, type Product, type TrendTag, type Category } from "@/services/api";
import { categoryPath } from "@/lib/category-slug";
import { PRODUCT_GRID_CLASS } from "@/lib/product-image-fit";
import { readProductGridCache, writeProductGridCache } from "@/lib/product-grid-cache";
import {
  getHomeShuffleSeed,
  shuffleBySessionSeed,
  HOME_RESHUFFLE_EVENT,
} from "@/lib/home-session-shuffle";
import { ChevronRight, TrendingUp, Flame, Users } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { useHomeMarket } from "@/contexts/HomeMarketContext";
import { useDiscoveryPrefs } from "@/contexts/DiscoveryPrefsContext";
import { useAuthSettings } from "@/hooks/use-auth-settings";
import { useAuth } from "@/contexts/AuthContext";
import { assembleDiscoveryFeed, expandInterestCategoryIds, EMPTY_CATEGORY_TREE } from "@/lib/discovery-engine";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const PAGE_SIZE = 24;

// Homepage category blocks — matched flexibly against DB names (EN/FR)
const CATEGORY_SECTION_TARGETS = [
  {
    keys: ["fashion", "mode", "femme", "women"],
    labelKey: "home.womenFashion",
    labelFr: "👗 Mode Femme",
    icon: Users,
  },
  {
    keys: ["electronics", "électronique", "electronique", "tech"],
    labelKey: "home.electronics",
    labelFr: "📱 Électronique",
    icon: TrendingUp,
  },
  {
    keys: ["home", "maison", "living", "déco", "deco", "house"],
    labelKey: "home.homeLiving",
    labelFr: "🏠 Maison & Déco",
    icon: TrendingUp,
  },
];

function categoryMatchesKeys(cat: Category, keys: string[]): boolean {
  const hay = `${cat.name} ${cat.nameFr}`.toLowerCase();
  return keys.some((k) => hay.includes(k));
}

export function ProductGrid({ restoreFromCache = false }: { restoreFromCache?: boolean }) {
  const { t, locale } = useI18n();
  const { market, shopTypeFilter } = useHomeMarket();
  const { prefs, hasCompleted } = useDiscoveryPrefs();
  const { data: authSettings } = useAuthSettings();
  const { user } = useAuth();
  const { data: categoryTreeData } = useQuery({
    queryKey: ["discovery-category-tree"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("categories").select("id, parent_id").limit(2000);
      if (error) throw error;
      return (data || []) as { id: string; parent_id: string | null }[];
    },
    staleTime: 10 * 60 * 1000,
    enabled: hasCompleted,
  });
  const categoryTree = categoryTreeData ?? EMPTY_CATEGORY_TREE;
  const effectiveShopType = hasCompleted ? undefined : shopTypeFilter;
  const cached =
    restoreFromCache && market === "all" ? readProductGridCache("all") : null;
  const marketRef = useRef(market);
  marketRef.current = market;

  const [products, setProducts] = useState<Product[]>(cached?.products ?? []);
  const [loading, setLoading] = useState(!(cached && cached.products.length > 0));
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [activeTab, setActiveTab] = useState(cached?.activeTab ?? "all");
  const [trendTags, setTrendTags] = useState<TrendTag[]>([]);

  // Infinite "Voir Plus" pagination
  const [moreProducts, setMoreProducts] = useState<Product[]>(cached?.moreProducts ?? []);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(cached?.hasMore ?? true);
  const [currentOffset, setCurrentOffset] = useState(cached?.currentOffset ?? 0);
  const loadingMoreRef = useRef(false);

  // Popular section
  const [popularProducts, setPopularProducts] = useState<Product[]>(cached?.popularProducts ?? []);
  const [popularLoading, setPopularLoading] = useState(!(cached && cached.popularProducts.length > 0));

  // Category sections
  const [categorySections, setCategorySections] = useState<
    { label: string; products: Product[]; href: string }[]
  >(cached?.categorySections ?? []);

  const cacheSnapshotRef = useRef({
    products,
    moreProducts,
    popularProducts,
    categorySections,
    activeTab,
    hasMore,
    currentOffset,
  });
  cacheSnapshotRef.current = {
    products,
    moreProducts,
    popularProducts,
    categorySections,
    activeTab,
    hasMore,
    currentOffset,
  };

  useEffect(() => {
    return () => {
      writeProductGridCache({
        ...cacheSnapshotRef.current,
        market: marketRef.current,
      });
    };
  }, []);

  // Load trend tags on mount
  useEffect(() => {
    fetchTrendTags().then(setTrendTags);
  }, []);

  // Popular products — cancel stale market requests
  useEffect(() => {
    let cancelled = false;
    if (
      restoreFromCache &&
      market === "all" &&
      cached &&
      cached.popularProducts.length > 0
    ) {
      setPopularProducts(cached.popularProducts);
      setPopularLoading(false);
      return;
    }
    setPopularLoading(true);
    fetchProducts({ limit: 24, orderBy: "popular", shopType: effectiveShopType })
      .then((items) => {
        if (cancelled) return;
        const ranked =
          hasCompleted
            ? assembleDiscoveryFeed(items, {
                prefs,
                mix: authSettings?.discovery_mix,
                take: 12,
                interestCategoryIds: expandInterestCategoryIds(
                  prefs.interest_category_ids,
                  categoryTree,
                ),
                surface: "home_popular",
                seedKey: user?.id || "guest",
              })
            : items.slice(0, 12);
        setPopularProducts(ranked);
        setPopularLoading(false);
      })
      .catch(() => {
        if (!cancelled) setPopularLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [shopTypeFilter, market, effectiveShopType, hasCompleted, prefs, authSettings?.discovery_mix, categoryTree, user?.id]);

  // Load category sections (capped fan-out)
  useEffect(() => {
    if (
      restoreFromCache &&
      market === "all" &&
      cached &&
      cached.categorySections.length > 0
    ) {
      setCategorySections(cached.categorySections);
      return;
    }
    let cancelled = false;
    setCategorySections([]);
    (async () => {
      const cats = await fetchCategories();
      for (const target of CATEGORY_SECTION_TARGETS) {
        if (cancelled) return;
        const cat = cats.find((c) => categoryMatchesKeys(c, target.keys));
        if (!cat) continue;
        try {
          const data = await fetchProducts({
            categoryId: cat.id,
            limit: hasCompleted ? 18 : 6,
            shopType: effectiveShopType,
          });
          if (cancelled || data.length === 0) continue;
          const products =
            hasCompleted
              ? assembleDiscoveryFeed(data, {
                  prefs,
                  mix: authSettings?.discovery_mix,
                  take: 6,
                  interestCategoryIds: expandInterestCategoryIds(
                    prefs.interest_category_ids,
                    categoryTree,
                  ),
                  surface: `home_cat_${cat.id}`,
                  seedKey: user?.id || "guest",
                })
              : data;
          setCategorySections((prev) => {
            const label = t(target.labelKey) || target.labelFr;
            const href = categoryPath(cat, locale);
            if (prev.find((s) => s.href === href)) return prev;
            return [...prev, { label, products, href }];
          });
        } catch {
          /* skip section */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t, locale, shopTypeFilter, market, effectiveShopType, hasCompleted, prefs, authSettings?.discovery_mix, categoryTree, user?.id]);

  // Load main Tendances products when tab / market changes (session shuffle; POP uses cache)
  useEffect(() => {
    if (
      restoreFromCache &&
      market === "all" &&
      cached &&
      cached.activeTab === activeTab &&
      cached.products.length > 0 &&
      retryKey === 0
    ) {
      setProducts(cached.products);
      setMoreProducts(cached.moreProducts);
      setHasMore(cached.hasMore);
      setCurrentOffset(cached.currentOffset);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setMoreProducts([]);
    setCurrentOffset(0);
    setHasMore(true);
    loadingMoreRef.current = false;

    const params: any = { limit: PAGE_SIZE, shopType: effectiveShopType };
    if (activeTab !== "all") {
      params.trendTagId = activeTab;
    }

    (async () => {
      try {
        // Mix recent + older catalogue before session shuffle (wave E)
        const [recent, older] = await Promise.all([
          fetchProducts(params),
          activeTab === "all"
            ? fetchProducts({
                limit: PAGE_SIZE,
                offset: PAGE_SIZE * 2,
                shopType: effectiveShopType,
              })
            : Promise.resolve([] as Product[]),
        ]);
        if (cancelled) return;
        const seen = new Set<string>();
        const mixed: Product[] = [];
        for (const p of [...recent, ...older]) {
          if (seen.has(p.id)) continue;
          seen.add(p.id);
          mixed.push(p);
        }
        const ordered =
          activeTab === "all" ? shuffleBySessionSeed(mixed, getHomeShuffleSeed()) : mixed;
        const ranked =
          hasCompleted && activeTab === "all"
            ? assembleDiscoveryFeed(ordered, {
                prefs,
                mix: authSettings?.discovery_mix,
                take: PAGE_SIZE,
                interestCategoryIds: expandInterestCategoryIds(prefs.interest_category_ids, categoryTree),
                surface: "home_grid",
                seedKey: user?.id || "guest",
              })
            : ordered.slice(0, PAGE_SIZE);
        setProducts(ranked);
        setCurrentOffset(Math.max(recent.length, ranked.length));
        setHasMore(recent.length >= PAGE_SIZE || older.length > 0);
        setLoading(false);
      } catch (err: any) {
        if (cancelled) return;
        console.error("[ProductGrid] Load failed:", err);
        setError(err.message || (t("common.loadProductsFailed") || "Erreur de chargement"));
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab, retryKey, effectiveShopType, market, hasCompleted, prefs, authSettings?.discovery_mix, categoryTree, user?.id]);

  // Re-tap Accueil / pull-to-refresh → reshuffle without full remount of page chrome
  useEffect(() => {
    if (restoreFromCache) return;
    const onReshuffle = () => setRetryKey((k) => k + 1);
    window.addEventListener(HOME_RESHUFFLE_EVENT, onReshuffle);
    return () => window.removeEventListener(HOME_RESHUFFLE_EVENT, onReshuffle);
  }, [restoreFromCache]);

  const handleLoadMore = useCallback(async () => {
    // Sync lock — IntersectionObserver can fire twice before React re-renders loadingMore
    if (loadingMoreRef.current || !hasMore) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);

    try {
      const totalLoaded = products.length + moreProducts.length;
      const params: any = { limit: PAGE_SIZE, offset: totalLoaded, shopType: effectiveShopType };
      if (activeTab !== "all") {
        params.trendTagId = activeTab;
      }

      const data = await fetchProducts(params);

      const existingIds = new Set([
        ...products.map((p) => p.id),
        ...moreProducts.map((p) => p.id),
      ]);
      const newProducts = data.filter((p) => !existingIds.has(p.id));

      if (newProducts.length === 0 || data.length < PAGE_SIZE) {
        setHasMore(false);
      }

      if (newProducts.length > 0) {
        const rankedNew =
          hasCompleted && activeTab === "all"
            ? assembleDiscoveryFeed(newProducts, {
                prefs,
                mix: authSettings?.discovery_mix,
                take: newProducts.length,
                interestCategoryIds: expandInterestCategoryIds(
                  prefs.interest_category_ids,
                  categoryTree,
                ),
                surface: "home_grid_more",
                seedKey: user?.id || "guest",
              })
            : newProducts;
        setMoreProducts((prev) => [...prev, ...rankedNew]);
      }
    } catch (err) {
      console.error("[ProductGrid] Load more failed:", err);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore, products, moreProducts, activeTab, effectiveShopType, hasCompleted, prefs, authSettings?.discovery_mix, categoryTree, user?.id]);

  // Infinite scroll sentinel (replaces "Voir plus" click). Fallback button if IO missing.
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const supportsIO = typeof IntersectionObserver !== "undefined";

  useEffect(() => {
    if (!supportsIO || !hasMore || loading || error) return;
    const el = loadMoreRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          void handleLoadMore();
        }
      },
      { root: null, rootMargin: "320px 0px", threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [supportsIO, hasMore, loading, error, handleLoadMore]);

  const tabs = [
    { key: "all", label: t("home.all") },
    ...trendTags.map((t) => ({ key: t.id, label: t.nameFr })),
  ];

  return (
    <section id="products" className="py-6 bg-muted/30 dark:bg-muted/10" aria-label={t("home.all")}>
      <div className="container">
        {/* ═══════════════════════════════════════════ */}
        {/* POPULAR PRODUCTS SECTION                    */}
        {/* ═══════════════════════════════════════════ */}
        {(popularLoading || popularProducts.length > 0) && (
          <div className="mb-10">
            <ProductRail
              title={t("home.mostPopular")}
              titleId="home-popular-heading"
              seeAllHref="/popular"
              products={popularProducts}
              loading={popularLoading}
              skeletonCount={12}
              className="bg-transparent"
              icon={<Flame size={18} className="text-orange-500" aria-hidden />}
              embedded
            />
          </div>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* CATEGORY SECTIONS (Femmes, Électronique…)   */}
        {/* ═══════════════════════════════════════════ */}
        {categorySections.map((section, sIdx) => (
          <div key={sIdx} className="mb-10">
            <Link
              to={section.href}
              className="flex items-center gap-2 mb-4 group w-fit"
            >
              <h2 className="text-base md:text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                {section.label}
              </h2>
              <ChevronRight
                size={16}
                className="text-muted-foreground group-hover:text-primary transition-colors"
              />
            </Link>
            <div className={PRODUCT_GRID_CLASS}>
              {section.products.map((product, i) => (
                <Link to={`/product/${product.slug || product.id}`} key={product.id} className="block">
                  <ProductCard product={product} index={i} />
                </Link>
              ))}
            </div>
          </div>
        ))}

        {/* ═══════════════════════════════════════════ */}
        {/* TENDANCES — with dynamic trend tag filters  */}
        {/* ═══════════════════════════════════════════ */}
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={18} className="text-primary" aria-hidden />
          <h2 id="home-catalog-trends-heading" className="text-base md:text-lg font-bold text-foreground">
            {t("home.trends")}
          </h2>
          <ChevronRight size={16} className="text-muted-foreground" />
        </div>

        {/* Trend tag tabs (from DB) */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1 scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-all border ${
                activeTab === tab.key
                  ? "bg-foreground text-card border-foreground"
                  : "bg-card text-foreground border-border hover:border-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Main grid */}
        {error ? (
          <div className="text-center py-10">
            <p className="text-sm text-muted-foreground mb-3">{t("common.loadProductsFailed") || "Impossible de charger les produits"}</p>
            <button
              onClick={() => setRetryKey((k) => k + 1)}
              className="px-6 py-2 text-sm font-medium border border-foreground text-foreground bg-card hover:bg-foreground hover:text-card transition-colors"
            >
              {t("common.retry") || "Réessayer"}
            </button>
          </div>
        ) : (
          <div className={PRODUCT_GRID_CLASS}>
            {loading
              ? Array.from({ length: 12 }).map((_, i) => <ProductCardSkeleton key={i} />)
              : products.map((product, i) => (
                  <Link to={`/product/${product.slug || product.id}`} key={product.id} className="block">
                    <ProductCard product={product} index={i} />
                  </Link>
                ))}
          </div>
        )}

        {/* Extra products loaded via "Voir Plus" */}
        {moreProducts.length > 0 && (
          <div className={`${PRODUCT_GRID_CLASS} mt-2`}>
            {moreProducts.map((product, i) => (
              <Link to={`/product/${product.slug || product.id}`} key={product.id} className="block">
                <ProductCard product={product} index={i} />
              </Link>
            ))}
          </div>
        )}

        {/* Infinite scroll sentinel — replaces "Voir Plus" button */}
        <div className="text-center mt-8">
          {hasMore ? (
            <>
              <div ref={loadMoreRef} className="h-1 w-full" aria-hidden />
              {loadingMore && (
                <p className="text-sm text-muted-foreground py-2">{t("general.loadingMore")}</p>
              )}
              {!supportsIO && (
                <button
                  onClick={() => void handleLoadMore()}
                  disabled={loadingMore}
                  className="px-10 py-2.5 text-sm font-medium border border-primary bg-primary text-primary-foreground hover:bg-primary/90 hover:border-primary transition-colors disabled:opacity-50 shadow-sm"
                >
                  {loadingMore ? t("general.loadingMore") : t("general.seeMore")}
                </button>
              )}
            </>
          ) : (
            !loading && products.length > 0 && (
              <p className="text-xs text-muted-foreground">{t("general.allSeen")}</p>
            )
          )}
        </div>
      </div>
    </section>
  );
}
