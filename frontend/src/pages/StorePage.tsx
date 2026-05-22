import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fetchProducts, type Product } from "@/services/api";
import { computeStoreYears, formatStoreYears } from "@/lib/store-years";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";
import { VerificationBadge } from "@/components/VerificationBadge";
import { CertificationBadge } from "@/components/CertificationBadge";
import { FollowStoreButton } from "@/components/FollowStoreButton";
import {
  Store, Users, Package, TrendingUp, Star,
  MessageCircle, ShieldCheck, SlidersHorizontal,
  Grid3X3, LayoutList, Clock, Zap, X, ChevronDown, ChevronUp, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InternalChat } from "@/components/InternalChat";
import { Progress } from "@/components/ui/progress";
import { StoreReviewForm } from "@/components/reviews/StoreReviewForm";
import { StoreReviewsList } from "@/components/reviews/StoreReviewsList";
import { openStoreWhatsApp } from "@/lib/whatsapp";

interface StoreData {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  is_verified: boolean | null;
  verified_years: number | null;
  verified_years_override: number | null;
  created_at: string | null;
  followers_count: number | null;
  products_count: number | null;
  repurchase_rate: string | null;
  sales_count: number | null;
  sales_trend: string | null;
  is_online: boolean | null;
  whatsapp_number: string | null;
  rating: number | null;
  response_rate: string | null;
  response_time: string | null;
  max_products_limit: number | null;
  followers_override: number | null;
  sales_override: number | null;
  is_certified: boolean | null;
  city: string | null;
  country: string | null;
}

interface StoreReview {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  user_id: string;
  profile?: { first_name: string | null; last_name: string | null; avatar_url: string | null };
}

const SORT_OPTIONS = [
  { value: "newest", label: "Nouveautés" },
  { value: "price_asc", label: "Prix croissant" },
  { value: "price_desc", label: "Prix décroissant" },
  { value: "popular", label: "Populaires" },
  { value: "rating", label: "Mieux notés" },
];

export default function StorePage() {
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const [sortBy, setSortBy] = useState("newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeTab, setActiveTab] = useState<"products" | "reviews">("products");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 500]);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [whatsappLoading, setWhatsappLoading] = useState(false);

  // Resolve store by slug or UUID
  const isUUID = id ? /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) : false;

  const { data: store, isLoading: storeLoading } = useQuery({
    queryKey: ["store", id],
    queryFn: async () => {
      let data: any = null;
      let error: any = null;
      if (isUUID) {
        const res = await (supabase as any).from("stores_public").select("*").eq("id", id!).maybeSingle();
        data = res.data; error = res.error;
      } else {
        const res = await (supabase as any).from("stores_public").select("*").eq("slug", id!).maybeSingle();
        data = res.data; error = res.error;
      }
      if (error || !data) return null;
      return data as StoreData;
    },
    enabled: !!id,
  });

  // Check if store is banned — show unavailable message
  const isBannedStore = !!(store as any)?.is_banned;

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["store-products", store?.id],
    queryFn: async () => {
      return await fetchProducts({ storeId: store!.id });
    },
    enabled: !!store?.id,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Fetch reviews for all store products
  const { data: storeReviews } = useQuery({
    queryKey: ["store-reviews", id],
    queryFn: async () => {
      if (!products || products.length === 0) return [];
      const productIds = products.map((p) => p.id);
      const { data, error } = await (supabase as any)
        .from("reviews")
        .select("id, rating, comment, created_at, user_id, profiles:user_id(first_name, last_name, avatar_url)")
        .in("product_id", productIds)
        .eq("is_approved", true)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) return [];
      return (data || []) as any[];
    },
    enabled: !!products && products.length > 0,
  });

  // Extract unique categories from store products
  const storeCategories = useMemo(() => {
    if (!products) return [];
    const cats = new Set<string>();
    products.forEach((p) => {
      if (p.categoryFr) cats.add(p.categoryFr);
      else if (p.category) cats.add(p.category);
    });
    return Array.from(cats).sort();
  }, [products]);

  // Review stats
  const reviewStats = useMemo(() => {
    if (!storeReviews || storeReviews.length === 0) return null;
    const total = storeReviews.length;
    const avg = storeReviews.reduce((s: number, r: any) => s + r.rating, 0) / total;
    const dist = [0, 0, 0, 0, 0];
    storeReviews.forEach((r: any) => { dist[r.rating - 1]++; });
    return { total, avg, dist };
  }, [storeReviews]);

  // Filter & sort products
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    let result = [...products];

    // Category filter
    if (selectedCategory) {
      result = result.filter(
        (p) => p.categoryFr === selectedCategory || p.category === selectedCategory
      );
    }

    // Price filter
    if (priceRange[0] > 0) {
      result = result.filter((p) => p.price >= priceRange[0]);
    }
    if (priceRange[1] < 500) {
      result = result.filter((p) => p.price <= priceRange[1]);
    }

    // Sort
    switch (sortBy) {
      case "price_asc": return result.sort((a, b) => a.price - b.price);
      case "price_desc": return result.sort((a, b) => b.price - a.price);
      case "popular": return result.sort((a, b) => b.reviewCount - a.reviewCount);
      case "rating": return result.sort((a, b) => b.rating - a.rating);
      default: return result;
    }
  }, [products, sortBy, selectedCategory, priceRange]);

  const activeFilterCount =
    (selectedCategory ? 1 : 0) +
    (priceRange[0] > 0 || priceRange[1] < 500 ? 1 : 0);

  const clearFilters = () => {
    setSelectedCategory("");
    setPriceRange([0, 500]);
  };

  const realFollowers = store?.followers_override ?? store?.followers_count ?? 0;
  const realSales = store?.sales_override ?? store?.sales_count ?? 0;
  const realArticles = products?.length ?? 0;

  const stats = [
    { icon: Package, label: "Articles", value: realArticles },
    {
      icon: Users, label: "Abonnés",
      value: realFollowers >= 1000 ? `${(realFollowers / 1000).toFixed(0)}K` : realFollowers,
    },
    { icon: TrendingUp, label: "Vendus", value: realSales },
    { icon: Star, label: "Note", value: reviewStats ? `${reviewStats.avg.toFixed(1)}/5` : "—" },
    { icon: Zap, label: "Réactivité", value: store?.response_rate || "—" },
    { icon: Clock, label: "Temps rép.", value: store?.response_time || "—" },
  ];

  const FilterPanel = () => (
    <div className="space-y-4">
      {/* Category */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Catégorie</h4>
        <div className="space-y-1">
          <button
            onClick={() => setSelectedCategory("")}
            className={`block text-xs w-full text-left px-2 py-1.5 rounded transition-colors ${!selectedCategory ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted"}`}
          >
            Toutes
          </button>
          {storeCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`block text-xs w-full text-left px-2 py-1.5 rounded transition-colors ${selectedCategory === cat ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted"}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Price range */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Prix (USD)</h4>
        <Slider
          value={priceRange}
          onValueChange={(v) => setPriceRange(v as [number, number])}
          min={0}
          max={500}
          step={5}
          className="mb-2"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>${priceRange[0]}</span>
          <span>${priceRange[1]}{priceRange[1] >= 500 ? "+" : ""}</span>
        </div>
      </div>

      {activeFilterCount > 0 && (
        <button onClick={clearFilters} className="w-full text-xs text-destructive hover:underline py-2">
          Effacer les filtres ({activeFilterCount})
        </button>
      )}
    </div>
  );

  const seoTitle = store ? `${store.name} — Boutique` : "Boutique";
  const seoDesc = store
    ? `Découvrez la boutique ${store.name} sur Zandofy. ${store.description?.slice(0, 120) || "Produits de qualité, vendeur vérifié."}`
    : "Découvrez cette boutique sur Zandofy.";

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={seoTitle}
        description={seoDesc}
        canonical={store ? `/store/${store.slug || store.id}` : undefined}
        ogImage={store?.logo_url || undefined}
      />
      <Header />

      <main>
        {storeLoading ? (
          <div className="space-y-4 container py-6">
            <Skeleton className="h-48 w-full rounded-sm" />
            <div className="flex items-center gap-4">
              <Skeleton className="w-20 h-20 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          </div>
        ) : !store ? (
          <div className="text-center py-20 container">
            <Store size={48} className="mx-auto text-muted-foreground/30 mb-4" />
            <h1 className="text-2xl font-bold text-foreground">Boutique introuvable</h1>
            <Link to="/" className="text-primary underline mt-4 inline-block">
              Retour à l'accueil
            </Link>
          </div>
        ) : isBannedStore ? (
          <div className="text-center py-20 container">
            <Store size={48} className="mx-auto text-destructive/30 mb-4" />
            <h1 className="text-2xl font-bold text-foreground">Boutique indisponible</h1>
            <p className="text-muted-foreground mt-2">Cette boutique a été suspendue pour non-respect des règles de la plateforme.</p>
            <Link to="/stores" className="text-primary underline mt-4 inline-block">
              Voir d'autres boutiques
            </Link>
          </div>
        ) : (
          <>
            {/* ═══ HERO BANNER ═══ */}
            <div className="relative bg-muted">
              {store.banner_url ? (
                <img
                  src={store.banner_url}
                  alt={`Bannière ${store.name}`}
                  className="w-full h-44 md:h-64 object-contain"
                />
              ) : (
                <div className="w-full h-44 md:h-64 bg-brand-gradient opacity-90" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
            </div>

            {/* ═══ STORE PROFILE CARD ═══ */}
            <div className="container -mt-16 relative z-10">
              <div className="bg-card border border-border rounded-sm shadow-card overflow-hidden">
                <div className="px-4 md:px-6 pt-4 pb-5 flex flex-col md:flex-row md:items-end gap-4">
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    {store.logo_url ? (
                      <img
                        src={store.logo_url}
                        alt={store.name}
                        className="w-24 h-24 md:w-28 md:h-28 rounded-full object-cover border-4 border-card shadow-card"
                      />
                    ) : (
                      <div className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-primary border-4 border-card flex items-center justify-center shadow-card">
                        <Store size={32} className="text-primary-foreground" />
                      </div>
                    )}
                    {/* Online indicator — bottom-right of avatar */}
                    <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center">
                      {store.is_online && (
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      )}
                      <span
                        className={`relative inline-flex h-4 w-4 rounded-full border-2 border-card ${
                          store.is_online
                            ? "bg-emerald-500 shadow-[0_0_8px_2px_rgba(16,185,129,0.5)]"
                            : "bg-amber-500/60"
                        }`}
                      />
                    </span>
                  </div>

                  {/* Name + info */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-xl md:text-2xl font-bold text-foreground truncate">
                        {store.name}
                      </h1>
                      {store.is_certified && (
                        <CertificationBadge type="vendor" variant="icon-only" />
                      )}
                      {(() => {
                        const years = computeStoreYears(store.verified_years_override, store.verified_years, store.created_at);
                        const label = formatStoreYears(years);
                        return (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                            <ShieldCheck size={12} />
                            {label}
                          </span>
                        );
                      })()}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {store.is_online ? (
                        <span className="text-emerald-600 font-medium">En ligne</span>
                      ) : <span className="text-amber-600">Hors ligne</span>}
                      {(store.city || store.country) && (
                        <span className="ml-2 text-muted-foreground">
                          📍 {[store.city, store.country].filter(Boolean).join(", ")}
                        </span>
                      )}
                    </p>
                    {store.description && (
                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mt-1">{store.description}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 shrink-0">
                    <FollowStoreButton storeId={store.id} storeName={store.name} size="sm" />
                    <Sheet>
                      <SheetTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1.5">
                          <MessageCircle size={14} /> Contacter
                        </Button>
                      </SheetTrigger>
                      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
                        <SheetHeader className="px-4 pt-4 pb-2 border-b border-border">
                          <SheetTitle className="flex items-center gap-2">
                            <MessageCircle size={18} /> Chat avec {store.name}
                          </SheetTitle>
                        </SheetHeader>
                        <div className="flex-1 overflow-hidden">
                          <InternalChat storeId={store.id} storeName={store.name} />
                        </div>
                      </SheetContent>
                    </Sheet>
                    {user && (
                      <Button
                        type="button"
                        size="sm"
                        disabled={whatsappLoading}
                        onClick={async () => {
                          if (whatsappLoading) return;
                          setWhatsappLoading(true);
                          try {
                            await openStoreWhatsApp(
                              store.id,
                              `Bonjour, je suis intéressé par votre boutique "${store.name}" sur Zandofy.`,
                            );
                          } finally {
                            setWhatsappLoading(false);
                          }
                        }}
                        className="gap-1.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white border-0"
                      >
                          {whatsappLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                          </svg>
                          )}
                          {whatsappLoading ? "Ouverture…" : "WhatsApp"}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 md:grid-cols-6 border-t border-border">
                  {stats.map(({ icon: Icon, label, value }) => (
                    <div
                      key={label}
                      className="flex flex-col items-center gap-1 py-3 border-r border-border last:border-r-0"
                    >
                      <Icon size={16} className="text-primary" />
                      <span className="text-sm md:text-base font-bold text-foreground">{value}</span>
                      <span className="text-[10px] md:text-xs text-muted-foreground">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ═══ TAB SWITCHER ═══ */}
            <div className="container pt-6">
              <div className="flex gap-1 border-b border-border mb-4">
                <button
                  onClick={() => setActiveTab("products")}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "products"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Package size={14} className="inline mr-1.5" />
                  Articles ({products?.length || 0})
                </button>
                <button
                  onClick={() => setActiveTab("reviews")}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === "reviews"
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Star size={14} className="inline mr-1.5" />
                  Avis ({reviewStats?.total || 0})
                </button>
              </div>
            </div>

            {activeTab === "products" && (
              <div className="container pb-6">
                {/* Toolbar */}
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    {/* Mobile filter button */}
                    <button
                      onClick={() => setMobileFiltersOpen(true)}
                      className="lg:hidden flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-border rounded-full hover:bg-muted"
                    >
                      <SlidersHorizontal size={13} />
                      Filtres
                      {activeFilterCount > 0 && (
                        <span className="w-4 h-4 bg-primary text-primary-foreground text-[10px] rounded-full flex items-center justify-center">
                          {activeFilterCount}
                        </span>
                      )}
                    </button>
                    <span className="text-sm text-muted-foreground">{filteredProducts.length} résultats</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="hidden md:flex border border-border rounded-sm overflow-hidden">
                      <button
                        onClick={() => setViewMode("grid")}
                        className={`p-1.5 transition-colors ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}
                      >
                        <Grid3X3 size={16} />
                      </button>
                      <button
                        onClick={() => setViewMode("list")}
                        className={`p-1.5 transition-colors ${viewMode === "list" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}
                      >
                        <LayoutList size={16} />
                      </button>
                    </div>

                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-[150px] h-8 text-xs">
                        <SlidersHorizontal size={12} className="mr-1" />
                        <SelectValue placeholder="Trier" />
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
                  {/* Desktop sidebar filters */}
                  <aside className="hidden lg:block w-52 shrink-0">
                    <div className="sticky top-[130px]">
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Filtres</h3>
                      <FilterPanel />
                    </div>
                  </aside>

                  {/* Grid */}
                  <div className="flex-1">
                    {productsLoading ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {Array.from({ length: 8 }).map((_, i) => (
                          <ProductCardSkeleton key={i} />
                        ))}
                      </div>
                    ) : filteredProducts.length > 0 ? (
                      <div className={
                        viewMode === "grid"
                          ? "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3"
                          : "grid grid-cols-1 md:grid-cols-2 gap-3"
                      }>
                        {filteredProducts.map((product) => (
                          <Link to={`/product/${product.slug || product.id}`} key={product.id}>
                            <ProductCard product={product} />
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-16 text-muted-foreground">
                        <Package size={40} className="mx-auto mb-3 opacity-30" />
                        <p className="text-sm">Aucun article trouvé avec ces filtres.</p>
                        {activeFilterCount > 0 && (
                          <button onClick={clearFilters} className="text-xs text-primary mt-2 hover:underline">
                            Effacer les filtres
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "reviews" && (
              <div className="container pb-6">
                <div className="max-w-2xl space-y-6">
                  {/* Store review form */}
                  <StoreReviewForm
                    storeId={store.id}
                    onSuccess={() => {}}
                  />

                  {/* Store reviews list */}
                  <StoreReviewsList storeId={store.id} />
                </div>
              </div>
            )}

            {/* Mobile filters drawer */}
            {mobileFiltersOpen && (
              <div className="fixed inset-0 z-50 lg:hidden">
                <div className="absolute inset-0 bg-foreground/40" onClick={() => setMobileFiltersOpen(false)} />
                <div className="absolute right-0 top-0 bottom-0 w-[300px] bg-card shadow-xl overflow-y-auto animate-fade-in">
                  <div className="flex items-center justify-between p-4 border-b border-border">
                    <h3 className="text-sm font-bold text-foreground">Filtres</h3>
                    <button onClick={() => setMobileFiltersOpen(false)}>
                      <X size={18} />
                    </button>
                  </div>
                  <div className="p-4">
                    <FilterPanel />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
