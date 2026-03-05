import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Ticket, Plus, Loader2, Trash2, ToggleLeft, ToggleRight,
  Copy, Clock, Percent, DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface StoreCoupon {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  min_order_amount: number | null;
  max_uses: number | null;
  current_uses: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

export function VendorCouponsTab({ storeId }: { storeId: string }) {
  const [coupons, setCoupons] = useState<StoreCoupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Form state
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState(10);
  const [minOrder, setMinOrder] = useState(0);
  const [maxUses, setMaxUses] = useState<number | "">(100);
  const [expiresAt, setExpiresAt] = useState("");

  const loadCoupons = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("store_coupons")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });

    if (!error && data) setCoupons(data as StoreCoupon[]);
    setLoading(false);
  }, [storeId]);

  useEffect(() => { loadCoupons(); }, [loadCoupons]);

  const generateCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let result = "";
    for (let i = 0; i < 8; i++) result += chars[Math.floor(Math.random() * chars.length)];
    setCode(result);
  };

  const resetForm = () => {
    setCode("");
    setDiscountType("percentage");
    setDiscountValue(10);
    setMinOrder(0);
    setMaxUses(100);
    setExpiresAt("");
    setShowForm(false);
  };

  const saveCoupon = async () => {
    if (!code.trim()) { toast.error("Le code est requis"); return; }
    if (discountValue <= 0) { toast.error("La réduction doit être > 0"); return; }

    setSaving(true);
    const { error } = await supabase.from("store_coupons").insert({
      store_id: storeId,
      code: code.trim().toUpperCase(),
      discount_type: discountType,
      discount_value: discountValue,
      min_order_amount: minOrder > 0 ? minOrder : null,
      max_uses: maxUses ? Number(maxUses) : null,
      expires_at: expiresAt || null,
    });

    if (error) {
      if (error.code === "23505") toast.error("Ce code existe déjà");
      else toast.error("Erreur: " + error.message);
    } else {
      toast.success("Coupon créé !");
      resetForm();
      loadCoupons();
    }
    setSaving(false);
  };

  const toggleActive = async (coupon: StoreCoupon) => {
    const { error } = await supabase
      .from("store_coupons")
      .update({ is_active: !coupon.is_active })
      .eq("id", coupon.id);
    if (!error) {
      setCoupons(prev => prev.map(c => c.id === coupon.id ? { ...c, is_active: !c.is_active } : c));
      toast.success(coupon.is_active ? "Coupon désactivé" : "Coupon activé");
    }
  };

  const deleteCoupon = async (id: string) => {
    setDeleting(id);
    const { error } = await supabase.from("store_coupons").delete().eq("id", id);
    if (!error) {
      setCoupons(prev => prev.filter(c => c.id !== id));
      toast.success("Coupon supprimé");
    }
    setDeleting(null);
  };

  const copyCode = (c: string) => {
    navigator.clipboard.writeText(c);
    toast.success("Code copié !");
  };

  const isExpired = (c: StoreCoupon) =>
    c.expires_at && new Date(c.expires_at).getTime() < Date.now();

  const isMaxed = (c: StoreCoupon) =>
    c.max_uses !== null && c.current_uses >= c.max_uses;

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
          <Ticket size={16} className="text-primary" /> Codes Promo
        </h3>
        <button
          onClick={() => { setShowForm(!showForm); if (!showForm) generateCode(); }}
          className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 flex items-center gap-1"
        >
          <Plus size={12} /> Nouveau coupon
        </button>
      </div>

      {/* Creation form */}
      {showForm && (
        <div className="bg-card border border-primary/20 rounded-lg p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">Créer un coupon</p>

          {/* Code */}
          <div>
            <label className="text-xs text-muted-foreground">Code</label>
            <div className="flex gap-2 mt-1">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="EX: PROMO20"
                className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-md font-mono"
              />
              <button
                onClick={generateCode}
                className="px-3 py-2 text-xs bg-muted text-foreground rounded-md hover:bg-muted/80"
              >
                Générer
              </button>
            </div>
          </div>

          {/* Type & value */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Type</label>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as "percentage" | "fixed")}
                className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-md"
              >
                <option value="percentage">Pourcentage (%)</option>
                <option value="fixed">Montant fixe ($)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">
                Valeur {discountType === "percentage" ? "(%)" : "($)"}
              </label>
              <input
                type="number"
                min={1}
                max={discountType === "percentage" ? 90 : 999999}
                value={discountValue}
                onChange={(e) => setDiscountValue(Number(e.target.value))}
                className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-md"
              />
            </div>
          </div>

          {/* Min order & max uses */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Commande min. ($)</label>
              <input
                type="number"
                min={0}
                value={minOrder}
                onChange={(e) => setMinOrder(Number(e.target.value))}
                className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-md"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Utilisations max.</label>
              <input
                type="number"
                min={1}
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value ? Number(e.target.value) : "")}
                placeholder="Illimité"
                className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-md"
              />
            </div>
          </div>

          {/* Expiration */}
          <div>
            <label className="text-xs text-muted-foreground">Date d'expiration (optionnel)</label>
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full mt-1 px-3 py-2 text-sm bg-background border border-border rounded-md"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <button
              onClick={resetForm}
              className="px-4 py-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Annuler
            </button>
            <button
              onClick={saveCoupon}
              disabled={saving}
              className="px-4 py-2 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              Créer
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-card border border-border rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-foreground">{coupons.length}</p>
          <p className="text-[10px] text-muted-foreground">Total</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-primary">{coupons.filter(c => c.is_active && !isExpired(c) && !isMaxed(c)).length}</p>
          <p className="text-[10px] text-muted-foreground">Actifs</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-2.5 text-center">
          <p className="text-lg font-bold text-foreground">{coupons.reduce((s, c) => s + c.current_uses, 0)}</p>
          <p className="text-[10px] text-muted-foreground">Utilisations</p>
        </div>
      </div>

      {/* Coupon list */}
      {coupons.length === 0 ? (
        <div className="text-center py-8">
          <Ticket size={32} className="mx-auto text-muted-foreground/20 mb-2" />
          <p className="text-sm text-muted-foreground">Aucun coupon créé</p>
          <p className="text-xs text-muted-foreground mt-1">Créez votre premier code promo pour fidéliser vos clients</p>
        </div>
      ) : (
        <div className="space-y-2">
          {coupons.map((coupon) => {
            const expired = isExpired(coupon);
            const maxed = isMaxed(coupon);
            const active = coupon.is_active && !expired && !maxed;

            return (
              <div
                key={coupon.id}
                className={`bg-card border rounded-lg p-3 transition-colors ${
                  active ? "border-primary/20" : "border-border opacity-60"
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Code */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-foreground">{coupon.code}</span>
                      <button onClick={() => copyCode(coupon.code)} className="text-muted-foreground hover:text-foreground">
                        <Copy size={12} />
                      </button>
                      {active && (
                        <span className="text-[10px] font-medium text-primary bg-primary/10 px-1.5 py-0.5 rounded">Actif</span>
                      )}
                      {expired && (
                        <span className="text-[10px] font-medium text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">Expiré</span>
                      )}
                      {maxed && !expired && (
                        <span className="text-[10px] font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Épuisé</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        {coupon.discount_type === "percentage" ? <Percent size={9} /> : <DollarSign size={9} />}
                        {coupon.discount_type === "percentage" ? `${coupon.discount_value}%` : `$${coupon.discount_value}`}
                      </span>
                      <span>{coupon.current_uses}{coupon.max_uses ? `/${coupon.max_uses}` : ""} utilisé(s)</span>
                      {coupon.min_order_amount && coupon.min_order_amount > 0 && (
                        <span>Min. ${coupon.min_order_amount}</span>
                      )}
                      {coupon.expires_at && (
                        <span className="flex items-center gap-0.5">
                          <Clock size={9} />
                          {format(new Date(coupon.expires_at), "dd MMM yyyy", { locale: fr })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => toggleActive(coupon)}
                      className="p-1.5 rounded-md transition-colors hover:bg-muted"
                      title={coupon.is_active ? "Désactiver" : "Activer"}
                    >
                      {coupon.is_active ? (
                        <ToggleRight size={14} className="text-primary" />
                      ) : (
                        <ToggleLeft size={14} className="text-muted-foreground" />
                      )}
                    </button>
                    <button
                      onClick={() => deleteCoupon(coupon.id)}
                      disabled={deleting === coupon.id}
                      className="p-1.5 rounded-md transition-colors hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                    >
                      {deleting === coupon.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
