import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Plus, Pencil, Trash2, Loader2, X, Save, Package,
  ImageIcon, ChevronLeft, Eye, EyeOff, Send, Crown,
} from "lucide-react";
import { toast } from "sonner";
import { CountryCombobox } from "@/components/vendor/CountryCombobox";
import { MediaUploader } from "@/components/vendor/MediaUploader";
import { ShippingEstimator } from "@/components/vendor/ShippingEstimator";
import { PromotionTimer } from "@/components/vendor/PromotionTimer";
import { ProductVariantsEditor, type SizeVariant, type ColorVariant } from "@/components/vendor/ProductVariantsEditor";
import { useVendorSubscription } from "@/hooks/use-vendor-subscription";
import { PUBLISH_STATUS_CONFIG } from "@/lib/vendor-tiers";

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
  origin_country: "",
  category_id: "" as string,
  flash_timer_enabled: false,
  promo_start_date: "",
  promo_end_date: "",
  weight_grams: 0,
  length_cm: 0,
  width_cm: 0,
  height_cm: 0,
};

export function VendorProductManager({ storeId }: { storeId: string }) {
  const { user } = useAuth();
  const { subscription, tierConfig, canAddProduct } = useVendorSubscription(storeId);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [mainImage, setMainImage] = useState<MediaItem[]>([]);
  const [variationMedia, setVariationMedia] = useState<MediaItem[]>([]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("products")
      .select("id, name, name_fr, price, original_price, currency, description, short_description, moq, sku, is_new, is_sale, discount, material, origin_country, category_id, store_id, promo_start_date, promo_end_date, flash_timer_enabled, weight_grams, length_cm, width_cm, height_cm, publish_status")
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
  }, [loadProducts]);

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
    setCreating(true);
  };

  const startEdit = (product: Product) => {
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
      origin_country: product.origin_country || "",
      category_id: product.category_id || "",
      flash_timer_enabled: product.flash_timer_enabled || false,
      promo_start_date: toLocalDatetime(product.promo_start_date),
      promo_end_date: toLocalDatetime(product.promo_end_date),
      weight_grams: (product as any).weight_grams || 0,
      length_cm: (product as any).length_cm || 0,
      width_cm: (product as any).width_cm || 0,
      height_cm: (product as any).height_cm || 0,
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
  };

  const cancelForm = () => {
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
      moq: form.moq || 1,
      sku: form.sku || null,
      is_new: form.is_new,
      is_sale: form.is_sale,
      discount: form.discount || 0,
      material: form.material || null,
      origin_country: form.origin_country || null,
      category_id: form.category_id || null,
      store_id: storeId,
      flash_timer_enabled: form.flash_timer_enabled,
      promo_start_date: form.promo_start_date ? new Date(form.promo_start_date).toISOString() : null,
      promo_end_date: form.promo_end_date ? new Date(form.promo_end_date).toISOString() : null,
      weight_grams: form.weight_grams || null,
      length_cm: form.length_cm || null,
      width_cm: form.width_cm || null,
      height_cm: form.height_cm || null,
    };

    let productId = editing?.id;

    if (editing) {
      const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
      if (error) { toast.error("Erreur lors de la mise à jour"); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from("products").insert(payload).select("id").single();
      if (error || !data) { toast.error("Erreur lors de la création"); setSaving(false); return; }
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
    }

    toast.success(editing ? "Produit mis à jour" : "Produit sauvegardé en brouillon");
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

  const showForm = creating || editing;

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
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prix *" type="number" value={String(form.price)} onChange={(v) => setForm({ ...form, price: Number(v) })} />
            <Field label="Ancien prix" type="number" value={String(form.original_price || "")} onChange={(v) => setForm({ ...form, original_price: v ? Number(v) : null })} />
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
            <CountryCombobox value={form.origin_country} onChange={(v) => setForm({ ...form, origin_country: v })} />
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

          {/* Shipping Estimator */}
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
          <Package size={16} /> Catalogue ({products.length}
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



      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-primary" size={24} />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <Package size={40} className="mx-auto text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">Aucun produit. Ajoutez votre premier article.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {products.map((product) => (
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
                {product.publish_status === "draft" && (
                  <button
                    onClick={() => handlePublish(product.id)}
                    className="p-2 text-muted-foreground hover:text-emerald-500 transition-colors"
                    title="Publier"
                  >
                    <Send size={14} />
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
  label, value, onChange, type = "text",
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <input
        type={type}
        className="w-full mt-1 px-3 py-2 text-sm bg-card border border-border rounded-md"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
