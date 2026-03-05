import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Flame, Clock, Tag, Loader2, ToggleLeft, ToggleRight,
  Calendar, TrendingUp, AlertCircle, CheckCircle2, Zap,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface PromoProduct {
  id: string;
  name_fr: string;
  price: number;
  original_price: number | null;
  discount: number | null;
  is_sale: boolean;
  flash_timer_enabled: boolean;
  promo_start_date: string | null;
  promo_end_date: string | null;
  image_url: string | null;
}

type PromoFilter = "all" | "active" | "scheduled" | "expired" | "inactive";

function getPromoStatus(p: PromoProduct): "active" | "scheduled" | "expired" | "inactive" {
  if (!p.is_sale) return "inactive";
  const now = Date.now();
  if (p.promo_start_date && new Date(p.promo_start_date).getTime() > now) return "scheduled";
  if (p.promo_end_date && new Date(p.promo_end_date).getTime() < now) return "expired";
  return "active";
}

const STATUS_STYLES: Record<string, { label: string; icon: typeof Flame; class: string }> = {
  active: { label: "Active", icon: Flame, class: "text-sale bg-sale/10" },
  scheduled: { label: "Planifiée", icon: Calendar, class: "text-primary bg-primary/10" },
  expired: { label: "Expirée", icon: AlertCircle, class: "text-muted-foreground bg-muted" },
  inactive: { label: "Inactive", icon: ToggleLeft, class: "text-muted-foreground bg-muted" },
};

export function VendorPromotionsTab({ storeId }: { storeId: string }) {
  const [products, setProducts] = useState<PromoProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<PromoFilter>("all");
  const [toggling, setToggling] = useState<string | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDiscount, setBulkDiscount] = useState(10);
  const [bulkDuration, setBulkDuration] = useState(24);
  const [applyingBulk, setApplyingBulk] = useState(false);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("products")
      .select("id, name_fr, price, original_price, discount, is_sale, flash_timer_enabled, promo_start_date, promo_end_date")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });

    if (data) {
      // Get first image for each product
      const ids = data.map((p) => p.id);
      const { data: imgs } = ids.length > 0
        ? await supabase
            .from("product_images")
            .select("product_id, image_url, position")
            .in("product_id", ids)
            .order("position", { ascending: true })
        : { data: [] };

      const imgMap = new Map<string, string>();
      (imgs || []).forEach((img) => {
        if (!imgMap.has(img.product_id)) imgMap.set(img.product_id, img.image_url);
      });

      setProducts(
        data.map((p) => ({
          ...p,
          is_sale: p.is_sale ?? false,
          discount: p.discount ?? 0,
          flash_timer_enabled: p.flash_timer_enabled ?? false,
          image_url: imgMap.get(p.id) || null,
        }))
      );
    }
    setLoading(false);
  }, [storeId]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const togglePromo = async (product: PromoProduct) => {
    setToggling(product.id);
    const newIsSale = !product.is_sale;
    const update: Record<string, any> = { is_sale: newIsSale };

    if (newIsSale && !product.original_price) {
      update.original_price = product.price;
    }
    if (newIsSale && !product.promo_start_date) {
      update.promo_start_date = new Date().toISOString();
    }
    if (!newIsSale) {
      update.flash_timer_enabled = false;
    }

    const { error } = await supabase.from("products").update(update).eq("id", product.id);
    if (error) {
      toast.error("Erreur lors de la mise à jour");
    } else {
      toast.success(newIsSale ? "Promotion activée" : "Promotion désactivée");
      loadProducts();
    }
    setToggling(null);
  };

  const toggleFlashTimer = async (product: PromoProduct) => {
    setToggling(product.id);
    const { error } = await supabase
      .from("products")
      .update({ flash_timer_enabled: !product.flash_timer_enabled })
      .eq("id", product.id);
    if (error) toast.error("Erreur");
    else loadProducts();
    setToggling(null);
  };

  const applyBulkPromo = async () => {
    if (selected.size === 0) { toast.error("Sélectionnez des produits"); return; }
    setApplyingBulk(true);

    const now = new Date();
    const end = new Date(now.getTime() + bulkDuration * 3600 * 1000);

    for (const id of selected) {
      const product = products.find((p) => p.id === id);
      if (!product) continue;

      await supabase.from("products").update({
        is_sale: true,
        discount: bulkDiscount,
        original_price: product.original_price || product.price,
        promo_start_date: now.toISOString(),
        promo_end_date: end.toISOString(),
        flash_timer_enabled: true,
      }).eq("id", id);
    }

    toast.success(`Promotion appliquée à ${selected.size} produit(s)`);
    setSelected(new Set());
    setBulkMode(false);
    loadProducts();
    setApplyingBulk(false);
  };

  const filtered = products.filter((p) => {
    if (filter === "all") return true;
    return getPromoStatus(p) === filter;
  });

  const counts = {
    all: products.length,
    active: products.filter((p) => getPromoStatus(p) === "active").length,
    scheduled: products.filter((p) => getPromoStatus(p) === "scheduled").length,
    expired: products.filter((p) => getPromoStatus(p) === "expired").length,
    inactive: products.filter((p) => getPromoStatus(p) === "inactive").length,
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <Flame size={16} className="text-sale" /> Promotions
        </h3>
        <button
          onClick={() => { setBulkMode(!bulkMode); setSelected(new Set()); }}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
            bulkMode
              ? "bg-sale text-sale-foreground"
              : "bg-card border border-border text-foreground hover:border-primary"
          }`}
        >
          <Zap size={12} /> {bulkMode ? "Annuler" : "Promo en lot"}
        </button>
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-4 gap-2">
        {(["active", "scheduled", "expired", "inactive"] as const).map((key) => {
          const cfg = STATUS_STYLES[key];
          const Icon = cfg.icon;
          return (
            <div key={key} className="bg-card border border-border rounded-lg p-2.5 text-center">
              <Icon size={14} className={`mx-auto mb-1 ${cfg.class.split(" ")[0]}`} />
              <p className="text-lg font-bold text-foreground">{counts[key]}</p>
              <p className="text-[10px] text-muted-foreground">{cfg.label}</p>
            </div>
          );
        })}
      </div>

      {/* Bulk promo panel */}
      {bulkMode && (
        <div className="bg-sale/5 border border-sale/20 rounded-lg p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Zap size={14} className="text-sale" /> Promotion groupée
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Réduction (%)</label>
              <input
                type="number"
                min={1}
                max={90}
                value={bulkDiscount}
                onChange={(e) => setBulkDiscount(Number(e.target.value))}
                className="w-full mt-1 px-3 py-2 text-sm bg-card border border-border rounded-md"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Durée (heures)</label>
              <input
                type="number"
                min={1}
                max={720}
                value={bulkDuration}
                onChange={(e) => setBulkDuration(Number(e.target.value))}
                className="w-full mt-1 px-3 py-2 text-sm bg-card border border-border rounded-md"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {selected.size} produit(s) sélectionné(s)
            </span>
            <button
              onClick={applyBulkPromo}
              disabled={selected.size === 0 || applyingBulk}
              className="px-4 py-2 text-xs font-medium bg-sale text-sale-foreground rounded-md hover:bg-sale/90 disabled:opacity-50 flex items-center gap-1"
            >
              {applyingBulk ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
              Appliquer
            </button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {(["all", "active", "scheduled", "expired", "inactive"] as const).map((key) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border whitespace-nowrap transition-all ${
              filter === key
                ? "bg-foreground text-card border-foreground"
                : "bg-card text-foreground border-border hover:border-foreground"
            }`}
          >
            {key === "all" ? "Tous" : STATUS_STYLES[key].label} ({counts[key]})
          </button>
        ))}
      </div>

      {/* Product list */}
      {filtered.length === 0 ? (
        <div className="text-center py-8">
          <Tag size={32} className="mx-auto text-muted-foreground/20 mb-2" />
          <p className="text-sm text-muted-foreground">Aucun produit dans cette catégorie</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((product) => {
            const status = getPromoStatus(product);
            const cfg = STATUS_STYLES[status];
            const Icon = cfg.icon;
            const isSelected = selected.has(product.id);

            return (
              <div
                key={product.id}
                className={`bg-card border rounded-lg p-3 flex items-center gap-3 transition-colors ${
                  isSelected ? "border-sale bg-sale/5" : "border-border"
                }`}
              >
                {/* Bulk select checkbox */}
                {bulkMode && (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {
                      const next = new Set(selected);
                      isSelected ? next.delete(product.id) : next.add(product.id);
                      setSelected(next);
                    }}
                    className="shrink-0"
                  />
                )}

                {/* Image */}
                {product.image_url ? (
                  <img src={product.image_url} alt="" className="w-11 h-11 rounded-md object-cover shrink-0" />
                ) : (
                  <div className="w-11 h-11 rounded-md bg-muted flex items-center justify-center shrink-0">
                    <Tag size={14} className="text-muted-foreground" />
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{product.name_fr}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${cfg.class}`}>
                      <Icon size={10} /> {cfg.label}
                    </span>
                    {product.discount && product.discount > 0 && (
                      <span className="text-[10px] font-bold text-sale">-{product.discount}%</span>
                    )}
                    {product.promo_end_date && status === "active" && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Clock size={9} />
                        Fin {format(new Date(product.promo_end_date), "dd MMM HH:mm", { locale: fr })}
                      </span>
                    )}
                    {product.promo_start_date && status === "scheduled" && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Calendar size={9} />
                        Début {format(new Date(product.promo_start_date), "dd MMM HH:mm", { locale: fr })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {product.is_sale && (
                    <button
                      onClick={() => toggleFlashTimer(product)}
                      disabled={toggling === product.id}
                      className={`p-1.5 rounded-md transition-colors ${
                        product.flash_timer_enabled
                          ? "bg-sale/10 text-sale"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                      title={product.flash_timer_enabled ? "Timer flash actif" : "Activer timer flash"}
                    >
                      <Clock size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => togglePromo(product)}
                    disabled={toggling === product.id}
                    className="p-1.5 rounded-md transition-colors hover:bg-muted"
                    title={product.is_sale ? "Désactiver promo" : "Activer promo"}
                  >
                    {toggling === product.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : product.is_sale ? (
                      <ToggleRight size={14} className="text-sale" />
                    ) : (
                      <ToggleLeft size={14} className="text-muted-foreground" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
