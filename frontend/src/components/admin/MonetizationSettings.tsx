import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Crown, Rocket, HandCoins, Save, Loader2, ShieldCheck, Percent, Phone } from "lucide-react";
import { toast } from "sonner";

interface TippingConfig { enabled: boolean; max_amount: number; }
interface PremiumConfig { enabled: boolean; monthly_price: number; plan_name: string; }
interface BoostConfig { enabled: boolean; daily_price: number; max_days: number; }
interface GeoCouponsConfig { enabled: boolean; }
interface KybConfig {
  threshold_local_usd: number;
  threshold_international_usd: number;
  soft_warn_ratio: number;
}
interface VendorMonetizationConfig {
  free_max_products: number;
  free_max_promos: number;
  mm_numbers_monthly_price_usd: number;
  default_commission_pct: number;
}

export function MonetizationSettings() {
  const [tipping, setTipping] = useState<TippingConfig>({ enabled: false, max_amount: 20 });
  const [premium, setPremium] = useState<PremiumConfig>({ enabled: false, monthly_price: 9.99, plan_name: "Zandofy Premium" });
  const [boost, setBoost] = useState<BoostConfig>({ enabled: false, daily_price: 5, max_days: 30 });
  const [geoCoupons, setGeoCoupons] = useState<GeoCouponsConfig>({ enabled: false });
  const [kyb, setKyb] = useState<KybConfig>({
    threshold_local_usd: 200,
    threshold_international_usd: 500,
    soft_warn_ratio: 0.8,
  });
  const [vendorMonetization, setVendorMonetization] = useState<VendorMonetizationConfig>({
    free_max_products: 100,
    free_max_promos: 10,
    mm_numbers_monthly_price_usd: 9.99,
    default_commission_pct: 10,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("platform_settings").select("key, value")
      .in("key", [
        "tipping_settings",
        "premium_settings",
        "boost_settings",
        "geo_coupons_enabled",
        "kyb_settings",
        "vendor_monetization",
      ])
      .then(({ data }) => {
        data?.forEach(row => {
          const v = row.value as any;
          if (row.key === "tipping_settings") setTipping({ enabled: !!v?.enabled, max_amount: Number(v?.max_amount) || 20 });
          else if (row.key === "premium_settings") setPremium({ enabled: !!v?.enabled, monthly_price: Number(v?.monthly_price) || 9.99, plan_name: v?.plan_name || "Zandofy Premium" });
          else if (row.key === "boost_settings") setBoost({ enabled: !!v?.enabled, daily_price: Number(v?.daily_price) || 5, max_days: Number(v?.max_days) || 30 });
          else if (row.key === "geo_coupons_enabled") setGeoCoupons({ enabled: !!v?.enabled });
          else if (row.key === "kyb_settings") {
            setKyb({
              threshold_local_usd: Number(v?.threshold_local_usd) || 200,
              threshold_international_usd: Number(v?.threshold_international_usd) || 500,
              soft_warn_ratio: Number(v?.soft_warn_ratio) || 0.8,
            });
          } else if (row.key === "vendor_monetization") {
            setVendorMonetization({
              free_max_products: Number(v?.free_max_products) || 100,
              free_max_promos: Number(v?.free_max_promos) || 10,
              mm_numbers_monthly_price_usd: Number(v?.mm_numbers_monthly_price_usd) || 9.99,
              default_commission_pct: Number(v?.default_commission_pct) || 10,
            });
          }
        });
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const now = new Date().toISOString();
    const upserts = [
      { key: "tipping_settings", value: tipping as any, updated_at: now },
      { key: "premium_settings", value: premium as any, updated_at: now },
      { key: "boost_settings", value: boost as any, updated_at: now },
      { key: "geo_coupons_enabled", value: geoCoupons as any, updated_at: now },
      { key: "kyb_settings", value: kyb as any, updated_at: now },
      { key: "vendor_monetization", value: vendorMonetization as any, updated_at: now },
    ];

    // Keep service_packages price in sync for MM plan
    await fromTableSafeUpdateMmPrice(vendorMonetization.mm_numbers_monthly_price_usd);

    // Single source of truth for wallet commission credit path
    try {
      const { data: pricingRow } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "pricing_defaults")
        .maybeSingle();
      const pricing = { ...((pricingRow?.value as object) || {}) } as Record<string, unknown>;
      pricing.platform_commission_default = vendorMonetization.default_commission_pct;
      upserts.push({
        key: "pricing_defaults",
        value: pricing as any,
        updated_at: now,
      });
    } catch {
      /* best-effort — vendor_monetization still saved */
    }

    let hasError = false;
    for (const u of upserts) {
      const { error } = await supabase.from("platform_settings").upsert(u, { onConflict: "key" });
      if (error) { hasError = true; toast.error(error.message); break; }
    }
    if (!hasError) toast.success("Paramètres de monétisation enregistrés");
    setSaving(false);
  };

  const inputClass = "w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20";

  return (
    <div className="space-y-6">
      {/* Vendor free + commission + MM */}
      <section className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Percent size={18} className="text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Vendeur gratuit + commission + MM</h2>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Catalogue gratuit (max produits)</label>
            <input type="number" min={1} value={vendorMonetization.free_max_products}
              onChange={e => setVendorMonetization(p => ({ ...p, free_max_products: Number(e.target.value) }))}
              className={inputClass} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Promos actives max (free)</label>
            <input type="number" min={1} value={vendorMonetization.free_max_promos}
              onChange={e => setVendorMonetization(p => ({ ...p, free_max_promos: Number(e.target.value) }))}
              className={inputClass} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Commission défaut (%)</label>
            <input type="number" min={0} step={0.1} value={vendorMonetization.default_commission_pct}
              onChange={e => setVendorMonetization(p => ({ ...p, default_commission_pct: Number(e.target.value) }))}
              className={inputClass} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1 flex items-center gap-1">
              <Phone size={12} /> Forfait MM mensuel ($)
            </label>
            <input type="number" min={0.99} step={0.01} value={vendorMonetization.mm_numbers_monthly_price_usd}
              onChange={e => setVendorMonetization(p => ({ ...p, mm_numbers_monthly_price_usd: Number(e.target.value) }))}
              className={inputClass} />
          </div>
        </div>
      </section>

      {/* KYB thresholds */}
      <section className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck size={18} className="text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Seuils KYB différé (GMV livré)</h2>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Local ($)</label>
            <input type="number" min={0} value={kyb.threshold_local_usd}
              onChange={e => setKyb(p => ({ ...p, threshold_local_usd: Number(e.target.value) }))}
              className={inputClass} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">International ($)</label>
            <input type="number" min={0} value={kyb.threshold_international_usd}
              onChange={e => setKyb(p => ({ ...p, threshold_international_usd: Number(e.target.value) }))}
              className={inputClass} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Alerte soft (ratio)</label>
            <input type="number" min={0.1} max={1} step={0.05} value={kyb.soft_warn_ratio}
              onChange={e => setKyb(p => ({ ...p, soft_warn_ratio: Number(e.target.value) }))}
              className={inputClass} />
          </div>
        </div>
      </section>

      {/* Tipping */}
      <section className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <HandCoins size={18} className="text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Pourboire livreur</h2>
        </div>
        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg mb-3">
          <div>
            <p className="text-sm font-medium text-foreground">Activer les pourboires</p>
            <p className="text-xs text-muted-foreground">Le client peut laisser un tip après livraison</p>
          </div>
          <Switch checked={tipping.enabled} onCheckedChange={v => setTipping(p => ({ ...p, enabled: v }))} />
        </div>
        {tipping.enabled && (
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Montant max ($)</label>
            <input type="number" min={1} max={100} value={tipping.max_amount} onChange={e => setTipping(p => ({ ...p, max_amount: Number(e.target.value) }))} className={inputClass + " max-w-[150px]"} />
          </div>
        )}
      </section>

      {/* Premium */}
      <section className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Crown size={18} className="text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Abonnement Premium Client</h2>
        </div>
        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg mb-3">
          <div>
            <p className="text-sm font-medium text-foreground">Activer l&apos;abonnement premium</p>
            <p className="text-xs text-muted-foreground">Livraison gratuite illimitée moyennant un forfait mensuel</p>
          </div>
          <Switch checked={premium.enabled} onCheckedChange={v => setPremium(p => ({ ...p, enabled: v }))} />
        </div>
        {premium.enabled && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Nom du plan</label>
              <input value={premium.plan_name} onChange={e => setPremium(p => ({ ...p, plan_name: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Prix mensuel ($)</label>
              <input type="number" min={0.99} step={0.01} value={premium.monthly_price} onChange={e => setPremium(p => ({ ...p, monthly_price: Number(e.target.value) }))} className={inputClass} />
            </div>
          </div>
        )}
      </section>

      {/* Vendor Boost */}
      <section className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Rocket size={18} className="text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Boost Vendeur</h2>
        </div>
        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg mb-3">
          <div>
            <p className="text-sm font-medium text-foreground">Activer le boost vendeur</p>
            <p className="text-xs text-muted-foreground">Le vendeur paye pour apparaître en tête des résultats</p>
          </div>
          <Switch checked={boost.enabled} onCheckedChange={v => setBoost(p => ({ ...p, enabled: v }))} />
        </div>
        {boost.enabled && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Prix / jour ($)</label>
              <input type="number" min={0.5} step={0.5} value={boost.daily_price} onChange={e => setBoost(p => ({ ...p, daily_price: Number(e.target.value) }))} className={inputClass} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Durée max (jours)</label>
              <input type="number" min={1} max={365} value={boost.max_days} onChange={e => setBoost(p => ({ ...p, max_days: Number(e.target.value) }))} className={inputClass} />
            </div>
          </div>
        )}
      </section>

      {/* Geo Coupons */}
      <section className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Crown size={18} className="text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Coupons géo-ciblés</h2>
        </div>
        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
          <div>
            <p className="text-sm font-medium text-foreground">Activer les coupons géo-ciblés</p>
            <p className="text-xs text-muted-foreground">Promotions filtrées par ville/pays du client</p>
          </div>
          <Switch checked={geoCoupons.enabled} onCheckedChange={v => setGeoCoupons({ enabled: v })} />
        </div>
      </section>

      <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        Enregistrer
      </button>
    </div>
  );
}

async function fromTableSafeUpdateMmPrice(monthly: number) {
  try {
    await (supabase as any)
      .from("service_packages")
      .update({
        price_monthly: monthly,
        price_yearly: Number((monthly * 10).toFixed(2)),
        updated_at: new Date().toISOString(),
      })
      .eq("slug", "vendor_mm_numbers");
  } catch {
    // best-effort
  }
}
