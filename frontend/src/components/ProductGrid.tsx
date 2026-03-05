import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";
import { fetchProducts, type Product } from "@/services/api";
import { ChevronRight } from "lucide-react";

const TABS = [
  { key: "all", label: "Tout" },
  { key: "Tops", label: "Hauts" },
  { key: "Bottoms", label: "Bas" },
  { key: "Dresses", label: "Robes" },
  { key: "Outerwear", label: "Extérieur" },
];

const LOAD_MORE_SECTIONS = [
  { key: "popular", label: "Populaires", params: { limit: 12 } },
  { key: "new", label: "Nouveautés", params: { limit: 12 } },
  { key: "sale", label: "En promo", params: { limit: 12, sale: true } },
];

export function ProductGrid() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [loadedSections, setLoadedSections] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [extraProducts, setExtraProducts] = useState<{ label: string; products: Product[] }[]>([]);

  useEffect(() => {
    setLoading(true);
    setExtraProducts([]);
    setLoadedSections(0);
    const params = activeTab === "all" ? { limit: 24 } : { category: activeTab, limit: 24 };
    fetchProducts(params).then((data) => {
      setProducts(data);
      setLoading(false);
    });
  }, [activeTab]);

  const handleLoadMore = async () => {
    if (loadedSections >= LOAD_MORE_SECTIONS.length) return;
    setLoadingMore(true);

    const section = LOAD_MORE_SECTIONS[loadedSections];
    const offset = products.length + extraProducts.reduce((sum, s) => sum + s.products.length, 0);
    const data = await fetchProducts({ ...section.params });

    // Filter out already displayed product IDs
    const existingIds = new Set([
      ...products.map((p) => p.id),
      ...extraProducts.flatMap((s) => s.products.map((p) => p.id)),
    ]);
    const newProducts = data.filter((p) => !existingIds.has(p.id));

    if (newProducts.length > 0) {
      setExtraProducts((prev) => [...prev, { label: section.label, products: newProducts }]);
    }
    setLoadedSections((prev) => prev + 1);
    setLoadingMore(false);
  };

  const allSectionsLoaded = loadedSections >= LOAD_MORE_SECTIONS.length;

  return (
    <section id="products" className="py-6 bg-muted/30">
      <div className="container">
        {/* Section header */}
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-base md:text-lg font-bold text-foreground">
            Tendances
          </h2>
          <ChevronRight size={16} className="text-muted-foreground" />
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1 scrollbar-hide">
          {TABS.map((tab) => (
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5 md:gap-2">
          {loading
            ? Array.from({ length: 12 }).map((_, i) => <ProductCardSkeleton key={i} />)
            : products.map((product, i) => (
                <Link to={`/product/${product.id}`} key={product.id} className="block">
                  <ProductCard product={product} index={i} />
                </Link>
              ))}
        </div>

        {/* Extra sections loaded via "Voir Plus" */}
        {extraProducts.map((section, sIdx) => (
          <div key={sIdx} className="mt-8">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-base font-bold text-foreground">{section.label}</h3>
              <ChevronRight size={14} className="text-muted-foreground" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5 md:gap-2">
              {section.products.map((product, i) => (
                <Link to={`/product/${product.id}`} key={product.id} className="block">
                  <ProductCard product={product} index={i} />
                </Link>
              ))}
            </div>
          </div>
        ))}

        {/* "Voir Plus" button */}
        <div className="text-center mt-8">
          {!allSectionsLoaded ? (
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="px-10 py-2.5 text-sm font-medium border border-foreground text-foreground bg-card hover:bg-foreground hover:text-card transition-colors disabled:opacity-50"
            >
              {loadingMore ? "Chargement..." : "Voir Plus"}
            </button>
          ) : (
            <p className="text-xs text-muted-foreground">Vous avez tout vu ✨</p>
          )}
        </div>
      </div>
    </section>
  );
}
