import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";
import { fetchProducts, fetchTrendTags, fetchCategories, type Product, type TrendTag } from "@/services/api";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight, TrendingUp, Flame, Users } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";

const PAGE_SIZE = 24;

// Category-based sections to show between Tendances and Voir Plus
const CATEGORY_SECTIONS = [
  { categoryName: "Fashion", labelFr: "👗 Mode Femme", icon: Users },
  { categoryName: "Electronics", labelFr: "📱 Électronique", icon: TrendingUp },
  { categoryName: "Home & Living", labelFr: "🏠 Maison & Déco", icon: TrendingUp },
];

export function ProductGrid() {
  const { t } = useI18n();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [activeTab, setActiveTab] = useState("all");
  const [trendTags, setTrendTags] = useState<TrendTag[]>([]);

  // Infinite "Voir Plus" pagination
  const [moreProducts, setMoreProducts] = useState<Product[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentOffset, setCurrentOffset] = useState(0);

  // Popular section
  const [popularProducts, setPopularProducts] = useState<Product[]>([]);
  const [popularLoading, setPopularLoading] = useState(true);

  // Category sections
  const [categorySections, setCategorySections] = useState<{ label: string; products: Product[] }[]>([]);

  // Load trend tags on mount
  useEffect(() => {
    fetchTrendTags().then(setTrendTags);
  }, []);

  // Load popular products: 8 most sold + 2 most favorited + 2 most in cart
  useEffect(() => {
    setPopularLoading(true);
    (async () => {
      // 8 most sold
      const topSold = await fetchProducts({ limit: 8, orderBy: "popular" });

      // 2 most favorited (by wishlist count)
      const { data: topWishlisted } = await supabase
        .from("wishlists")
        .select("product_id")
        .limit(100);
      const wishCounts: Record<string, number> = {};
      (topWishlisted || []).forEach((w: any) => {
        wishCounts[w.product_id] = (wishCounts[w.product_id] || 0) + 1;
      });
      const topWishIds = Object.entries(wishCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([id]) => id);

      // 2 most added to cart
      const { data: topCarted } = await supabase
        .from("cart_items")
        .select("product_id")
        .limit(100);
      const cartCounts: Record<string, number> = {};
      (topCarted || []).forEach((c: any) => {
        cartCounts[c.product_id] = (cartCounts[c.product_id] || 0) + 1;
      });
      const topCartIds = Object.entries(cartCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([id]) => id);

      // Fetch extra products for favorites and cart
      const existingIds = new Set(topSold.map(p => p.id));
      const extraIds = [...topWishIds, ...topCartIds].filter(id => !existingIds.has(id));

      let extraProducts: typeof topSold = [];
      if (extraIds.length > 0) {
        const allExtra = await fetchProducts({ limit: 50 });
        const wishProducts = topWishIds
          .filter(id => !existingIds.has(id))
          .map(id => allExtra.find(p => p.id === id))
          .filter(Boolean) as typeof topSold;
        const cartProducts = topCartIds
          .filter(id => !existingIds.has(id) && !wishProducts.some(p => p.id === id))
          .map(id => allExtra.find(p => p.id === id))
          .filter(Boolean) as typeof topSold;
        extraProducts = [...wishProducts.slice(0, 2), ...cartProducts.slice(0, 2)];
      }

      setPopularProducts([...topSold, ...extraProducts].slice(0, 12));
      setPopularLoading(false);
    })();
  }, []);

  // Load category sections on mount
  useEffect(() => {
    fetchCategories().then((cats) => {
      CATEGORY_SECTIONS.forEach((section) => {
        const cat = cats.find((c) => c.name === section.categoryName);
        if (cat) {
          fetchProducts({ categoryId: cat.id, limit: 12 }).then((data) => {
            if (data.length > 0) {
              setCategorySections((prev) => {
                if (prev.find((s) => s.label === section.labelFr)) return prev;
                return [...prev, { label: section.labelFr, products: data }];
              });
            }
          });
        }
      });
    });
  }, []);

  // Load main Tendances products when tab changes
  useEffect(() => {
    setLoading(true);
    setError(null);
    setMoreProducts([]);
    setCurrentOffset(0);
    setHasMore(true);

    const params: any = { limit: PAGE_SIZE };
    if (activeTab !== "all") {
      params.trendTagId = activeTab;
    }

    fetchProducts(params)
      .then((data) => {
        setProducts(data);
        setCurrentOffset(data.length);
        setHasMore(data.length >= PAGE_SIZE);
        setLoading(false);
      })
      .catch((err) => {
        console.error("[ProductGrid] Load failed:", err);
        setError(err.message || "Erreur de chargement");
        setLoading(false);
      });
  }, [activeTab, retryKey]);

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);

    const totalLoaded = products.length + moreProducts.length;
    const params: any = { limit: PAGE_SIZE, offset: totalLoaded };
    if (activeTab !== "all") {
      params.trendTagId = activeTab;
    }

    const data = await fetchProducts(params);

    // Filter duplicates
    const existingIds = new Set([
      ...products.map((p) => p.id),
      ...moreProducts.map((p) => p.id),
    ]);
    const newProducts = data.filter((p) => !existingIds.has(p.id));

    if (newProducts.length === 0 || data.length < PAGE_SIZE) {
      setHasMore(false);
    }

    if (newProducts.length > 0) {
      setMoreProducts((prev) => [...prev, ...newProducts]);
    }
    setLoadingMore(false);
  };

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
        {popularProducts.length > 0 && (
          <div className="mb-10">
          <Link to="/popular" className="flex items-center gap-2 mb-4 group cursor-pointer">
              <Flame size={18} className="text-orange-500" />
              <h2 className="text-base md:text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                {t("home.mostPopular")}
              </h2>
              <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
            </Link>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5 md:gap-2">
              {popularLoading
                ? Array.from({ length: 12 }).map((_, i) => <ProductCardSkeleton key={i} />)
                : popularProducts.map((product, i) => (
                    <Link to={`/product/${product.slug || product.id}`} key={product.id} className="block">
                      <ProductCard product={product} index={i} />
                    </Link>
                  ))}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════ */}
        {/* CATEGORY SECTIONS (Femmes, Électronique…)   */}
        {/* ═══════════════════════════════════════════ */}
        {categorySections.map((section, sIdx) => (
          <div key={sIdx} className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-base md:text-lg font-bold text-foreground">
                {section.label}
              </h2>
              <ChevronRight size={16} className="text-muted-foreground" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5 md:gap-2">
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
            <p className="text-sm text-muted-foreground mb-3">Impossible de charger les produits</p>
            <button
              onClick={() => setRetryKey((k) => k + 1)}
              className="px-6 py-2 text-sm font-medium border border-foreground text-foreground bg-card hover:bg-foreground hover:text-card transition-colors"
            >
              Réessayer
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5 md:gap-2">
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5 md:gap-2 mt-2">
            {moreProducts.map((product, i) => (
              <Link to={`/product/${product.slug || product.id}`} key={product.id} className="block">
                <ProductCard product={product} index={i} />
              </Link>
            ))}
          </div>
        )}

        {/* "Voir Plus" button — infinite pagination */}
        <div className="text-center mt-8">
          {hasMore ? (
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="px-10 py-2.5 text-sm font-medium border border-foreground text-foreground bg-card hover:bg-foreground hover:text-card transition-colors disabled:opacity-50"
            >
              {loadingMore ? t("general.loadingMore") : t("general.seeMore")}
            </button>
          ) : (
            <p className="text-xs text-muted-foreground">{t("general.allSeen")}</p>
          )}
        </div>
      </div>
    </section>
  );
}
