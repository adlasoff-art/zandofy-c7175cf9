import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Crown, Rocket, HandCoins, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface TippingConfig { enabled: boolean; max_amount: number; }
interface PremiumConfig { enabled: boolean; monthly_price: number; plan_name: string; }
interface BoostConfig { enabled: boolean; daily_price: number; max_days: number; }
interface GeoCouponsConfig { enabled: boolean; }

export function MonetizationSettings() {
  const [tipping, setTipping] = useState<TippingConfig>({ enabled: false, max_amount: 20 });
  const [premium, setPremium] = useState<PremiumConfig>({ enabled: false, monthly_price: 9.99, plan_name: "Zandofy Premium" });
  const [boost, setBoost] = useState<BoostConfig>({ enabled: false, daily_price: 5, max_days: 30 });
  const [geoCoupons, setGeoCoupons] = useState<GeoCouponsConfig>({ enabled: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("platform_settings").select("key, value")
      .in("key", ["tipping_settings", "premium_settings", "boost_settings", "geo_coupons_enabled"])
      .then(({ data }) => {
        data?.forEach(row => {
          const v = row.value as any;
          if (row.key === "tipping_settings") setTipping({ enabled: !!v?.enabled, max_amount: Number(v?.max_amount) || 20 });
          else if (row.key === "premium_settings") setPremium({ enabled: !!v?.enabled, monthly_price: Number(v?.monthly_price) || 9.99, plan_name: v?.plan_name || "Zandofy Premium" });
          else if (row.key === "boost_settings") setBoost({ enabled: !!v?.enabled, daily_price: Number(v?.daily_price) || 5, max_days: Number(v?.max_days) || 30 });
          else if (row.key === "geo_coupons_enabled") setGeoCoupons({ enabled: !!v?.enabled });
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
    ];
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
            <p className="text-sm font-medium text-foreground">Activer l'abonnement premium</p>
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
