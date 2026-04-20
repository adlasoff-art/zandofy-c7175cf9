import { useMemo, useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ProductCard } from "@/components/ProductCard";
import { FloatingActions } from "@/components/FloatingActions";
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";
import { SEOHead, buildBreadcrumbJsonLd } from "@/components/SEOHead";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { SlidersHorizontal, X } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { slugify } from "@/utils/slugify";

function mapProduct(row: any) {
  const sortedImages = (row.product_images || []).sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
  return {
    id: row.id,
    slug: row.slug || "",
    name: row.name,
    nameFr: row.name_fr,
    price: Number(row.price),
    originalPrice: row.original_price ? Number(row.original_price) : undefined,
    currency: row.currency,
    image: sortedImages[0]?.image_url || "/placeholder.svg",
    galleryImages: sortedImages,
    category: row.categories?.name || "",
    categoryFr: row.categories?.name_fr || "",
    rating: Number(row.rating) || 0,
    reviewCount: row.review_count || 0,
    isNew: row.is_new || false,
    isSale: row.is_sale || false,
    discount: row.discount || 0,
    colors: row.product_colors?.map((c: any) => c.color_hex) || [],
    sizes: row.product_sizes?.map((s: any) => s.size_label) || [],
    moq: row.moq || 1,
    verifiedYears: row.verified_years || 0,
    originCountry: row.origin_country || "",
    sku: row.sku || "",
    storeId: row.store_id || "",
    storeIsCertified: row.stores?.is_certified || false,
    storeIsVerified: row.stores?.is_verified || false,
  };
}

const SPECIAL_SLUGS = ["nouveautes", "soldes"];

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const { t } = useI18n();
  const isSpecial = SPECIAL_SLUGS.includes(slug?.toLowerCase() || "");

  // Filters state
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<string>("recent");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Fetch newness duration setting
  const { data: newnessDays } = useQuery({
    queryKey: ["newness-duration"],
    queryFn: async () => {
      const { data } = await supabase.from("platform_settings").select("value").eq("key", "newness_duration_days").maybeSingle();
      return data?.value ? Number(data.value) : 14;
    },
    staleTime: 60 * 1000,
    enabled: slug?.toLowerCase() === "nouveautes",
  });

  // Fetch category by name (slug = name lowercased)
  const { data: category, isLoading: catLoading } = useQuery({
    queryKey: ["category", slug],
    queryFn: async () => {
      if (isSpecial) return { id: slug!, name: slug!, name_fr: slug === "nouveautes" ? "Nouveautés" : "Soldes", icon: slug === "nouveautes" ? "🆕" : "🔥", subcategories: [], parent: null };
      
      const decodedSlug = decodeURIComponent(slug || "").toLowerCase().trim();
      const normalizedSlug = slugify(decodedSlug);
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, name_fr, icon, parent_id, image_url")
        .order("name");
      if (error) throw error;
      const all = data || [];
      // Match by slugified name, slugified name_fr, raw name, name_fr, or ID
      const match = all.find(
        (c) =>
          slugify(c.name) === normalizedSlug ||
          slugify(c.name_fr) === normalizedSlug ||
          c.name.toLowerCase().trim() === decodedSlug ||
          c.name_fr.toLowerCase().trim() === decodedSlug ||
          c.id === slug
      );
      if (!match) return null;
      const subs = all.filter((c) => c.parent_id === match.id);
      const parent = match.parent_id ? all.find((c) => c.id === match.parent_id) : null;
      return { ...match, subcategories: subs, parent };
    },
    enabled: !!slug,
    retry: 2,
  });

  // Fetch products
  const { data: products, isLoading: prodsLoading } = useQuery({
    queryKey: ["category-products", category?.id, slug],
    queryFn: async () => {
      if (!category) return [];

      let query = supabase
        .from("products")
        .select(`*, categories(name, name_fr), product_images(image_url, position), product_colors(color_hex, color_name), product_sizes(size_label), stores!products_store_id_fkey(is_certified, is_verified)`)
        .eq("publish_status", "published");

      if (slug?.toLowerCase() === "nouveautes") {
        // Products created within newness_duration_days OR marked is_new
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - (newnessDays || 14));
        query = query.or(`is_new.eq.true,created_at.gte.${cutoff.toISOString()}`);
      } else if (slug?.toLowerCase() === "soldes") {
        // Products on sale
        query = query.eq("is_sale", true);
      } else {
        // Regular category
        const catIds = [category.id, ...(category.subcategories || []).map((s: any) => s.id)];
        query = query.in("category_id", catIds);
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map(mapProduct);
    },
    enabled: !!category,
  });

  // Extract available sizes and colors from products
  const availableSizes = useMemo(() => {
    if (!products) return [];
    const sizes = new Set<string>();
    products.forEach((p) => p.sizes?.forEach((s: string) => sizes.add(s)));
    return Array.from(sizes).sort();
  }, [products]);

  const availableColors = useMemo(() => {
    if (!products) return [];
    const colors = new Set<string>();
    products.forEach((p) => p.colors?.forEach((c: string) => colors.add(c)));
    return Array.from(colors);
  }, [products]);

  // Apply filters
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    let result = products;

    // Price filter
    result = result.filter((p) => p.price >= priceRange[0] && p.price <= priceRange[1]);

    // Size filter
    if (selectedSizes.length > 0) {
      result = result.filter((p) => p.sizes?.some((s: string) => selectedSizes.includes(s)));
    }

    // Color filter
    if (selectedColors.length > 0) {
      result = result.filter((p) => p.colors?.some((c: string) => selectedColors.includes(c)));
    }

    // Sort
    switch (sortBy) {
      case "price-asc": result = [...result].sort((a, b) => a.price - b.price); break;
      case "price-desc": result = [...result].sort((a, b) => b.price - a.price); break;
      case "rating": result = [...result].sort((a, b) => (b.rating || 0) - (a.rating || 0)); break;
      case "recent":
      default: break; // already sorted by created_at desc
    }

    return result;
  }, [products, priceRange, selectedSizes, selectedColors, sortBy]);

  const activeFiltersCount = (selectedSizes.length > 0 ? 1 : 0) + (selectedColors.length > 0 ? 1 : 0) + (priceRange[0] > 0 || priceRange[1] < 10000 ? 1 : 0);

  if (catLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-8">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-40 w-full mb-6 rounded-lg" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="aspect-[3/4] rounded-sm" />)}
          </div>
        </main>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-bold text-foreground">{t("filter.categoryNotFound")}</h1>
          <Link to="/" className="text-primary underline mt-4 inline-block">{t("product.backToHome")}</Link>
        </main>
        <Footer />
      </div>
    );
  }

  const seoTitle = `${category.name_fr} — Acheter en ligne`;
  const seoDesc = `Découvrez ${filteredProducts?.length || 0} produits ${category.name_fr} sur Zandofy. Livraison rapide, prix compétitifs.`;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={seoTitle}
        description={seoDesc}
        canonical={`/category/${slug}`}
        jsonLd={buildBreadcrumbJsonLd([
          { name: "Accueil", url: "/" },
          ...(category.parent ? [{ name: category.parent.name_fr || category.parent.name || "Catégorie", url: `/category/${slugify(category.parent.name)}` }] : []),
          { name: category.name_fr || category.name || slug, url: `/category/${slugify(category.name || slug || "")}` },
        ])}
      />
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-4">
        {/* Breadcrumb */}
        <Breadcrumb className="mb-4">
          <BreadcrumbList>
            <BreadcrumbItem><BreadcrumbLink asChild><Link to="/">{t("general.home")}</Link></BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            {category.parent && (
              <>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to={`/category/${slugify(category.parent.name)}`}>{category.parent.name_fr}</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
              </>
            )}
            <BreadcrumbItem><BreadcrumbPage>{category.name_fr}</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Category Banner */}
        <div className="rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border border-border p-6 mb-6">
          <div className="flex items-center gap-3">
            {category.icon && <span className="text-3xl">{category.icon}</span>}
            <div>
              <h1 className="text-2xl font-bold text-foreground">{category.name_fr}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                {filteredProducts?.length || 0} {t("filter.products")}
              </p>
            </div>
          </div>
        </div>

        {/* Subcategories */}
        {!isSpecial && category.subcategories && category.subcategories.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-foreground mb-3">{t("filter.subcategories")}</h2>
            <div className="flex gap-2 flex-wrap">
              {category.subcategories.map((sub: any) => (
                <Link
                  key={sub.id}
                  to={`/category/${slugify(sub.name)}`}
                  className="px-4 py-2 text-sm rounded-full border border-border bg-card text-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  {sub.icon && <span className="mr-1">{sub.icon}</span>}
                  {sub.name_fr}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Filters & Sort Bar */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <button
            onClick={() => setFiltersOpen(!filtersOpen)}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-border rounded-lg bg-card text-foreground hover:border-primary transition-colors"
          >
            <SlidersHorizontal size={14} />
            {t("filter.filters")}
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{activeFiltersCount}</Badge>
            )}
          </button>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
             <option value="recent">{t("filter.recent")}</option>
             <option value="price-asc">{t("filter.priceAsc")}</option>
             <option value="price-desc">{t("filter.priceDesc")}</option>
             <option value="rating">{t("filter.bestRated")}</option>
          </select>
        </div>

        {/* Filters panel */}
        {filtersOpen && (
          <div className="bg-card border border-border rounded-xl p-4 mb-6 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">{t("filter.filters")}</h3>
              <button
                onClick={() => { setPriceRange([0, 10000]); setSelectedSizes([]); setSelectedColors([]); }}
                className="text-xs text-primary hover:underline"
              >
                {t("filter.reset")}
              </button>
            </div>

            {/* Price range */}
            <div className="space-y-2">
              <Label className="text-xs">{t("filter.price")} (USD)</Label>
              <Slider
                value={priceRange}
                onValueChange={(v) => setPriceRange(v as [number, number])}
                min={0}
                max={10000}
                step={10}
                className="mt-2"
              />
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>${priceRange[0]}</span>
                <span>—</span>
                <span>${priceRange[1]}</span>
              </div>
            </div>

            {/* Sizes */}
            {availableSizes.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs">{t("filter.sizes")}</Label>
                <div className="flex flex-wrap gap-1.5">
                  {availableSizes.map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSizes((prev) => prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size])}
                      className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                        selectedSizes.includes(size)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-foreground border-border hover:border-primary"
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Colors */}
            {availableColors.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs">{t("filter.colors")}</Label>
                <div className="flex flex-wrap gap-2">
                  {availableColors.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColors((prev) => prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color])}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${
                        selectedColors.includes(color) ? "border-primary scale-110 ring-2 ring-primary/30" : "border-border"
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Active filter badges */}
        {activeFiltersCount > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {(priceRange[0] > 0 || priceRange[1] < 10000) && (
              <Badge variant="outline" className="gap-1 text-xs">
                ${priceRange[0]} - ${priceRange[1]}
                <X size={10} className="cursor-pointer" onClick={() => setPriceRange([0, 10000])} />
              </Badge>
            )}
            {selectedSizes.map((s) => (
              <Badge key={s} variant="outline" className="gap-1 text-xs">
                {s}
                <X size={10} className="cursor-pointer" onClick={() => setSelectedSizes((prev) => prev.filter((x) => x !== s))} />
              </Badge>
            ))}
            {selectedColors.map((c) => (
              <Badge key={c} variant="outline" className="gap-1 text-xs">
                <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: c }} />
                <X size={10} className="cursor-pointer" onClick={() => setSelectedColors((prev) => prev.filter((x) => x !== c))} />
              </Badge>
            ))}
          </div>
        )}

        {/* Products Grid */}
        {prodsLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <Skeleton key={i} className="aspect-[3/4] rounded-sm" />)}
          </div>
        ) : filteredProducts && filteredProducts.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map((p: any) => (
              <Link key={p.id} to={`/product/${p.slug || p.id}`} className="cursor-pointer">
                <ProductCard product={p} />
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center text-muted-foreground">
            {t("filter.noProducts")}
          </div>
        )}
      </main>
      <Footer />
      <FloatingActions />
    </div>
  );
}
