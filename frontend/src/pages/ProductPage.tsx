import { useState, useMemo, useRef, useEffect, lazy, Suspense } from "react";
import { ImageZoomLens } from "@/components/ImageZoomLens";
import { useI18n } from "@/contexts/I18nContext";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchProductBySlug, fetchProducts, fetchPricingTiers, type Product } from "@/services/api";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { imgUrl, imgSrcSet } from "@/lib/image-url";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { Footer } from "@/components/Footer";
import { FloatingActions } from "@/components/FloatingActions";
import { ProductCard } from "@/components/ProductCard";
import { ProductReviews } from "@/components/reviews/ProductReviews";
import { VerificationBadge } from "@/components/VerificationBadge";
import { CertificationBadge } from "@/components/CertificationBadge";
import { VendorProfileCard } from "@/components/VendorProfileCard";
import { FollowStoreButton } from "@/components/FollowStoreButton";
import { TieredPricingTable, calculateTieredPrice, type PricingTier } from "@/components/TieredPricingTable";
import { QuantitySelector } from "@/components/QuantitySelector";
import { FlashTimer } from "@/components/FlashTimer";
import { useToast } from "@/hooks/use-toast";
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Star, Heart, Share2, Copy, Check, ChevronLeft, ChevronRight, ShoppingCart,
  BadgeCheck, Ruler, Award, Truck, RotateCcw, ShieldCheck, Camera,
  MapPin, Globe, Trophy, Store, TrendingUp, Users, Link as LinkIcon,
} from "lucide-react";
import { getCountryName } from "@/components/vendor/CountryCombobox";
import { PrecisionShippingEstimate } from "@/components/PrecisionShippingEstimate";
import { SEOHead, buildProductJsonLd, buildBreadcrumbJsonLd, buildJsonLdGraph } from "@/components/SEOHead";
import { VariantOrderDrawer } from "@/components/VariantOrderDrawer";
import { slugify } from "@/utils/slugify";

// ─── Gallery from product_images ──────────────────────────────
interface GalleryItem {
  url: string;
  type: "image" | "video";
}

function getGalleryItems(product: Product): GalleryItem[] {
  // If product has real images from DB, use them
  const images = (product as any).galleryImages as Array<{ image_url: string; position: number | null }> | undefined;
  if (images && images.length > 0) {
    return images
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((img) => ({
        url: img.image_url,
        type: img.image_url.match(/\.(mp4|webm|mov)$/i) ? "video" as const : "image" as const,
      }));
  }
  return [{ url: product.image, type: "image" as const }];
}

const SIZE_REGIONS: Record<string, string[]> = {
  EU: ["XS", "S", "M", "L", "XL", "XXL"],
  FR: ["34", "36", "38", "40", "42", "44"],
  US: ["0", "2", "4", "6", "8", "10"],
  UK: ["4", "6", "8", "10", "12", "14"],
  JP: ["5", "7", "9", "11", "13", "15"],
};

// Reviews moved to src/components/reviews/ProductReviews.tsx

// ─── Component ─────────────────────────────────
export default function ProductPage() {
  const { t, formatPrice } = useI18n();
  const { addItem } = useCart();
  const { toast } = useToast();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { slug } = useParams<{ slug: string }>();
  const id = slug; // For backward compatibility in component logic
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedDynamic, setSelectedDynamic] = useState<Record<string, string>>({});
  const [sizeRegion, setSizeRegion] = useState("EU");
  const [copied, setCopied] = useState(false);
  const wishlisted = id ? isInWishlist(id) : false;
  const [shippingCountry, setShippingCountry] = useState("France");
  const [sizeUnit, setSizeUnit] = useState<"CM" | "IN">("CM");
  const [quantity, setQuantity] = useState<number | null>(null);
  const [variantDrawerOpen, setVariantDrawerOpen] = useState(false);
  const [pointsPerDollar, setPointsPerDollar] = useState(50);

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", slug],
    queryFn: () => fetchProductBySlug(slug!),
    enabled: !!slug,
  });

  const { data: relatedProducts } = useQuery({
    queryKey: ["related-products", product?.categoryId],
    queryFn: async () => {
      if (!product?.categoryId) return [];
      // First try: products in same subcategory
      let results = await fetchProducts({ categoryId: product.categoryId, limit: 12 });
      results = results.filter(p => p.id !== product.id);
      // Fallback: if < 6 results, try parent category
      if (results.length < 6 && product.categoryFr) {
        // Get parent category id
        const { data: cat } = await supabase
          .from("categories")
          .select("parent_id")
          .eq("id", product.categoryId)
          .maybeSingle();
        if (cat?.parent_id) {
          const parentResults = await fetchProducts({ categoryId: cat.parent_id, limit: 12 });
          const existingIds = new Set(results.map(r => r.id));
          existingIds.add(product.id);
          for (const pr of parentResults) {
            if (!existingIds.has(pr.id) && results.length < 6) {
              results.push(pr);
            }
          }
        }
      }
      return results.slice(0, 6);
    },
    enabled: !!product?.categoryId,
  });

  const { data: pricingTiersRaw } = useQuery({
    queryKey: ["pricing-tiers", id],
    queryFn: () => fetchPricingTiers(id!),
    enabled: !!id,
  });

  const { data: globalBulkTiers } = useQuery({
    queryKey: ["bulk-discount-tiers"],
    queryFn: async () => {
      const { data } = await supabase.from("platform_settings").select("value").eq("key", "bulk_discount_tiers").maybeSingle();
      return Array.isArray((data?.value as any)?.tiers) ? (data?.value as any).tiers : [];
    },
  });

  useEffect(() => {
    supabase.from("platform_settings").select("value").eq("key", "referral_settings").maybeSingle().then(({ data }) => {
      const v = data?.value as any;
      setPointsPerDollar(Number(v?.points_per_dollar) || 50);
    });
  }, []);

  const pricingTiers: PricingTier[] = useMemo(() => {
    const source = pricingTiersRaw && pricingTiersRaw.length > 0
      ? pricingTiersRaw
      : (globalBulkTiers || []).map((tier: any, index: number) => ({
          id: `global-${index}`,
          tier_label: `Palier ${index + 1}`,
          min_quantity: tier.min_quantity,
          discount_type: "percentage",
          discount_value: tier.discount_pct,
        }));

    return source.map((t: any) => ({
      id: t.id,
      tierLabel: t.tier_label,
      minQuantity: t.min_quantity,
      discountType: t.discount_type as "percentage" | "fixed",
      discountValue: Number(t.discount_value),
    }));
  }, [globalBulkTiers, pricingTiersRaw]);

  const moq = product?.moq || 1;
  const currentQty = quantity ?? moq;

  const tieredResult = useMemo(() => {
    if (!product || pricingTiers.length === 0) return null;
    return calculateTieredPrice(currentQty, pricingTiers, product.price);
  }, [currentQty, pricingTiers, product]);

  const currentUnitPrice = tieredResult?.unitPrice ?? product?.price ?? 0;
  const totalPrice = currentUnitPrice * currentQty;
  const totalSavings = tieredResult?.savings ?? 0;

  const gallery = useMemo(() => (product ? getGalleryItems(product) : []), [product]);
  const sizes = SIZE_REGIONS[sizeRegion] || SIZE_REGIONS.EU;

  const productSku = product?.sku || `SKU-${product?.id?.slice(0, 8) || "000000"}`;
  const copySku = () => {
    if (!product) return;
    navigator.clipboard.writeText(productSku);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const loyaltyPoints = Math.floor(totalPrice * pointsPerDollar);


  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="aspect-[3/4] skeleton-shimmer rounded-sm" />
            <div className="space-y-4">
              <div className="h-6 w-3/4 skeleton-shimmer rounded" />
              <div className="h-10 w-1/3 skeleton-shimmer rounded" />
              <div className="h-32 w-full skeleton-shimmer rounded" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-20 text-center">
          <h1 className="text-2xl font-bold text-foreground">{t("product.notFound")}</h1>
          <Link to="/" className="text-primary underline mt-4 inline-block">{t("product.backToHome")}</Link>
        </main>
        <Footer />
      </div>
    );
  }

  // integerPart/decimalPart now computed inline from currentUnitPrice

  const seoDescription = product.shortDescription || product.description?.slice(0, 155) || `${product.nameFr} — ${product.categoryFr} sur Zandofy`;
  const productJsonLd = buildProductJsonLd({
    name: product.nameFr,
    description: seoDescription,
    image: gallery[0]?.url || product.image,
    price: currentUnitPrice,
    currency: product.currency,
    rating: product.rating,
    reviewCount: product.reviewCount,
    sku: product.sku,
    storeName: (product as any).store?.name,
  });
  const categorySlug = slugify(product.category || product.categoryFr || "produit");
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: t("general.home") || "Accueil", url: "/" },
    { name: product.categoryFr || "Produit", url: `/category/${categorySlug}` },
    { name: product.nameFr || "Produit", url: `/product/${product.slug || product.id}` },
  ]);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={`${product.nameFr} — ${product.categoryFr}`}
        description={seoDescription}
        canonical={`/product/${product.slug || product.id}`}
        ogImage={gallery[0]?.url || product.image}
        ogType="product"
        jsonLd={buildJsonLdGraph(productJsonLd, breadcrumbJsonLd)}
      />
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-4">
        {/* Breadcrumbs */}
        <Breadcrumb className="mb-4">
          <BreadcrumbList>
            <BreadcrumbItem><BreadcrumbLink asChild><Link to="/">{t("general.home") || "Accueil"}</Link></BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbLink asChild><Link to={`/category/${categorySlug}`}>{product.categoryFr}</Link></BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage>{product.nameFr}</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* ═══ VENDOR HEADER (above gallery) ═══ */}
        {(product as any).store && (
          <VendorProfileCard
            store={(product as any).store}
            productName={product.nameFr}
            productId={product.id}
            originCountry={product.originCountry}
            productSku={product.sku}
            productPrice={formatPrice(currentUnitPrice)}
            productImage={gallery[0]?.url || product.image}
          />
        )}

        {/* ═══ MAIN LAYOUT ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10">

          {/* ─── LEFT: Gallery + Description + Upsells ─── */}
          <div className="space-y-4">
            {/* Gallery — fixed height, doesn't stretch with right column */}
            <div className="flex gap-3">
              <div className="hidden md:flex flex-col gap-2 w-16 shrink-0">
                {gallery.map((item, i) => (
                  <button key={i} onClick={() => setSelectedImage(i)}
                    className={`aspect-[3/4] rounded-sm overflow-hidden border-2 transition-colors ${selectedImage === i ? "border-primary" : "border-border/40"}`}>
                    {item.type === "video" ? (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <Camera size={14} className="text-muted-foreground" />
                      </div>
                    ) : (
                      <img src={imgUrl(item.url, { width: 160 })} alt={`Vue ${i + 1}`} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                    )}
                  </button>
                ))}
              </div>
              <div className="relative flex-1 aspect-[3/4] max-h-[520px] rounded-sm overflow-hidden bg-muted">
                {gallery[selectedImage]?.type === "video" ? (
                  <video
                    key={gallery[selectedImage].url}
                    src={gallery[selectedImage].url}
                    autoPlay
                    muted
                    loop
                    playsInline
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <ImageZoomLens
                    src={imgUrl(gallery[selectedImage]?.url || product.image, { width: 1200, quality: 80 })}
                    alt={product.nameFr}
                    className="w-full h-full"
                    zoomFactor={2.5}
                  />
                )}
                {product.isSale && product.discount && (
                  <span className="absolute top-3 left-3 px-3 py-1.5 text-sm font-bold bg-sale text-sale-foreground rounded-sm">-{product.discount}%</span>
                )}
                <button onClick={() => setSelectedImage(p => (p > 0 ? p - 1 : gallery.length - 1))} className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-card/80 flex items-center justify-center hover:bg-card transition-colors"><ChevronLeft size={18} /></button>
                <button onClick={() => setSelectedImage(p => (p < gallery.length - 1 ? p + 1 : 0))} className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-card/80 flex items-center justify-center hover:bg-card transition-colors"><ChevronRight size={18} /></button>
                <span className="absolute bottom-3 right-3 text-xs bg-card/80 text-foreground px-2 py-1 rounded">{selectedImage + 1}/{gallery.length}</span>
              </div>
            </div>

            {/* ─── Description below image (desktop only) ─── */}
            <div className="hidden lg:block space-y-4">
              {/* Product Description */}
              {product.description && (
                <div className="border border-border rounded-sm p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    📝 Description du produit
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-5">
                    {product.description}
                  </p>
                </div>
              )}

              {/* Variation thumbnails */}
              {gallery.length > 1 && (
                <div className="border border-border rounded-sm p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">📸 Vues du produit</h3>
                  <div className="grid grid-cols-4 gap-2">
                    {gallery.slice(0, 8).map((item, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedImage(i)}
                        className={`aspect-square rounded-sm overflow-hidden border-2 transition-colors ${selectedImage === i ? "border-primary" : "border-border/40"}`}
                      >
                        {item.type === "video" ? (
                          <div className="w-full h-full bg-muted flex items-center justify-center">
                            <Camera size={12} className="text-muted-foreground" />
                          </div>
                        ) : (
                          <img src={imgUrl(item.url, { width: 120 })} alt={`Vue ${i + 1}`} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Flash Sale / Conversion boosters */}
              <div className="border border-border rounded-sm p-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  🔥 Pourquoi acheter maintenant ?
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <ShieldCheck size={14} className="text-primary shrink-0" />
                  <span className="text-muted-foreground">{t("product.qualityGuarantee")}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Truck size={14} className="text-primary shrink-0" />
                    <span className="text-muted-foreground">
                      {(product as any).shopType === "local"
                      ? t("product.localStock")
                      : t("product.fastShipping")}
                    </span>
                  </div>
                  {(product as any).shopType === "local" && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin size={14} className="text-emerald-600 shrink-0" />
                    <span className="text-emerald-600 font-medium">{t("product.physicalStockAvailable")}</span>
                    </div>
                  )}
                  {(product as any).store?.is_verified && (product as any).store?.verified_years > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <Award size={14} className="text-primary shrink-0" />
                    <span className="text-muted-foreground">{t("product.verifiedSupplier")} {(product as any).store?.verified_years_override ?? (product as any).store?.verified_years}+ {t("product.yearsExperience")}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <Users size={14} className="text-primary shrink-0" />
                   <span className="text-muted-foreground">{product.reviewCount > 0 ? `${product.reviewCount.toLocaleString()}+ ${t("product.satisfiedCustomers")}` : t("product.beFirstReview")}</span>
                  </div>
                </div>
              </div>

              {/* Related products mini-grid (upsells) */}
              {relatedProducts && relatedProducts.length > 0 && (
                <div className="border border-border rounded-sm p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  💡 {t("product.similarItems")}
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {relatedProducts.slice(0, 6).map((p) => (
                      <Link to={`/product/${(p as any).slug || p.id}`} key={p.id} className="group">
                        <div className="aspect-square rounded-sm overflow-hidden bg-muted">
                          <img src={imgUrl(p.image, { width: 200 })} alt={p.nameFr} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" decoding="async" />
                        </div>
                        <p className="text-xs text-foreground mt-1 truncate">{p.nameFr}</p>
                        <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold text-primary">{formatPrice(p.price)}</p>
                          {(p.salesCount ?? 0) > 0 && (
                          <span className="text-[10px] text-muted-foreground">{p.salesCount} {t("product.sold")}</span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ─── RIGHT: Product Info (sticky) ─── */}
          <div className="lg:sticky lg:top-4 lg:self-start space-y-4">
            {/* Title + Share */}
            <div className="flex items-start gap-3 pb-3 border-b border-border/50">
              <h1 className="text-lg md:text-xl font-semibold text-foreground leading-tight flex-1 line-clamp-2">{product.nameFr}</h1>
              <Popover>
                <PopoverTrigger asChild>
                  <button className="shrink-0 w-9 h-9 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors" aria-label={t("product.shareAria") || "Partager"}><Share2 size={16} /></button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-48 p-1">
                  {(() => {
                    const productUrl = `${window.location.origin}/product/${product.slug || product.id}`;
                    const shareText = `${product.nameFr}${product.sku ? `\nSKU: ${product.sku}` : ""}${product.price ? `\n${formatPrice(product.price)}` : ""}\n${productUrl}`;
                    return (
                      <>
                        <a
                          href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 text-sm rounded-sm hover:bg-muted transition-colors w-full"
                        >
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-[#25D366]">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                          </svg>
                          WhatsApp
                        </a>
                        <a
                          href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(productUrl)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 text-sm rounded-sm hover:bg-muted transition-colors w-full"
                        >
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-[#1877F2]">
                            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                          </svg>
                          Facebook
                        </a>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(productUrl);
                            toast({ title: t("product.linkCopied") || "Lien copié !", description: t("product.linkCopiedDesc") || "Le lien du produit a été copié dans le presse-papiers." });
                          }}
                          className="flex items-center gap-2 px-3 py-2 text-sm rounded-sm hover:bg-muted transition-colors w-full"
                        >
                          <LinkIcon size={16} className="text-muted-foreground" />
                          {t("product.copyLink") || "Copier le lien"}
                        </button>
                      </>
                    );
                  })()}
                </PopoverContent>
              </Popover>
            </div>

            {/* SKU + Rating */}
            <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
              <span className="inline-flex items-center gap-1">{productSku}
                <button onClick={copySku} className="text-primary hover:text-primary/80 transition-colors" aria-label={t("product.copySkuAria") || "Copier le SKU"}>{copied ? <Check size={13} /> : <Copy size={13} />}</button>
              </span>
              <span className="inline-flex items-center gap-1"><Star size={13} className="fill-accent text-accent" />{product.rating}</span>
              <span>({product.reviewCount > 0 ? t("product.reviewsCount", { count: product.reviewCount.toLocaleString() }) : t("product.noReviews")})</span>
            </div>

            {/* Pricing - dynamic based on quantity tier */}
            <div className="flex items-baseline gap-3">
              <span className="text-foreground font-bold flex items-baseline">
                <span className="text-sm">$</span><span className="text-3xl leading-none">{Math.floor(currentUnitPrice)}</span><span className="text-sm">.{(currentUnitPrice % 1).toFixed(2).slice(2)}</span>
              </span>
              {currentUnitPrice < product.price && (
                <span className="text-base text-muted-foreground line-through">{formatPrice(product.price)}</span>
              )}
              {!tieredResult && product.originalPrice && (
                <span className="text-base text-muted-foreground line-through">{formatPrice(product.originalPrice)}</span>
              )}
            {product.isSale && product.discount && <span className="text-sm font-bold text-sale bg-sale/10 px-2 py-0.5 rounded">-{product.discount}%</span>}
              {tieredResult && tieredResult.tier.discountValue > 0 && (
                <span className="text-sm font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                  {t("product.tierLabel", { label: tieredResult.tier.tierLabel })}
                </span>
              )}
            </div>

            {/* ★ SELECT OPTIONS TRIGGER (Alibaba-style) */}
            <button
              onClick={() => setVariantDrawerOpen(true)}
              className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted rounded-lg border border-border transition-colors group"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-foreground">{t("product.selectOptions")}</span>
                {(product.colors?.length ?? 0) > 0 && (
                  <span className="text-xs text-muted-foreground">{t("product.colorsCount", { count: product.colors!.length, plural: product.colors!.length > 1 ? "s" : "" })}</span>
                )}
                {(product.sizes?.length ?? 0) > 0 && (
                  <span className="text-xs text-muted-foreground">· {t("product.sizesCount", { count: product.sizes!.length, plural: product.sizes!.length > 1 ? "s" : "" })}</span>
                )}
                {((product as any).dynamicVariants || []).map((dv: any) => (
                  <span key={dv.typeId} className="text-xs text-muted-foreground">· {dv.options.length} {dv.typeName.toLowerCase()}{dv.options.length > 1 ? "s" : ""}</span>
                ))}
              </div>
              <ChevronRight size={16} className="text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>

            {/* Flash Timer FOMO */}
            {product.isSale && (
              <FlashTimer
                productId={product.id}
                durationHours={24}
                enabled={true}
              />
            )}

            {/* Short Description (conditional) */}
            {product.shortDescription && (
              <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4">
                {product.shortDescription}
              </p>
            )}

            {/* Vendor card moved above gallery */}

            {/* ★ Top Seller badge (dynamic) */}
            {(product as any).sellerRank && (product as any).sellerRank <= 10 && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[hsl(var(--badge-bestseller))] border border-[hsl(var(--badge-bestseller-border))]">
                <Award size={16} className="text-[hsl(var(--badge-bestseller-icon))]" />
                <span className="font-semibold text-sm text-[hsl(var(--badge-bestseller-foreground))]">{t("product.bestSupplierIn", { rank: (product as any).sellerRank, category: product.categoryFr })}</span>
              </div>
            )}

            {/* Zandofy Verified badge — always show seniority for verified stores */}
            {(product as any).store?.is_verified && (
              <div className="flex items-center gap-2">
                <VerificationBadge variant="full" verifiedYears={(product as any).store?.verified_years_override ?? (product as any).store?.verified_years} storeCreatedAt={(product as any).store?.created_at} />
                {(product as any).store?.is_certified && (
                  <CertificationBadge type="vendor" variant="icon-only" />
                )}
              </div>
            )}

            {/* ═══ TIERED PRICING TABLE ═══ */}
            {pricingTiers.length > 1 && (
              <TieredPricingTable
                tiers={pricingTiers}
                basePrice={product.price}
                currentQuantity={currentQty}
                currency="$"
              />
            )}

            {/* Color Selector */}
            {product.colors && product.colors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{t("product.colorWithCount", { count: product.colors.length })}</span>
                  <Sheet>
                    <SheetTrigger asChild><button className="text-xs text-primary underline">{t("product.viewLarge")}</button></SheetTrigger>
                    <SheetContent side="right" className="w-full sm:max-w-md">
                      <SheetHeader><SheetTitle>{t("product.selectColor")}</SheetTitle></SheetHeader>
                      <div className="grid grid-cols-2 gap-3 mt-4">
                        {product.colors.map((color, i) => (
                          <button key={color} onClick={() => setSelectedColor(i)} className={`aspect-[3/4] rounded-sm overflow-hidden border-2 transition-colors ${selectedColor === i ? "border-primary" : "border-border/40"}`}>
                            <div className="w-full h-full" style={{ backgroundColor: color }} />
                          </button>
                        ))}
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
                <div className="flex gap-2">
                  {product.colors.map((color, i) => (
                    <button key={color} onClick={() => setSelectedColor(i)} className={`w-8 h-8 rounded-full border-2 transition-all ${selectedColor === i ? "border-primary ring-2 ring-primary/30 scale-110" : "border-border"}`} style={{ backgroundColor: color }} aria-label={t("product.colorAria", { index: i + 1 })} />
                  ))}
                </div>
              </div>
            )}

            {/* Size Selector */}
            {product.sizes && product.sizes.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{t("product.sizeLabel")}</span>
                  <div className="flex items-center gap-2">
                    <Select value={sizeRegion} onValueChange={setSizeRegion}>
                      <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.keys(SIZE_REGIONS).map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                    </Select>
                    <Dialog>
                      <DialogTrigger asChild>
                        <button className="text-xs text-primary underline inline-flex items-center gap-1"><Ruler size={12} /> {t("product.sizeGuide")}</button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>{t("product.sizeGuide")}</DialogTitle></DialogHeader>
                        <div className="overflow-auto">
                          <table className="w-full text-sm border-collapse">
                            <thead><tr className="bg-muted"><th className="p-2 text-left text-muted-foreground">{t("product.sizeCol")}</th><th className="p-2 text-left text-muted-foreground">{t("product.bust")} (cm)</th><th className="p-2 text-left text-muted-foreground">{t("product.waist")} (cm)</th><th className="p-2 text-left text-muted-foreground">{t("product.hips")} (cm)</th></tr></thead>
                            <tbody>{["XS","S","M","L","XL","XXL"].map((s,i) => (<tr key={s} className="border-b border-border"><td className="p-2 font-medium">{s}</td><td className="p-2">{78+i*4}–{82+i*4}</td><td className="p-2">{60+i*4}–{64+i*4}</td><td className="p-2">{84+i*4}–{88+i*4}</td></tr>))}</tbody>
                          </table>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {sizes.map(size => (
                    <button key={size} onClick={() => setSelectedSize(size)} className={`min-w-[40px] h-9 px-3 rounded-sm border text-sm font-medium transition-all ${selectedSize === size ? "border-primary bg-primary text-primary-foreground" : "border-border text-foreground hover:border-primary"}`}>{size}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Dynamic Variants (Pointure, Volume, Écran, etc.) */}
            {((product as any).dynamicVariants || []).map((dv: any) => (
              <div key={dv.typeId} className="space-y-2">
                <span className="text-sm font-medium text-foreground">{dv.icon ? `${dv.icon} ` : ""}{dv.typeName}{dv.unit ? ` (${dv.unit})` : ""}</span>
                <div className="flex flex-wrap gap-2">
                  {dv.options.map((opt: any) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedDynamic((prev) => ({ ...prev, [dv.typeId]: opt.label }))}
                      className={`min-w-[40px] h-9 px-3 rounded-sm border text-sm font-medium transition-all ${
                        selectedDynamic[dv.typeId] === opt.label
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-foreground hover:border-primary"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {/* Loyalty info */}
            <p className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-sm">{t("product.loyaltyPoints", { points: loyaltyPoints })}</p>

            {/* ═══ QUANTITY + TOTAL + CTA ═══ */}
            <div className="space-y-3 pt-1">
              {/* Total + savings */}
              <div className="flex items-center justify-between bg-muted/50 px-3 py-2 rounded-sm">
                <span className="text-sm text-muted-foreground">{t("product.totalLabel", { qty: currentQty })}</span>
                <div className="text-right">
                  <span className="text-lg font-bold text-foreground">{formatPrice(totalPrice)}</span>
                  {totalSavings > 0 && (
                    <p className="text-xs font-semibold text-primary">
                      {t("product.youSave", { amount: formatPrice(totalSavings) })}
                    </p>
                  )}
                </div>
              </div>

              {/* Wishlist button — above action row */}
              <button onClick={() => id && toggleWishlist(id)} className={`w-full h-10 rounded-sm border-2 flex items-center justify-center gap-2 text-sm font-medium transition-all ${wishlisted ? "border-sale bg-sale/10 text-sale" : "border-border text-muted-foreground hover:text-sale hover:border-sale"}`} aria-label="Ajouter aux favoris">
                <Heart size={18} className={wishlisted ? "fill-sale" : ""} />
                {wishlisted ? t("product.removeFromWishlist") : t("product.addToWishlist")}
              </button>

              {/* Quantity + Add to cart — single row aligned */}
              <div className="grid grid-cols-[auto_1fr] gap-2 items-center">
                <QuantitySelector
                  value={currentQty}
                  onChange={(q) => setQuantity(q)}
                  min={moq}
                  hideMoqText
                />
                <Button size="lg" className="h-10 text-sm font-bold gap-2 w-full" onClick={() => {
                  if (!product) return;
                  if (currentQty < moq) {
                    toast({ title: t("product.insufficientQty"), description: t("product.insufficientQtyDesc", { moq }), variant: "destructive" });
                    return;
                  }
                  addItem({
                    productId: product.id,
                    name: product.name,
                    nameFr: product.nameFr,
                    image: product.image,
                    price: currentUnitPrice,
                    originalPrice: product.originalPrice,
                    color: product.colors?.[selectedColor] || null,
                    size: (() => {
                      const dynParts = Object.entries(selectedDynamic)
                        .map(([typeId, label]) => {
                          const dv = ((product as any).dynamicVariants || []).find((d: any) => d.typeId === typeId);
                          return dv ? `${dv.typeName}: ${label}` : null;
                        })
                        .filter(Boolean);
                      const parts = [selectedSize, ...dynParts].filter(Boolean);
                      return parts.length > 0 ? parts.join(" / ") : null;
                    })(),
                    quantity: currentQty,
                    moq: moq,
                  });
                }}><ShoppingCart size={18} />{t("product.addToCart")}</Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("product.minQty")} <span className="font-medium text-foreground">{moq} {t("product.pieces", { plural: moq > 1 ? "s" : "" })}</span>
              </p>
            </div>

            {/* ═══ TRUST & LOGISTICS MODULES ═══ */}
            <div className="border border-border rounded-sm divide-y divide-border">
              {/* Dynamic Shipping Estimator */}
              <div className="px-4 py-3 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Truck size={16} className="text-primary shrink-0" />
                  <span className="font-medium text-foreground">{t("product.shippingEstimate")}</span>
                </div>
                <PrecisionShippingEstimate
                  productWeightGrams={product.weightGrams}
                  productLengthCm={product.lengthCm}
                  productWidthCm={product.widthCm}
                  productHeightCm={product.heightCm}
                  originCountry={product.originCountry}
                  quantity={currentQty}
                  prepDaysMin={product.prepDaysMin}
                  prepDaysMax={product.prepDaysMax}
                />
              </div>

              {/* Return Policy */}
              <Dialog>
                <DialogTrigger asChild>
                  <button className="flex items-center gap-3 w-full px-4 py-3 text-sm text-left hover:bg-muted/50 transition-colors">
                    <RotateCcw size={18} className="text-primary shrink-0" />
                    <span className="flex-1 font-medium text-foreground">{t("product.returnPolicy")}</span>
                    <ChevronRight size={14} className="text-muted-foreground" />
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle className="flex items-center gap-2"><RotateCcw size={18} /> {t("product.returnPolicy")}</DialogTitle></DialogHeader>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-3 p-3 bg-secondary/50 rounded-sm">
                      <Check size={16} className="text-primary mt-0.5 shrink-0" />
                      <div><span className="font-semibold text-foreground">{t("product.return30Days")}</span><p className="text-muted-foreground mt-1">{t("product.return30DaysDesc")}</p></div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-secondary/50 rounded-sm">
                      <Check size={16} className="text-primary mt-0.5 shrink-0" />
                      <div><span className="font-semibold text-foreground">{t("product.exchange")}</span><p className="text-muted-foreground mt-1">{t("product.exchangeDesc")}</p></div>
                    </div>
                    <div className="flex items-start gap-3 p-3 bg-secondary/50 rounded-sm">
                      <Check size={16} className="text-primary mt-0.5 shrink-0" />
                      <div><span className="font-semibold text-foreground">{t("product.refund14to30")}</span><p className="text-muted-foreground mt-1">{t("product.refund14to30Desc")}</p></div>
                    </div>
                    <p className="text-xs text-muted-foreground italic">{t("product.returnDisclaimer")}</p>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Shopping Security */}
              <Dialog>
                <DialogTrigger asChild>
                  <button className="flex items-center gap-3 w-full px-4 py-3 text-sm text-left hover:bg-muted/50 transition-colors">
                    <ShieldCheck size={18} className="text-primary shrink-0" />
                    <div className="flex-1">
                      <span className="font-medium text-foreground">{t("product.securePayment")}</span>
                      <span className="text-muted-foreground ml-1">· {t("product.confidentiality")}</span>
                    </div>
                    <ChevronRight size={14} className="text-muted-foreground" />
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle className="flex items-center gap-2"><ShieldCheck size={18} /> {t("product.shoppingSecurity")}</DialogTitle></DialogHeader>
                  <div className="space-y-4 text-sm">
                    <div>
                      <h4 className="font-semibold text-foreground mb-2">{t("product.acceptedMethods")}</h4>
                      <div className="flex flex-wrap gap-2">
                        {["Orange Money","Airtel Money","M-PESA","Afric Money","Visa","MasterCard","PayPal","Google Pay","Apple Pay"].map(m => (
                          <span key={m} className="px-3 py-1.5 bg-muted rounded-sm text-xs font-medium text-foreground">{m}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-2">{t("product.securityCertifications")}</h4>
                      <div className="space-y-2">
                        {[
                          { label: "MasterCard SecureCode", desc: t("product.cert.mastercard") },
                          { label: "Verified by Visa", desc: t("product.cert.visa") },
                          { label: "SSL 256-bit", desc: t("product.cert.ssl") },
                        ].map(c => (
                          <div key={c.label} className="flex items-start gap-2 p-2 bg-secondary/50 rounded-sm">
                            <BadgeCheck size={14} className="text-primary mt-0.5 shrink-0" />
                            <div><span className="font-medium text-foreground">{c.label}</span><p className="text-muted-foreground text-xs">{c.desc}</p></div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-2">{t("product.secureLogistics")}</h4>
                      <div className="space-y-1 text-muted-foreground">
                        <p className="flex items-center gap-2"><Check size={13} className="text-primary" /> {t("product.logistics.tracking")}</p>
                        <p className="flex items-center gap-2"><Check size={13} className="text-primary" /> {t("product.logistics.refund")}</p>
                        <p className="flex items-center gap-2"><Check size={13} className="text-primary" /> {t("product.logistics.insurance")}</p>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* ═══ ACCORDION DETAILS ═══ */}
            {/* Weight & Dimensions */}
            {(product.weightGrams || product.lengthCm || product.widthCm || product.heightCm) && (
              <div className="border border-border rounded-sm px-4 py-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Ruler size={16} className="text-primary shrink-0" />
                  {t("product.weightDimensions")}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {product.weightGrams && (
                    <div className="bg-muted/50 p-2 rounded-sm text-center">
                      <span className="text-muted-foreground block">{t("product.weight")}</span>
                      <span className="font-semibold text-foreground">{product.weightGrams >= 1000 ? `${(product.weightGrams / 1000).toFixed(1)} kg` : `${product.weightGrams} g`}</span>
                    </div>
                  )}
                  {product.lengthCm && (
                    <div className="bg-muted/50 p-2 rounded-sm text-center">
                      <span className="text-muted-foreground block">{t("product.length")}</span>
                      <span className="font-semibold text-foreground">{product.lengthCm} cm</span>
                    </div>
                  )}
                  {product.widthCm && (
                    <div className="bg-muted/50 p-2 rounded-sm text-center">
                      <span className="text-muted-foreground block">{t("product.width")}</span>
                      <span className="font-semibold text-foreground">{product.widthCm} cm</span>
                    </div>
                  )}
                  {product.heightCm && (
                    <div className="bg-muted/50 p-2 rounded-sm text-center">
                      <span className="text-muted-foreground block">{t("product.height")}</span>
                      <span className="font-semibold text-foreground">{product.heightCm} cm</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <Accordion type="multiple" className="border border-border rounded-sm">
              {/* Description */}
              <AccordionItem value="description" className="border-b border-border last:border-0">
                <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">{t("product.description")}</AccordionTrigger>
                <AccordionContent className="px-4">
                  <table className="w-full text-sm">
                    <tbody>
                      {[
                        [t("product.material"), product.material || "—"],
                        [t("product.type"), product.categoryFr || "—"],
                        [t("product.style"), product.style || "—"],
                        [t("product.season"), (product as any).season || "—"],
                        [t("product.careInstructions"), (product as any).careInstructions || "—"],
                        [t("product.origin"), product.originCountry ? getCountryName(product.originCountry) : "—"],
                      ].filter(([, value]) => value !== "—").map(([label, value]) => (
                        <tr key={label} className="border-b border-border/50 last:border-0">
                          <td className="py-2 text-muted-foreground w-1/3">{label}</td>
                          <td className="py-2 font-medium text-foreground">{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </AccordionContent>
              </AccordionItem>

              {/* Size & Fit */}
              <AccordionItem value="size-fit" className="border-b border-border last:border-0">
                <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">{t("product.sizesMeasurements")}</AccordionTrigger>
                <AccordionContent className="px-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="flex bg-muted rounded-sm p-0.5">
                        {(["CM", "IN"] as const).map(u => (
                          <button key={u} onClick={() => setSizeUnit(u)} className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${sizeUnit === u ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>{u}</button>
                        ))}
                      </div>
                      <Select value={sizeRegion} onValueChange={setSizeRegion}>
                        <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.keys(SIZE_REGIONS).map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <table className="w-full text-xs border-collapse">
                      <thead><tr className="bg-muted"><th className="p-2 text-left text-muted-foreground">{t("product.sizeCol")}</th><th className="p-2 text-left text-muted-foreground">{t("product.bust")}</th><th className="p-2 text-left text-muted-foreground">{t("product.waist")}</th><th className="p-2 text-left text-muted-foreground">{t("product.hips")}</th></tr></thead>
                      <tbody>{["XS","S","M","L","XL","XXL"].map((s,i) => {
                        const factor = sizeUnit === "IN" ? 0.3937 : 1;
                        const fmt = (v: number) => sizeUnit === "IN" ? v.toFixed(1) : String(v);
                        return (<tr key={s} className="border-b border-border/50"><td className="p-2 font-medium">{s}</td><td className="p-2">{fmt((78+i*4)*factor)}–{fmt((82+i*4)*factor)}</td><td className="p-2">{fmt((60+i*4)*factor)}–{fmt((64+i*4)*factor)}</td><td className="p-2">{fmt((84+i*4)*factor)}–{fmt((88+i*4)*factor)}</td></tr>);
                      })}</tbody>
                    </table>
                    <p className="text-xs text-muted-foreground italic">{t("product.modelWears", { size: (product as any).model_size || "M" })}</p>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* About Store */}
              <AccordionItem value="about-store" className="last:border-0">
                <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">{t("product.aboutSupplier")}</AccordionTrigger>
                <AccordionContent className="px-4">
                  {(product as any).store ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          {(product as any).store.logo_url ? (
                            <img src={imgUrl((product as any).store.logo_url, { width: 96 })} alt={(product as any).store.name} className="w-12 h-12 rounded-full object-cover border border-border" loading="lazy" decoding="async" />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center">
                              <Store size={20} className="text-primary-foreground" />
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{(product as any).store.name}</span>
                            <VerificationBadge variant="icon-only" verifiedYears={(product as any).store.verified_years_override ?? (product as any).store.verified_years} storeCreatedAt={(product as any).store.created_at} />
                            {(product as any).store.is_certified && (
                              <CertificationBadge type="vendor" variant="icon-only" />
                            )}
                            <span className={`w-2 h-2 rounded-full ${(product as any).store.is_online ? "bg-emerald-500" : "bg-amber-500/60"}`} />
                            <span className={`text-xs ${(product as any).store.is_online ? "text-emerald-600" : "text-amber-600"}`}>
                              {(product as any).store.is_online ? t("product.online") : t("product.offline")}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin size={11} /> {product.originCountry ? getCountryName(product.originCountry) : "—"} {(product as any).store.is_verified && (
                              <span>· {t("product.verifiedYearsLabel", { years: (product as any).store.verified_years_override ?? (product as any).store.verified_years ?? 0 })}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-muted/50 p-2 rounded-sm text-center">
                          <Users size={14} className="mx-auto mb-1 text-primary" />
                          <span className="font-semibold text-foreground">{(product as any).store.sales_override ?? (product as any).store.sales_count ?? 0}</span>
                          <p className="text-muted-foreground">{t("product.salesLabel")}</p>
                        </div>
                        <div className="bg-muted/50 p-2 rounded-sm text-center">
                          <TrendingUp size={14} className="mx-auto mb-1 text-primary" />
                          <span className="font-semibold text-foreground">{(product as any).store.sales_trend || "—"}</span>
                          <p className="text-muted-foreground">{t("product.growth")}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <a href={`/store/${(product as any).store.id}`}>
                          <Button variant="outline" size="sm" className="flex-1 text-xs">{t("product.allItems")}</Button>
                        </a>
                        <FollowStoreButton storeId={(product as any).store.id} storeName={(product as any).store.name} size="sm" />
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t("product.supplierInfoUnavailable")}</p>
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>

        {/* ═══ CUSTOMER REVIEWS ═══ */}
        <ProductReviews productId={product.id} />

        {/* ═══ CUSTOMERS ALSO VIEWED (15 products) ═══ */}
        {relatedProducts && relatedProducts.length > 0 && (
          <section className="mt-12 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">{t("product.alsoViewed")}</h2>
              <Link to="/" className="text-sm text-primary hover:underline">{t("product.seeMore")}</Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {relatedProducts.filter(p => p.id !== product.id).slice(0, 15).map((p, i) => (
                <Link to={`/product/${(p as any).slug || p.id}`} key={p.id}><ProductCard product={p} index={i} /></Link>
              ))}
            </div>
          </section>
        )}
      </main>
      <Footer />
      <FloatingActions />

      {/* ═══ VARIANT ORDER DRAWER (Alibaba-style) ═══ */}
      <VariantOrderDrawer
        open={variantDrawerOpen}
        onOpenChange={setVariantDrawerOpen}
        product={product}
        colors={(product as any).productColors || product.colors?.map((hex: string, i: number) => ({
          hex,
          name: (product as any).colorNames?.[i] || t("product.colorFallback", { index: i + 1 }),
          imageUrl: (product as any).colorImages?.[i] || null,
        })) || []}
        sizes={product.sizes?.map((s: string) => ({ label: s })) || []}
        pricingTiers={pricingTiers}
        moq={moq}
        dynamicVariants={(product as any).dynamicVariants || []}
      />
    </div>
  );
}
