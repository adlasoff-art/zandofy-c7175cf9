import { useState, useEffect, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";
import { PRODUCT_GRID_CLASS } from "@/lib/product-image-fit";
import { PredictiveSearch } from "@/components/PredictiveSearch";
import { searchProducts, fetchAllColors, fetchAllSizes, type SearchFilters } from "@/services/search";
import { fetchCategories, type Category, type Product } from "@/services/api";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SlidersHorizontal, X, ChevronDown, ChevronUp, Search } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { TOGGLE_SEARCH_EVENT } from "@/components/MobileBottomNav";

export default function SearchPage() {
  const { t, locale, formatPrice } = useI18n();
  const labelOf = (c: { name?: string | null; nameFr?: string | null }) =>
    locale === "fr" ? (c.nameFr ?? c.name ?? "") : (c.name ?? c.nameFr ?? "");
  const [searchParams, setSearchParams] = useSearchParams();
  const queryParam = searchParams.get("q") || "";

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  // Filter state
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 500]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SearchFilters["sortBy"]>("relevance");

  // Filter options from DB
  const [categories, setCategories] = useState<Category[]>([]);
  const [allColors, setAllColors] = useState<{ hex: string; name: string }[]>([]);
  const [allSizes, setAllSizes] = useState<string[]>([]);

  // Collapsible filter sections
  const [openSections, setOpenSections] = useState({ category: true, price: true, size: true, color: true });
  const toggleSection = (key: keyof typeof openSections) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const SORT_OPTIONS = [
    { value: "relevance", label: t("search.relevance") },
    { value: "price_asc", label: t("search.priceAsc") },
    { value: "price_desc", label: t("search.priceDesc") },
    { value: "newest", label: t("search.newest") },
    { value: "rating", label: t("search.bestRated") },
  ];

  // Load filter options once
  useEffect(() => {
    Promise.all([fetchCategories(), fetchAllColors(), fetchAllSizes()]).then(
      ([cats, colors, sizes]) => {
        setCategories(cats);
        setAllColors(colors);
        setAllSizes(sizes);
      }
    );
  }, []);

  // Listen for mobile bottom nav search toggle
  useEffect(() => {
    const handler = () => setMobileSearchOpen((prev) => !prev);
    window.addEventListener(TOGGLE_SEARCH_EVENT, handler);
    return () => window.removeEventListener(TOGGLE_SEARCH_EVENT, handler);
  }, []);

  // Run search
  const runSearch = useCallback(async () => {
    setLoading(true);
    const filters: SearchFilters = {
      query: queryParam,
      category: selectedCategory || undefined,
      minPrice: priceRange[0] > 0 ? priceRange[0] : undefined,
      maxPrice: priceRange[1] < 500 ? priceRange[1] : undefined,
      sizes: selectedSizes.length > 0 ? selectedSizes : undefined,
      colors: selectedColors.length > 0 ? selectedColors : undefined,
      sortBy,
    };
    const results = await searchProducts(filters);
    setProducts(results);
    setLoading(false);
  }, [queryParam, selectedCategory, priceRange, selectedSizes, selectedColors, sortBy]);

  // Visual search results (from sessionStorage when ?visual=true)
  useEffect(() => {
    const visual = searchParams.get("visual") === "true";
    if (!visual) return;
    const raw = sessionStorage.getItem("visual-search-results");
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as { products?: Array<{ id: string; name: string; name_fr: string; price: number; currency: string; description?: string; rating?: number; review_count?: number; store_id?: string; image: string }>; keywords?: { keywords_fr?: string[]; product_type?: string } };
      const list = data.products || [];
      const mapped: Product[] = list.map((p) => ({
        id: p.id,
        name: p.name,
        nameFr: p.name_fr || p.name,
        price: p.price,
        currency: p.currency || "USD",
        image: p.image || "/placeholder.svg",
        category: data.keywords?.product_type || "",
        categoryFr: data.keywords?.product_type || "",
        rating: p.rating ?? 0,
        reviewCount: p.review_count ?? 0,
        description: p.description,
        storeId: p.store_id,
      }));
      setProducts(mapped);
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get("visual") === "true") return;
    runSearch();
  }, [runSearch, searchParams]);

  const clearFilters = () => {
    setSelectedCategory("");
    setPriceRange([0, 500]);
    setSelectedSizes([]);
    setSelectedColors([]);
    setSortBy("relevance");
  };

  const activeFilterCount =
    (selectedCategory ? 1 : 0) +
    (priceRange[0] > 0 || priceRange[1] < 500 ? 1 : 0) +
    selectedSizes.length +
    selectedColors.length;

  const toggleSize = (size: string) =>
    setSelectedSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );

  const toggleColor = (hex: string) =>
    setSelectedColors((prev) =>
      prev.includes(hex) ? prev.filter((c) => c !== hex) : [...prev, hex]
    );

  const FilterSidebar = () => (
    <div className="space-y-1">
      {/* Category */}
      <div className="border-b border-border pb-3">
        <button onClick={() => toggleSection("category")} className="flex items-center justify-between w-full py-2 text-sm font-semibold text-foreground">
          {t("search.category")}
          {openSections.category ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {openSections.category && (
          <div className="space-y-1.5 mt-1 max-h-48 overflow-y-auto">
            <button
              onClick={() => setSelectedCategory("")}
              className={`block text-xs w-full text-left px-2 py-1 rounded transition-colors ${!selectedCategory ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted"}`}
            >
              {t("search.allProducts")}
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.name)}
                className={`block text-xs w-full text-left px-2 py-1 rounded transition-colors ${selectedCategory === cat.name ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted"}`}
              >
                {labelOf(cat)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Price */}
      <div className="border-b border-border pb-3">
        <button onClick={() => toggleSection("price")} className="flex items-center justify-between w-full py-2 text-sm font-semibold text-foreground">
          {t("search.price")} (USD)
          {openSections.price ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {openSections.price && (
          <div className="mt-2 px-1">
            <Slider
              value={priceRange}
              onValueChange={(v) => setPriceRange(v as [number, number])}
              min={0}
              max={500}
              step={5}
              className="mb-2"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{formatPrice(priceRange[0])}</span>
              <span>{formatPrice(priceRange[1])}{priceRange[1] >= 500 ? "+" : ""}</span>
            </div>
          </div>
        )}
      </div>

      {/* Size */}
      <div className="border-b border-border pb-3">
        <button onClick={() => toggleSection("size")} className="flex items-center justify-between w-full py-2 text-sm font-semibold text-foreground">
          {t("search.size")}
          {openSections.size ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {openSections.size && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {allSizes.map((size) => (
              <button
                key={size}
                onClick={() => toggleSize(size)}
                className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                  selectedSizes.includes(size)
                    ? "bg-foreground text-card border-foreground"
                    : "bg-card text-foreground border-border hover:border-foreground"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Color */}
      <div className="pb-3">
        <button onClick={() => toggleSection("color")} className="flex items-center justify-between w-full py-2 text-sm font-semibold text-foreground">
          {t("search.color")}
          {openSections.color ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {openSections.color && (
          <div className="flex flex-wrap gap-2 mt-1">
            {allColors.map((color) => (
              <button
                key={color.hex}
                onClick={() => toggleColor(color.hex)}
                title={color.name}
                className={`w-7 h-7 rounded-full border-2 transition-all ${
                  selectedColors.includes(color.hex) ? "border-foreground scale-110 ring-2 ring-primary/30" : "border-border hover:border-muted-foreground"
                }`}
                style={{ backgroundColor: color.hex }}
              />
            ))}
          </div>
        )}
      </div>

      {activeFilterCount > 0 && (
        <button onClick={clearFilters} className="w-full text-xs text-destructive hover:underline py-2">
          {t("search.filters")} ({activeFilterCount}) ✕
        </button>
      )}
    </div>
  );

  const seoTitle = queryParam
    ? (locale === "fr" ? `Résultats pour "${queryParam}" — Recherche` : `Results for "${queryParam}" — Search`)
    : (locale === "fr" ? "Rechercher des produits" : "Search products");
  const seoDesc = queryParam
    ? (locale === "fr"
        ? `Trouvez "${queryParam}" parmi des milliers de produits mode, tech et maison sur Zandofy. Prix compétitifs et livraison rapide en Afrique.`
        : `Find "${queryParam}" among thousands of fashion, tech and home products on Zandofy. Competitive prices and fast delivery across Africa.`)
    : (locale === "fr"
        ? "Recherchez parmi des milliers de produits mode, électronique et maison sur Zandofy. Filtrez par catégorie, prix et taille."
        : "Search thousands of fashion, electronics and home products on Zandofy. Filter by category, price and size.");

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead title={seoTitle} description={seoDesc} canonical={`/search${queryParam ? `?q=${encodeURIComponent(queryParam)}` : ""}`} />
      <Header />

      <main className="flex-1">
        {/* Mobile search bar toggled from bottom nav */}
        {mobileSearchOpen && (
          <div className="lg:hidden px-4 py-2 border-b border-border bg-card animate-fade-in sticky top-0 z-[55] shadow-md">
            <PredictiveSearch mobile onClose={() => setMobileSearchOpen(false)} />
          </div>
        )}
        <div className="container py-4">
          {/* Top bar: query + sort + mobile filter toggle */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2 min-w-0">
              <Search size={16} className="text-muted-foreground shrink-0" />
              <h1 className="text-sm md:text-base font-semibold text-foreground truncate">
                {queryParam ? (
                  <>{t("search.results")} « <span className="text-primary">{queryParam}</span> »</>
                ) : (
                  t("search.allProducts")
                )}
              </h1>
              {!loading && (
                <span className="text-xs text-muted-foreground shrink-0">({products.length})</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Mobile filter button */}
              <button
                onClick={() => setMobileFiltersOpen(true)}
                className="lg:hidden flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-border rounded-full hover:bg-muted"
              >
                <SlidersHorizontal size={13} />
                {t("search.filters")}
                {activeFilterCount > 0 && (
                  <span className="w-4 h-4 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {/* Sort */}
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SearchFilters["sortBy"])}>
                <SelectTrigger className="w-[150px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-6">
            {/* Desktop sidebar */}
            <aside className="hidden lg:block w-56 shrink-0">
              <div className="sticky top-[130px]">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">{t("search.filters")}</h3>
                <FilterSidebar />
              </div>
            </aside>

            {/* Product grid */}
            <div className="flex-1">
              {loading ? (
                <div className={PRODUCT_GRID_CLASS}>
                  {Array.from({ length: 12 }).map((_, i) => (
                    <ProductCardSkeleton key={i} />
                  ))}
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-16">
                  <Search size={40} className="mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">{t("search.noResults")}</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">{t("search.tryOther")}</p>
                </div>
              ) : (
                <div className={PRODUCT_GRID_CLASS}>
                  {products.map((product, i) => (
                    <Link to={`/product/${product.slug || product.id}`} key={product.id} className="block">
                      <ProductCard product={product} index={i} />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Mobile filters drawer */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/40" onClick={() => setMobileFiltersOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-[300px] bg-card shadow-xl overflow-y-auto animate-fade-in">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-sm font-bold text-foreground">{t("search.filters")}</h3>
              <button onClick={() => setMobileFiltersOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="p-4">
              <FilterSidebar />
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
