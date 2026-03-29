import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Plus, Pencil, Trash2, Loader2, X, Save, Package,
  ImageIcon, ChevronLeft, Eye, EyeOff, Send, Crown, EyeOff as EyeOffIcon, Search,
} from "lucide-react";
import { toast } from "sonner";
import { CountryCombobox } from "@/components/vendor/CountryCombobox";
import { MediaUploader } from "@/components/vendor/MediaUploader";
import { ShippingEstimator } from "@/components/vendor/ShippingEstimator";
import { PromotionTimer } from "@/components/vendor/PromotionTimer";
import { ProductVariantsEditor, type SizeVariant, type ColorVariant, type DynamicVariantSelection } from "@/components/vendor/ProductVariantsEditor";
import { PricingCalculator } from "@/components/vendor/PricingCalculator";
import { useVendorSubscription } from "@/hooks/use-vendor-subscription";
import { PUBLISH_STATUS_CONFIG } from "@/lib/vendor-tiers";

interface Supplier {
  id: string;
  agent_name: string;
  platform_name: string;
}

interface Product {
  id: string;
  name: string;
  name_fr: string;
  price: number;
  original_price: number | null;
  currency: string;
  description: string | null;
  short_description: string | null;
  moq: number | null;
  sku: string | null;
  is_new: boolean | null;
  is_sale: boolean | null;
  discount: number | null;
  material: string | null;
  origin_country: string | null;
  category_id: string | null;
  store_id: string | null;
  supplier_id: string | null;
  promo_start_date: string | null;
  promo_end_date: string | null;
  flash_timer_enabled: boolean | null;
  images: { id: string; image_url: string; position: number | null }[];
  publish_status: string;
}

interface Category {
  id: string;
  name_fr: string;
}

interface MediaItem {
  id?: string;
  url: string;
  type: "image" | "video";
  position: number;
}

const EMPTY_FORM = {
  name: "",
  name_fr: "",
  price: 0,
  original_price: null as number | null,
  currency: "USD",
  description: "",
  short_description: "",
  moq: 1,
  sku: "",
  is_new: false,
  is_sale: false,
  discount: 0,
  material: "",
  style: "",
  season: "",
  care_instructions: "",
  origin_country: "",
  category_id: "" as string,
  trend_tag_id: "" as string,
  supplier_id: "" as string,
  flash_timer_enabled: false,
  promo_start_date: "",
  promo_end_date: "",
  weight_grams: 0,
  length_cm: 0,
  width_cm: 0,
  height_cm: 0,
  cost_real: 0,
  cost_calc: 0,
  auto_pricing_enabled: true,
  vendor_extra_margin: 0,
  model_size: "",
  prep_days_min: 2,
  prep_days_max: 5,
};

type ProductFormState = typeof EMPTY_FORM;

interface ProductDraftSnapshot {
  updatedAt: number;
  mode: "create" | "edit";
  productId: string | null;
  form: ProductFormState;
  mainImage: MediaItem[];
  variationMedia: MediaItem[];
  sizes: SizeVariant[];
  colors: ColorVariant[];
  dynamicSelections: DynamicVariantSelection[];
}

const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export function VendorProductManager({ storeId, suppliersEnabled = false }: { storeId: string; suppliersEnabled?: boolean }) {
  const { user } = useAuth();
  const { subscription, tierConfig, canAddProduct } = useVendorSubscription(storeId);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [trendTags, setTrendTags] = useState<{ id: string; name_fr: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<ProductFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [mainImage, setMainImage] = useState<MediaItem[]>([]);
  const [variationMedia, setVariationMedia] = useState<MediaItem[]>([]);
  const [sizes, setSizes] = useState<SizeVariant[]>([]);
  const [colors, setColors] = useState<ColorVariant[]>([]);
  const [dynamicSelections, setDynamicSelections] = useState<DynamicVariantSelection[]>([]);

  const showForm = creating || !!editing;
  const draftStorageKey = useMemo(
    () => `zandofy_vendor_product_draft:${user?.id ?? "anon"}:${storeId}`,
    [storeId, user?.id]
  );
  const hasRestoredDraftRef = useRef(false);

  const clearDraft = useCallback(() => {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(draftStorageKey);
  }, [draftStorageKey]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase
      .from("products")
      .select("id, name, name_fr, price, original_price, currency, description, short_description, moq, sku, is_new, is_sale, discount, material, style, season, care_instructions, origin_country, category_id, trend_tag_id, supplier_id, store_id, promo_start_date, promo_end_date, flash_timer_enabled, weight_grams, length_cm, width_cm, height_cm, publish_status, prep_days_min, prep_days_max") as any)
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });

    if (data) {
      const productIds = data.map((p) => p.id);
      const { data: imgs } = productIds.length > 0
        ? await supabase
            .from("product_images")
            .select("id, image_url, position, product_id")
            .in("product_id", productIds)
        : { data: [] };

      const imgMap = new Map<string, typeof imgs>();
      (imgs || []).forEach((img) => {
        const arr = imgMap.get(img.product_id) || [];
        arr.push(img);
        imgMap.set(img.product_id, arr);
      });

      setProducts(
        data.map((p) => ({
          ...p,
          publish_status: (p as any).publish_status || "draft",
          images: (imgMap.get(p.id) || []).sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
        }))
      );
    }
    setLoading(false);
  }, [storeId]);

  useEffect(() => {
    loadProducts();
    supabase.from("categories").select("id, name_fr").then(({ data }) => {
      if (data) setCategories(data);
    });
    (supabase as any).from("trend_tags").select("id, name_fr").eq("is_active", true).order("sort_order").then(({ data }: any) => {
      if (data) setTrendTags(data);
    });
    if (user) {
      (supabase as any).from("suppliers").select("id, agent_name, platform_name").eq("vendor_id", user.id).order("agent_name").then(({ data }: any) => {
        if (data) setSuppliers(data);
      });
    }
  }, [loadProducts, user]);

  useEffect(() => {
    if (hasRestoredDraftRef.current || loading || showForm) return;
    hasRestoredDraftRef.current = true;
    if (!user || typeof localStorage === "undefined") return;

    try {
      const raw = localStorage.getItem(draftStorageKey);
      if (!raw) return;

      const snapshot = JSON.parse(raw) as ProductDraftSnapshot;
      if (!snapshot?.updatedAt || Date.now() - snapshot.updatedAt > DRAFT_TTL_MS) {
        localStorage.removeItem(draftStorageKey);
        return;
      }

      const mode = snapshot.mode ?? "create";
      const editTarget = snapshot.productId ? products.find((p) => p.id === snapshot.productId) : null;

      setEditing(mode === "edit" ? editTarget ?? null : null);
      setCreating(mode === "create" || (mode === "edit" && !editTarget));
      setForm({ ...EMPTY_FORM, ...(snapshot.form || {}) });
      setMainImage(snapshot.mainImage || []);
      setVariationMedia(snapshot.variationMedia || []);
      setSizes(snapshot.sizes || []);
      setColors(snapshot.colors || []);
      setDynamicSelections(snapshot.dynamicSelections || []);
      toast.success("Brouillon restauré automatiquement.");
    } catch {
      localStorage.removeItem(draftStorageKey);
    }
  }, [draftStorageKey, loading, products, showForm, user]);

  useEffect(() => {
    if (!user || !showForm || typeof localStorage === "undefined") return;

    const timeout = window.setTimeout(() => {
      const snapshot: ProductDraftSnapshot = {
        updatedAt: Date.now(),
        mode: editing ? "edit" : "create",
        productId: editing?.id ?? null,
        form,
        mainImage,
        variationMedia,
        sizes,
        colors,
        dynamicSelections,
      };
      localStorage.setItem(draftStorageKey, JSON.stringify(snapshot));
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [
    draftStorageKey,
    dynamicSelections,
    editing,
    form,
    mainImage,
    showForm,
    sizes,
    colors,
    user,
    variationMedia,
  ]);

  useEffect(() => {
    if (!showForm) return;

    const beforeUnloadHandler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", beforeUnloadHandler);
    return () => window.removeEventListener("beforeunload", beforeUnloadHandler);
  }, [showForm]);

  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogStatusFilter, setCatalogStatusFilter] = useState<string>("all");

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchStatus = catalogStatusFilter === "all" || p.publish_status === catalogStatusFilter;
      const q = catalogSearch.toLowerCase().trim();
      const matchSearch = !q || p.name_fr.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || (p.sku && p.sku.toLowerCase().includes(q));
      return matchStatus && matchSearch;
    });
  }, [products, catalogSearch, catalogStatusFilter]);

  const catalogStatusTabs = [
    { key: "all", label: "Tous" },
    { key: "published", label: "Publiés" },
    { key: "draft", label: "Brouillons" },
    { key: "pending_approval", label: "En attente" },
    { key: "rejected", label: "Refusés" },
    { key: "revision_requested", label: "Révision" },
  ];

  const toLocalDatetime = (iso: string | null) => {
    if (!iso) return "";
    try {
      return new Date(iso).toISOString().slice(0, 16);
    } catch { return ""; }
  };

  const startCreate = () => {
    if (!canAddProduct(products.length)) {
      toast.error(`Limite atteinte (${tierConfig.maxProducts} produits max pour le plan ${tierConfig.label})`);
      return;
    }
    setEditing(null);
    setForm(EMPTY_FORM);
    setMainImage([]);
    setVariationMedia([]);
    setSizes([]);
    setColors([]);
    setDynamicSelections([]);
    setCreating(true);
  };

  const startEdit = async (product: Product) => {
    setCreating(false);
    setEditing(product);
    setForm({
      name: product.name,
      name_fr: product.name_fr,
      price: product.price,
      original_price: product.original_price,
      currency: product.currency,
      description: product.description || "",
      short_description: product.short_description || "",
      moq: product.moq || 1,
      sku: product.sku || "",
      is_new: product.is_new || false,
      is_sale: product.is_sale || false,
      discount: product.discount || 0,
      material: product.material || "",
      style: (product as any).style || "",
      season: (product as any).season || "",
      care_instructions: (product as any).care_instructions || "",
      origin_country: product.origin_country || "",
      category_id: product.category_id || "",
      trend_tag_id: (product as any).trend_tag_id || "",
      supplier_id: (product as any).supplier_id || "",
      flash_timer_enabled: product.flash_timer_enabled || false,
      promo_start_date: toLocalDatetime(product.promo_start_date),
      promo_end_date: toLocalDatetime(product.promo_end_date),
      weight_grams: (product as any).weight_grams || 0,
      length_cm: (product as any).length_cm || 0,
      width_cm: (product as any).width_cm || 0,
      height_cm: (product as any).height_cm || 0,
      cost_real: (product as any).cost_real || 0,
      cost_calc: (product as any).cost_calc || 0,
      prep_days_min: (product as any).prep_days_min ?? 2,
      prep_days_max: (product as any).prep_days_max ?? 5,
      auto_pricing_enabled: (product as any).auto_pricing_enabled !== false,
      vendor_extra_margin: (product as any).vendor_extra_margin || 0,
      model_size: (product as any).model_size || "",
    });
    // Split images: position 0 = main, rest = variations
    const sorted = [...product.images].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    const main = sorted.length > 0 ? [{ id: sorted[0].id, url: sorted[0].image_url, type: "image" as const, position: 0 }] : [];
    const variations = sorted.slice(1).map((img, i) => ({
      id: img.id,
      url: img.image_url,
      type: (img.image_url.match(/\.(mp4|webm|mov)$/i) ? "video" : "image") as "image" | "video",
      position: i + 1,
    }));
    setMainImage(main);
    setVariationMedia(variations);

    // Load existing sizes & colors
    const [sizesRes, colorsRes, dynRes] = await Promise.all([
      supabase.from("product_sizes").select("id, size_label, region, bust_cm, waist_cm, hips_cm").eq("product_id", product.id),
      supabase.from("product_colors").select("id, color_name, color_hex, image_url").eq("product_id", product.id),
      (supabase as any).from("product_variant_selections").select("variant_type_id, variant_option_id").eq("product_id", product.id),
    ]);
    setSizes(sizesRes.data || []);
    setColors(colorsRes.data || []);
    setDynamicSelections((dynRes.data || []) as DynamicVariantSelection[]);
  };

  const cancelForm = () => {
    clearDraft();
    setEditing(null);
    setCreating(false);
  };

  const handleSave = async () => {
    if (!form.name_fr.trim() || form.price <= 0) {
      toast.error("Nom et prix sont obligatoires");
      return;
    }
    setSaving(true);

    const payload = {
      name: form.name || form.name_fr,
      name_fr: form.name_fr,
      price: form.price,
      original_price: form.original_price || null,
      currency: form.currency,
      description: form.description || null,
      short_description: form.short_description || null,
      moq: form.moq ? Math.round(Number(form.moq)) : 1,
      sku: form.sku || null,
      is_new: form.is_new,
      is_sale: form.is_sale,
      discount: form.discount ? Math.round(Number(form.discount)) : 0,
      material: form.material || null,
      style: form.style || null,
      season: form.season || null,
      care_instructions: form.care_instructions || null,
      origin_country: form.origin_country || null,
      category_id: form.category_id && form.category_id.trim() !== '' ? form.category_id : null,
      trend_tag_id: form.trend_tag_id && form.trend_tag_id.trim() !== '' ? form.trend_tag_id : null,
      supplier_id: form.supplier_id && form.supplier_id.trim() !== '' ? form.supplier_id : null,
      store_id: storeId,
      flash_timer_enabled: form.flash_timer_enabled,
      promo_start_date: form.promo_start_date ? new Date(form.promo_start_date).toISOString() : null,
      promo_end_date: form.promo_end_date ? new Date(form.promo_end_date).toISOString() : null,
      weight_grams: form.weight_grams ? Math.round(Number(form.weight_grams)) : null,
      length_cm: form.length_cm || null,
      width_cm: form.width_cm || null,
      height_cm: form.height_cm || null,
      prep_days_min: form.prep_days_min ? Math.round(Number(form.prep_days_min)) : 2,
      prep_days_max: form.prep_days_max ? Math.round(Number(form.prep_days_max)) : 5,
      cost_real: form.cost_real || null,
      cost_calc: form.cost_calc || null,
      auto_pricing_enabled: form.auto_pricing_enabled,
      vendor_extra_margin: form.vendor_extra_margin || 0,
      model_size: form.model_size && form.model_size.trim() !== '' ? form.model_size.trim() : null,
    };

    let productId = editing?.id;
    const wasPublished = editing?.publish_status === "published";

    if (editing) {
      // If the product was published, any edit forces re-approval
      const updatePayload = wasPublished
        ? { ...payload, publish_status: "pending_approval" }
        : payload;
      const { error } = await (supabase.from("products").update(updatePayload as any) as any).eq("id", editing.id);
      if (error) { console.error("Product update error:", error); toast.error("Erreur lors de la mise à jour : " + (error.message || "inconnue")); setSaving(false); return; }
    } else {
      const { data, error } = await (supabase.from("products").insert(payload as any) as any).select("id").single();
      if (error || !data) { console.error("Product insert error:", error); toast.error("Erreur lors de la création : " + (error?.message || "inconnue")); setSaving(false); return; }
      productId = data.id;
    }

    // Sync images
    if (productId) {
      // Delete old images
      await supabase.from("product_images").delete().eq("product_id", productId);

      const allMedia = [
        ...mainImage.map((m, i) => ({ ...m, position: 0 })),
        ...variationMedia.map((m, i) => ({ ...m, position: i + 1 })),
      ];

      if (allMedia.length > 0) {
        const imgRows = allMedia.map((m) => ({
          product_id: productId!,
          image_url: m.url,
          position: m.position,
        }));
        await supabase.from("product_images").insert(imgRows);
      }

      // Sync sizes
      await supabase.from("product_sizes").delete().eq("product_id", productId);
      if (sizes.length > 0) {
        await supabase.from("product_sizes").insert(
          sizes.map((s) => ({
            product_id: productId!,
            size_label: s.size_label,
            region: s.region || null,
            bust_cm: s.bust_cm || null,
            waist_cm: s.waist_cm || null,
            hips_cm: s.hips_cm || null,
          }))
        );
      }

      // Sync colors
      await supabase.from("product_colors").delete().eq("product_id", productId);
      if (colors.length > 0) {
        await supabase.from("product_colors").insert(
          colors.map((c) => ({
            product_id: productId!,
            color_name: c.color_name,
            color_hex: c.color_hex,
            image_url: c.image_url || null,
          }))
        );
      }

      // Sync dynamic variant selections
      await (supabase as any).from("product_variant_selections").delete().eq("product_id", productId);
      if (dynamicSelections.length > 0) {
        await (supabase as any).from("product_variant_selections").insert(
          dynamicSelections.map((s) => ({
            product_id: productId!,
            variant_type_id: s.variant_type_id,
            variant_option_id: s.variant_option_id,
          }))
        );
      }
    }

    clearDraft();
    toast.success(editing
      ? wasPublished
        ? "Produit modifié — soumis à nouveau pour approbation"
        : "Produit mis à jour"
      : "Produit sauvegardé en brouillon");
    cancelForm();
    loadProducts();
    setSaving(false);
  };

  const handlePublish = async (productId: string) => {
    const { error } = await supabase
      .from("products")
      .update({ publish_status: "pending_approval" } as any)
      .eq("id", productId);
    if (error) {
      toast.error("Erreur lors de la soumission");
    } else {
      toast.success("Produit soumis pour approbation");
      loadProducts();
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    await supabase.from("product_images").delete().eq("product_id", id);
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) toast.error("Erreur lors de la suppression");
    else { toast.success("Produit supprimé"); loadProducts(); }
    setDeleting(null);
  };

  const handleUnpublish = async (productId: string) => {
    const { error } = await supabase
      .from("products")
      .update({ publish_status: "draft" } as any)
      .eq("id", productId);
    if (error) {
      toast.error("Erreur lors de la dépublication");
    } else {
      toast.success("Produit dépublié");
      loadProducts();
    }
  };



  if (showForm) {
    return (
      <div className="space-y-4">
        <button onClick={cancelForm} className="text-sm text-primary flex items-center gap-1">
          <ChevronLeft size={14} /> Retour au catalogue
        </button>
        <h3 className="text-base font-bold text-foreground">
          {editing ? "Modifier le produit" : "Nouveau produit"}
        </h3>
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          {/* Main image */}
          <MediaUploader
            label="Image principale *"
            items={mainImage}
            onChange={setMainImage}
            multiple={false}
            storeId={storeId}
          />

          {/* Variation media (images + video) */}
          <MediaUploader
            label="Images / Vidéo de variations"
            items={variationMedia}
            onChange={setVariationMedia}
            multiple={true}
            acceptVideo={true}
            storeId={storeId}
          />

          <Field label="Nom (FR) *" value={form.name_fr} onChange={(v) => setForm({ ...form, name_fr: v })} />
          <Field label="Nom (EN)" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          {/* Pricing Calculator */}
          <PricingCalculator
            costReal={form.cost_real}
            costCalc={form.cost_calc}
            autoPricingEnabled={form.auto_pricing_enabled}
            vendorExtraMargin={form.vendor_extra_margin}
            price={form.price}
            originalPrice={form.original_price}
            storeId={storeId}
            onCostRealChange={(v) => setForm((f) => ({ ...f, cost_real: v }))}
            onCostCalcChange={(v) => setForm((f) => ({ ...f, cost_calc: v }))}
            onAutoPricingChange={(v) => setForm((f) => ({ ...f, auto_pricing_enabled: v }))}
            onVendorExtraMarginChange={(v) => setForm((f) => ({ ...f, vendor_extra_margin: v }))}
            onPriceChange={(v) => setForm((f) => ({ ...f, price: v }))}
            onOriginalPriceChange={(v) => setForm((f) => ({ ...f, original_price: v }))}
          />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Prix *" type="number" value={String(form.price)} onChange={(v) => setForm({ ...form, price: Number(v) })} disabled={form.auto_pricing_enabled} />
            <Field label="Ancien prix" type="number" value={String(form.original_price || "")} onChange={(v) => setForm({ ...form, original_price: v ? Number(v) : null })} disabled={form.auto_pricing_enabled} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="MOQ" type="number" value={String(form.moq)} onChange={(v) => setForm({ ...form, moq: Number(v) })} />
            <Field label="SKU" value={form.sku} onChange={(v) => setForm({ ...form, sku: v })} />
          </div>
          <Field label="Description courte" value={form.short_description} onChange={(v) => setForm({ ...form, short_description: v })} />
          <div>
            <label className="text-xs text-muted-foreground">Description</label>
            <textarea
              className="w-full mt-1 px-3 py-2 text-sm bg-card border border-border rounded-md resize-none"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Matière" value={form.material} onChange={(v) => setForm({ ...form, material: v })} />
            <Field label="Style" value={form.style} onChange={(v) => setForm({ ...form, style: v })} placeholder="Ex: Décontracté, Chic, Sportif" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Saison" value={form.season} onChange={(v) => setForm({ ...form, season: v })} placeholder="Ex: Été, Hiver, Toute saison" />
            <Field label="Entretien" value={form.care_instructions} onChange={(v) => setForm({ ...form, care_instructions: v })} placeholder="Ex: Lavage à la main" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <CountryCombobox value={form.origin_country} onChange={(v) => setForm({ ...form, origin_country: v })} />
          </div>
          <div>
            <Field label="Taille du mannequin (ex: M, XL, 42)" value={form.model_size} onChange={(v) => setForm({ ...form, model_size: v })} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Catégorie</label>
            <select
              className="w-full mt-1 px-3 py-2 text-sm bg-card border border-border rounded-md"
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
            >
              <option value="">— Aucune —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name_fr}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Tag Tendance</label>
            <select
              className="w-full mt-1 px-3 py-2 text-sm bg-card border border-border rounded-md"
              value={form.trend_tag_id}
              onChange={(e) => setForm({ ...form, trend_tag_id: e.target.value })}
            >
              <option value="">— Aucun —</option>
              {trendTags.map((t) => (
                <option key={t.id} value={t.id}>{t.name_fr}</option>
              ))}
            </select>
          </div>
          {suppliersEnabled && (
          <div>
            <label className="text-xs text-muted-foreground">🏭 Fournisseur</label>
            <select
              className="w-full mt-1 px-3 py-2 text-sm bg-card border border-border rounded-md"
              value={form.supplier_id}
              onChange={(e) => setForm({ ...form, supplier_id: e.target.value })}
            >
              <option value="">— Aucun —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.agent_name}{s.platform_name ? ` (${s.platform_name})` : ""}</option>
              ))}
            </select>
            {suppliers.length === 0 && (
              <p className="text-[10px] text-muted-foreground mt-1">Ajoutez vos fournisseurs dans l'onglet "Fournisseurs"</p>
            )}
          </div>
          )}
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_new || false} onChange={(e) => setForm({ ...form, is_new: e.target.checked })} />
              Nouveau
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_sale || false} onChange={(e) => setForm({ ...form, is_sale: e.target.checked })} />
              En promo
            </label>
          </div>
          {form.is_sale && (
            <Field label="Réduction (%)" type="number" value={String(form.discount)} onChange={(v) => setForm({ ...form, discount: Number(v) })} />
          )}

          {/* Poids & Dimensions */}
          <div className="border-t border-border pt-3 mt-1">
            <label className="text-xs font-semibold text-foreground">📦 Poids & Dimensions (pour estimation fret)</label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Poids (grammes)" type="number" value={String(form.weight_grams)} onChange={(v) => setForm({ ...form, weight_grams: Number(v) })} />
            <Field label="Longueur (cm)" type="number" value={String(form.length_cm)} onChange={(v) => setForm({ ...form, length_cm: Number(v) })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Largeur (cm)" type="number" value={String(form.width_cm)} onChange={(v) => setForm({ ...form, width_cm: Number(v) })} />
            <Field label="Hauteur (cm)" type="number" value={String(form.height_cm)} onChange={(v) => setForm({ ...form, height_cm: Number(v) })} />
          </div>

          {/* Délai de préparation fournisseur */}
          <div className="border-t border-border pt-3 mt-1">
            <label className="text-xs font-semibold text-foreground">⏱️ Délai de préparation fournisseur (jours)</label>
            <p className="text-[10px] text-muted-foreground mb-2">Temps que le fournisseur met pour préparer la commande avant expédition</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Min (jours)" type="number" value={String(form.prep_days_min)} onChange={(v) => setForm({ ...form, prep_days_min: Number(v) })} />
            <Field label="Max (jours)" type="number" value={String(form.prep_days_max)} onChange={(v) => setForm({ ...form, prep_days_max: Number(v) })} />
          </div>

          <ShippingEstimator
            weightGrams={form.weight_grams}
            lengthCm={form.length_cm}
            widthCm={form.width_cm}
            heightCm={form.height_cm}
            categoryId={form.category_id || undefined}
          />

          {/* Promotion timer */}
          <PromotionTimer
            enabled={form.flash_timer_enabled}
            startDate={form.promo_start_date}
            endDate={form.promo_end_date}
            onEnabledChange={(v) => setForm({ ...form, flash_timer_enabled: v })}
            onStartChange={(v) => setForm({ ...form, promo_start_date: v })}
            onEndChange={(v) => setForm({ ...form, promo_end_date: v })}
          />

          {/* Tailles, Couleurs & Variations dynamiques */}
          <ProductVariantsEditor
            sizes={sizes}
            colors={colors}
            dynamicSelections={dynamicSelections}
            onSizesChange={setSizes}
            onColorsChange={setColors}
            onDynamicSelectionsChange={setDynamicSelections}
          />

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {editing ? "Mettre à jour" : "Créer le produit"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <Package size={16} /> Catalogue ({filteredProducts.length}
          {subscription && subscription.max_products < Infinity && `/${subscription.max_products}`})
        </h3>
        <button
          onClick={startCreate}
          disabled={!canAddProduct(products.length)}
          className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center gap-1 disabled:opacity-50"
        >
          <Plus size={12} /> Ajouter
        </button>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          placeholder="Rechercher un produit (nom, SKU)..."
          value={catalogSearch}
          onChange={(e) => setCatalogSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {catalogStatusTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setCatalogStatusFilter(tab.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border whitespace-nowrap transition-colors ${
              catalogStatusFilter === tab.key
                ? "bg-foreground text-card border-foreground"
                : "bg-card text-foreground border-border hover:bg-muted"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-primary" size={24} />
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <Package size={40} className="mx-auto text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">
            {products.length === 0 ? "Aucun produit. Ajoutez votre premier article." : "Aucun produit ne correspond aux filtres."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="bg-card border border-border rounded-lg p-3 flex items-center gap-3"
            >
              {product.images[0] ? (
                <img
                  src={product.images[0].image_url}
                  alt={product.name_fr}
                  className="w-12 h-12 rounded-md object-cover shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-md bg-muted flex items-center justify-center shrink-0">
                  <ImageIcon size={16} className="text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground truncate">{product.name_fr}</p>
                  {(() => {
                    const ps = PUBLISH_STATUS_CONFIG[product.publish_status] || PUBLISH_STATUS_CONFIG.draft;
                    return (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${ps.badgeClass}`}>
                        {ps.label}
                      </span>
                    );
                  })()}
                </div>
                <p className="text-xs text-muted-foreground">
                  {product.price} {product.currency}
                  {product.is_sale && product.discount ? ` · -${product.discount}%` : ""}
                  {product.moq && product.moq > 1 ? ` · MOQ ${product.moq}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {(product.publish_status === "draft" || product.publish_status === "revision_requested") && (
                  <button
                    onClick={() => handlePublish(product.id)}
                    className="p-2 text-muted-foreground hover:text-emerald-500 transition-colors"
                    title="Soumettre pour approbation"
                  >
                    <Send size={14} />
                  </button>
                )}
                {product.publish_status === "published" && (
                  <button
                    onClick={() => handleUnpublish(product.id)}
                    className="p-2 text-muted-foreground hover:text-amber-500 transition-colors"
                    title="Dépublier"
                  >
                    <EyeOff size={14} />
                  </button>
                )}
                <button onClick={() => startEdit(product)} className="p-2 text-muted-foreground hover:text-primary transition-colors">
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(product.id)}
                  disabled={deleting === product.id}
                  className="p-2 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                >
                  {deleting === product.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", disabled = false, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; disabled?: boolean; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        type={type}
        className={`w-full mt-1 px-3 py-2 text-sm bg-card border border-border rounded-md ${disabled ? "bg-muted/50 cursor-not-allowed" : ""}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
      />
    </div>
  );
}
