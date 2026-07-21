import { useState, useMemo, useEffect } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { useAuth } from "@/contexts/AuthContext";
import { recordProductView } from "@/lib/user-product-views";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchProductBySlug, fetchProducts, fetchPricingTiers, type Product } from "@/services/api";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { imgUrl } from "@/lib/image-url";
import { PdpThumbImage } from "@/components/product/PdpThumbImage";
import { PDP_THUMB_WIDTHS } from "@/lib/product-pdp";
import { PDP_THUMB_FRAME_CLASS } from "@/lib/product-image-fit";
import { useCart } from "@/contexts/CartContext";
import { useWishlist } from "@/contexts/WishlistContext";
import { Footer } from "@/components/Footer";
import { FloatingActions } from "@/components/FloatingActions";
import { ProductCard } from "@/components/ProductCard";
import { ProductReviews } from "@/components/reviews/ProductReviews";
import { VerificationBadge } from "@/components/VerificationBadge";
import { CertificationBadge } from "@/components/CertificationBadge";
import { FollowStoreButton } from "@/components/FollowStoreButton";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductBuyColumn } from "@/components/product/ProductBuyColumn";
import { ProductVariantSelectors } from "@/components/product/ProductVariantSelectors";
import { StoreTrustBlock } from "@/components/product/StoreTrustBlock";
import {
  buildColorOptions,
  getApparelSizesForPdp,
  getGalleryItems,
  SIZE_REGIONS,
} from "@/lib/product-pdp";
import { buildProductShareMessage, type SharePaymentNumber } from "@/lib/product-share";
import { resolveProductOgImage } from "@/lib/og-image";
import { TieredPricingTable, calculateTieredPrice, type PricingTier } from "@/components/TieredPricingTable";
import { QuantitySelector } from "@/components/QuantitySelector";
import { FlashTimer } from "@/components/FlashTimer";
import { useToast } from "@/hooks/use-toast";
import {
  Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Heart, Check, ChevronRight, ShoppingCart,
  BadgeCheck, Ruler, Award, Truck, RotateCcw, ShieldCheck, Camera,
  MapPin, Globe, Trophy, Store, TrendingUp, Users, Link as LinkIcon,
} from "lucide-react";
import { getCountryName } from "@/components/vendor/CountryCombobox";
import { PrecisionShippingEstimate } from "@/components/PrecisionShippingEstimate";
import { SEOHead, buildProductJsonLd, buildBreadcrumbJsonLd, buildJsonLdGraph, buildMarketplaceFaqJsonLd } from "@/components/SEOHead";
import { VariantOrderDrawer } from "@/components/VariantOrderDrawer";
import { MobileBackButton } from "@/components/navigation/MobileBackButton";
import { slugify } from "@/utils/slugify";
import { PRODUCT_GRID_CLASS } from "@/lib/product-image-fit";

// ─── Component ─────────────────────────────────
export default function ProductPage() {
  const { t, formatPrice } = useI18n();
  const { user } = useAuth();
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

  const { data: sharePlatformSettings } = useQuery({
    queryKey: ["product-share-platform-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("key, value")
        .in("key", ["default_payment_numbers", "whatsapp_china_order_number"]);
      if (error) throw error;

      let paymentNumbers: SharePaymentNumber[] = [];
      let chinaWhatsAppNumber = "";

      for (const row of data || []) {
        if (row.key === "default_payment_numbers" && row.value && typeof row.value === "object") {
          const v = row.value as { numbers?: SharePaymentNumber[] };
          paymentNumbers = (v.numbers || []).filter((n) => n.phone_number?.trim());
        }
        if (row.key === "whatsapp_china_order_number" && row.value && typeof row.value === "object") {
          chinaWhatsAppNumber = (row.value as { phone?: string }).phone?.trim() || "";
        }
      }

      return { paymentNumbers, chinaWhatsAppNumber };
    },
    staleTime: 60_000,
  });

  const wishlisted = product ? isInWishlist(product.id) : false;

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
  const colorOptions = useMemo(
    () =>
      product
        ? buildColorOptions(product, (i) => t("product.colorFallback", { index: i + 1 }))
        : [],
    [product, t],
  );

  const openVariantDrawer = () => setVariantDrawerOpen(true);

  useEffect(() => {
    if (!user?.id || !product?.id) return;
    recordProductView(user.id, product.id).catch(() => {});
  }, [user?.id, product?.id]);

  const goGalleryPrev = () =>
    setSelectedImage((p) => (p > 0 ? p - 1 : gallery.length - 1));
  const goGalleryNext = () =>
    setSelectedImage((p) => (p < gallery.length - 1 ? p + 1 : 0));

  const selectColor = (index: number) => {
    setSelectedColor(index);
    const imageUrl = colorOptions[index]?.imageUrl;
    if (imageUrl) {
      const idx = gallery.findIndex((g) => g.url === imageUrl);
      if (idx >= 0) setSelectedImage(idx);
    }
  };

  const apparelSizes = useMemo(() => getApparelSizesForPdp(product), [product]);

  const productShareMessage = useMemo(() => {
    if (!product) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const productUrl = `${origin}/product/${product.slug || product.id}`;
    const store = (product as { store?: { name?: string; slug?: string; id?: string } }).store;
    const storeSlug = store?.slug || store?.id;
    const storeUrl = storeSlug ? `${origin}/store/${storeSlug}` : null;
    return buildProductShareMessage({
      productName: product.nameFr,
      storeName: store?.name,
      storeUrl,
      unitPrice: currentUnitPrice,
      currency: product.currency,
      productUrl,
      moq: product.moq || 1,
      colorOptions,
      apparelSizes,
      dynamicVariants: ((product as { dynamicVariants?: Array<{ typeName: string; unit?: string; options: { label: string }[] }> })
        .dynamicVariants || []),
      weightGrams: product.weightGrams,
      paymentNumbers: sharePlatformSettings?.paymentNumbers || [],
      chinaWhatsAppNumber: sharePlatformSettings?.chinaWhatsAppNumber || null,
    });
  }, [product, currentUnitPrice, colorOptions, apparelSizes, sharePlatformSettings]);

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
  const productOgImage = resolveProductOgImage(gallery[0]?.url, product.image);
  const productJsonLd = buildProductJsonLd({
    name: product.nameFr,
    description: seoDescription,
    image: productOgImage,
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
        ogImage={productOgImage}
        ogType="product"
        jsonLd={buildJsonLdGraph(productJsonLd, breadcrumbJsonLd, buildMarketplaceFaqJsonLd())}
      />
      <Header />
      <div className="lg:hidden sticky top-14 z-40 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-1">
        <MobileBackButton fallbackTo={`/category/${categorySlug}`} />
      </div>
      <main className="max-w-7xl mx-auto px-4 py-2 lg:py-4">
        {/* Breadcrumbs — desktop only */}
        <Breadcrumb className="mb-4 hidden lg:flex">
          <BreadcrumbList>
            <BreadcrumbItem><BreadcrumbLink asChild><Link to="/">{t("general.home") || "Accueil"}</Link></BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbLink asChild><Link to={`/category/${categorySlug}`}>{product.categoryFr}</Link></BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage>{product.nameFr}</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* ═══ MAIN LAYOUT ═══ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 lg:gap-10">

          {/* ─── LEFT: Gallery + Trust + Description + Upsells ─── */}
          <div className="flex flex-col gap-1.5 lg:gap-4">
            <div className="order-2 lg:order-none flex flex-col gap-1">
              <ProductGallery
                gallery={gallery}
                selectedIndex={selectedImage}
                onSelectIndex={setSelectedImage}
                productName={product.nameFr}
                fallbackImage={product.image}
                isSale={product.isSale}
                discount={product.discount}
                onPrev={goGalleryPrev}
                onNext={goGalleryNext}
              />
              <h1 className="lg:hidden text-lg font-semibold text-primary leading-tight line-clamp-3">
                {product.nameFr}
              </h1>
            </div>

            {(product as any).store && (
              <div className="order-1 lg:order-none">
                <StoreTrustBlock
                  store={(product as any).store}
                  originCountry={product.originCountry}
                  productId={product.id}
                  productName={product.nameFr}
                  productSku={product.sku}
                  productPrice={formatPrice(currentUnitPrice)}
                  labels={{
                    storeRating: t("product.storeRating"),
                    storeResponseTime: t("product.storeResponseTime"),
                    storeReactivity: t("product.storeReactivity"),
                    storeReorderRate: t("product.storeReorderRate"),
                    contactSupplier: t("product.contactSupplier"),
                    whatsapp: "WhatsApp",
                    visitStore: t("product.allItems"),
                    storeExpand: t("product.storeExpand"),
                    storeCollapse: t("product.storeCollapse"),
                  }}
                />
              </div>
            )}

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
                        className={`${PDP_THUMB_FRAME_CLASS} rounded-sm ${selectedImage === i ? "border-primary" : "border-border/40"}`}
                      >
                        {item.type === "video" ? (
                          <span className="absolute inset-0 flex items-center justify-center">
                            <Camera size={12} className="text-muted-foreground" />
                          </span>
                        ) : (
                          <PdpThumbImage
                            src={item.url}
                            alt={`Vue ${i + 1}`}
                            widths={[...PDP_THUMB_WIDTHS]}
                            sizes="120px"
                            fitHeight={120}
                          />
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
                          <img src={imgUrl(p.image, { width: 200, height: 200, resize: "cover" })} alt={p.nameFr} className="w-full h-full object-cover object-center" loading="lazy" decoding="async" />
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
          <div className="lg:sticky lg:top-4 lg:self-start space-y-4 pb-[env(safe-area-inset-bottom)]">
            <ProductBuyColumn
              product={product}
              productSku={productSku}
              copied={copied}
              onCopySku={copySku}
              currentUnitPrice={currentUnitPrice}
              basePrice={product.price}
              pricingTiers={pricingTiers}
              formatPrice={formatPrice}
              t={t}
              sellerRank={(product as any).sellerRank}
              shareContent={
                <>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(productShareMessage)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 text-sm rounded-sm hover:bg-muted transition-colors w-full"
                  >
                    WhatsApp
                  </a>
                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${window.location.origin}/product/${product.slug || product.id}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 text-sm rounded-sm hover:bg-muted transition-colors w-full"
                  >
                    Facebook
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(productShareMessage);
                      toast({ title: t("product.linkCopied") || "Lien copié !", description: t("product.shareCopiedDesc") || "Fiche produit copiée" });
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-sm rounded-sm hover:bg-muted transition-colors w-full"
                  >
                    <LinkIcon size={16} className="text-muted-foreground" />
                    {t("product.copyLink") || "Copier la fiche"}
                  </button>
                </>
              }
            />

            {/* ★ SELECT OPTIONS TRIGGER (Alibaba-style) */}
            <button
              type="button"
              onClick={openVariantDrawer}
              className="w-full flex items-center justify-between px-4 py-3 min-h-[44px] bg-muted/50 hover:bg-muted rounded-lg border border-border transition-colors group"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-foreground">{t("product.selectOptions")}</span>
                {(product.colors?.length ?? 0) > 0 && (
                  <span className="text-xs text-muted-foreground">{t("product.colorsCount", { count: product.colors!.length, plural: product.colors!.length > 1 ? "s" : "" })}</span>
                )}
                {apparelSizes.length > 0 && (
                  <span className="text-xs text-muted-foreground">· {t("product.sizesCount", { count: apparelSizes.length, plural: apparelSizes.length > 1 ? "s" : "" })}</span>
                )}
                {((product as any).dynamicVariants || []).map((dv: any) => (
                  <span key={dv.typeId} className="text-xs text-muted-foreground">· {dv.options.length} {(dv.typeName || "option").toLowerCase()}{dv.options.length > 1 ? "s" : ""}</span>
                ))}
              </div>
              <ChevronRight size={16} className="text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>

            {product.isSale && (
              <div className="hidden lg:block">
                <FlashTimer productId={product.id} durationHours={24} enabled />
              </div>
            )}

            <ProductVariantSelectors
              colorOptions={colorOptions}
              gallery={gallery}
              selectedColor={selectedColor}
              onColorSelect={selectColor}
              onOpenVariantDrawer={openVariantDrawer}
              sizes={apparelSizes}
              sizeRegion={sizeRegion}
              onSizeRegionChange={setSizeRegion}
              selectedSize={selectedSize}
              onSizeSelect={setSelectedSize}
              dynamicVariants={(product as any).dynamicVariants || []}
              selectedDynamic={selectedDynamic}
              onDynamicSelect={(typeId, label) =>
                setSelectedDynamic((prev) => ({ ...prev, [typeId]: label }))
              }
              t={t}
            />

            <p className="text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-sm">
              {t("product.loyaltyPoints", { points: loyaltyPoints })}
            </p>

            {pricingTiers.length > 1 && (
              <TieredPricingTable
                tiers={pricingTiers}
                basePrice={product.price}
                currentQuantity={currentQty}
                currency="$"
              />
            )}

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
              <button onClick={() => product && toggleWishlist(product.id)} className={`w-full h-10 rounded-sm border-2 flex items-center justify-center gap-2 text-sm font-medium transition-all ${wishlisted ? "border-sale bg-sale/10 text-sale" : "border-border text-muted-foreground hover:text-sale hover:border-sale"}`} aria-label="Ajouter aux favoris">
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
                    color: colorOptions[selectedColor]?.hex ?? product.colors?.[selectedColor] ?? null,
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

              {/* Size & Fit — only when vendor configured apparel sizes */}
              {apparelSizes.length > 0 && (
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
              )}

              {/* About Store */}
              <AccordionItem value="about-store" className="last:border-0">
                <AccordionTrigger className="px-4 py-3 text-sm font-medium hover:no-underline">{t("product.aboutSupplier")}</AccordionTrigger>
                <AccordionContent className="px-4">
                  {(product as any).store ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          {(product as any).store.logo_url ? (
                            <img
                              src={imgUrl((product as any).store.logo_url, { width: 96, height: 96, resize: "contain" })}
                              alt={(product as any).store.name}
                              className="w-12 h-12 rounded-full object-contain object-center border border-border bg-muted"
                              loading="lazy"
                              decoding="async"
                            />
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
            <div className={PRODUCT_GRID_CLASS}>
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
        colors={colorOptions}
        sizes={product.sizes?.map((s: string) => ({ label: s })) || []}
        pricingTiers={pricingTiers}
        moq={moq}
        dynamicVariants={(product as any).dynamicVariants || []}
      />
    </div>
  );
}
