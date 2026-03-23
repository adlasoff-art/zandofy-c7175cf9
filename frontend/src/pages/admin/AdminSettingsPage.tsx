import { AdminLayout } from "@/components/admin/AdminLayout";
import { Key, DollarSign, Bell, Save, Truck, Loader2, Users, AlertTriangle, Calculator } from "lucide-react";
import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FreeShippingConfig {
  enabled: boolean;
  amount: number;
  currency: string;
}

interface ReferralConfig {
  enabled: boolean;
  commission_pct: number;
  max_rewarded_orders: number;
  welcome_discount_pct: number;
  gift_card_enabled: boolean;
  points_expiry_months: number;
  points_per_dollar: number;
}

interface MaintenanceConfig {
  enabled: boolean;
  title: string;
  message: string;
  end_time: string;
  duration_minutes: number;
}

interface PricingConfig {
  margin_pct: number;
  multiplier: number;
  max_extra_margin_under_50: number;
  max_extra_margin_over_100: number;
  platform_commission_default: number;
}

interface BulkTierConfig {
  min_quantity: number;
  discount_pct: number;
}

export default function AdminSettingsPage() {
  const [trackingProvider, setTrackingProvider] = useState("17track");
  const [freeShipping, setFreeShipping] = useState<FreeShippingConfig>({ enabled: true, amount: 49, currency: "USD" });
  const [referral, setReferral] = useState<ReferralConfig>({ enabled: true, commission_pct: 3, max_rewarded_orders: 3, welcome_discount_pct: 5, gift_card_enabled: true, points_expiry_months: 6, points_per_dollar: 100 });
  const [maintenance, setMaintenance] = useState<MaintenanceConfig>({
    enabled: false,
    title: "Maintenance en cours",
    message: "Nous effectuons une mise à jour planifiée. La plateforme sera de retour très bientôt.",
    end_time: "",
    duration_minutes: 60,
  });
  const [newnessDays, setNewnessDays] = useState(14);
  const [paymentMethods, setPaymentMethods] = useState({ mobile_money: true, stripe: true, cod: true, stripe_notice_enabled: false, stripe_notice_text: "Pour l'instant, ce moyen de paiement n'est pas actif." });
  const [pricing, setPricing] = useState<PricingConfig>({ margin_pct: 15, multiplier: 3, max_extra_margin_under_50: 0.50, max_extra_margin_over_100: 1.00, platform_commission_default: 10 });
  const [bulkTiers, setBulkTiers] = useState<BulkTierConfig[]>([
    { min_quantity: 1, discount_pct: 0 },
    { min_quantity: 100, discount_pct: 5 },
    { min_quantity: 500, discount_pct: 12 },
    { min_quantity: 1000, discount_pct: 15 },
  ]);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    supabase
      .from("platform_settings")
      .select("key, value")
      .in("key", ["free_shipping_threshold", "referral_settings", "maintenance_mode", "newness_duration_days", "payment_methods", "pricing_defaults", "bulk_discount_tiers"])
      .then(({ data }) => {
        data?.forEach((row) => {
          const v = row.value as any;
          if (row.key === "free_shipping_threshold") {
            setFreeShipping({ enabled: !!v.enabled, amount: Number(v.amount) || 49, currency: v.currency || "USD" });
          } else if (row.key === "referral_settings") {
            setReferral({
              enabled: v.enabled !== false,
              commission_pct: Number(v.commission_pct) || 5,
              max_rewarded_orders: Number(v.max_rewarded_orders) || 5,
              welcome_discount_pct: Number(v.welcome_discount_pct) || 10,
              gift_card_enabled: !!v.gift_card_enabled,
              points_expiry_months: Number(v.points_expiry_months) || 12,
              points_per_dollar: Number(v.points_per_dollar) || 50,
            });
          } else if (row.key === "maintenance_mode") {
            setMaintenance({
              enabled: !!v.enabled,
              title: v.title || "Maintenance en cours",
              message: v.message || "",
              end_time: v.end_time || "",
              duration_minutes: Number(v.duration_minutes) || 60,
            });
          } else if (row.key === "newness_duration_days") {
            setNewnessDays(Number(v) || 14);
          } else if (row.key === "payment_methods") {
            setPaymentMethods({ mobile_money: v.mobile_money !== false, stripe: v.stripe !== false, cod: v.cod !== false, stripe_notice_enabled: !!v.stripe_notice_enabled, stripe_notice_text: v.stripe_notice_text || "Pour l'instant, ce moyen de paiement n'est pas actif." });
          } else if (row.key === "pricing_defaults") {
            setPricing({
              margin_pct: Number(v.margin_pct) || 15,
              multiplier: Number(v.multiplier) || 3,
              max_extra_margin_under_50: Number(v.max_extra_margin_under_50) || 0.50,
              max_extra_margin_over_100: Number(v.max_extra_margin_over_100) || 1.00,
              platform_commission_default: Number(v.platform_commission_default) || 10,
            });
          } else if (row.key === "bulk_discount_tiers") {
            const tiers = Array.isArray(v?.tiers) ? v.tiers : [];
            if (tiers.length) {
              setBulkTiers(tiers.map((tier: any) => ({ min_quantity: Number(tier.min_quantity) || 1, discount_pct: Number(tier.discount_pct) || 0 })));
            }
          }
        });
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const now = new Date().toISOString();

    const { error: e1 } = await supabase
      .from("platform_settings")
      .upsert({ key: "free_shipping_threshold", value: freeShipping as any, updated_at: now }, { onConflict: "key" });

    const { error: e2 } = await supabase
      .from("platform_settings")
      .upsert({ key: "referral_settings", value: referral as any, updated_at: now }, { onConflict: "key" });

    // Compute end_time from duration if enabling
    const maintenanceToSave = { ...maintenance };
    if (maintenance.enabled && !maintenance.end_time) {
      maintenanceToSave.end_time = new Date(Date.now() + maintenance.duration_minutes * 60 * 1000).toISOString();
    }

    const { error: e3 } = await supabase
      .from("platform_settings")
      .upsert({ key: "maintenance_mode", value: maintenanceToSave as any, updated_at: now }, { onConflict: "key" });

    const { error: e4 } = await supabase
      .from("platform_settings")
      .upsert({ key: "newness_duration_days", value: newnessDays as any, updated_at: now }, { onConflict: "key" });

    const { error: e5 } = await supabase
      .from("platform_settings")
      .upsert({ key: "payment_methods", value: paymentMethods as any, updated_at: now }, { onConflict: "key" });

    const { error: e6 } = await supabase
      .from("platform_settings")
      .upsert({ key: "pricing_defaults", value: pricing as any, updated_at: now }, { onConflict: "key" });

    const { error: e7 } = await supabase
      .from("platform_settings")
      .upsert({ key: "bulk_discount_tiers", value: { tiers: bulkTiers } as any, updated_at: now }, { onConflict: "key" });

    const error = e1 || e2 || e3 || e4 || e5 || e6 || e7;
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Paramètres enregistrés", description: "Les paramètres ont été mis à jour avec succès." });
    }
    setSaving(false);
  };

  const inputClass = "w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20";

  return (
    <AdminLayout title="Paramètres">
      <div className="space-y-6 max-w-2xl">
        {/* Newness Duration */}
        <section className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Bell size={18} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Durée "Nouveautés"</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Nombre de jours pendant lesquels un produit nouvellement ajouté apparaît dans la section "Nouveautés".
          </p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={90}
              value={newnessDays}
              onChange={(e) => setNewnessDays(Number(e.target.value) || 14)}
              className={inputClass + " max-w-[100px]"}
            />
            <span className="text-sm text-muted-foreground">jours</span>
          </div>
        </section>

        {/* Payment Methods Toggle */}
        <section className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign size={18} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Moyens de paiement</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-3">Activez ou désactivez les moyens de paiement disponibles pour les clients.</p>
          <div className="space-y-3">
            {([
              { key: "stripe" as const, label: "Carte bancaire (Visa, Mastercard)" },
              { key: "mobile_money" as const, label: "Mobile Money (Orange, M-Pesa, Airtel)" },
              { key: "cod" as const, label: "Paiement à la livraison (COD)" },
            ]).map((pm) => (
              <div key={pm.key} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm text-foreground">{pm.label}</span>
                <Switch checked={paymentMethods[pm.key]} onCheckedChange={(v) => setPaymentMethods((prev) => ({ ...prev, [pm.key]: v }))} />
              </div>
            ))}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm text-foreground">Afficher le message d’indisponibilité carte</p>
                <p className="text-xs text-muted-foreground">Si activé et la carte est désactivée, le client voit un message au lieu d’un choix caché.</p>
              </div>
              <Switch checked={paymentMethods.stripe_notice_enabled} onCheckedChange={(v) => setPaymentMethods((prev) => ({ ...prev, stripe_notice_enabled: v }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Message carte bancaire</label>
              <input type="text" value={paymentMethods.stripe_notice_text} onChange={(e) => setPaymentMethods((prev) => ({ ...prev, stripe_notice_text: e.target.value }))} className={inputClass} />
            </div>
          </div>
        </section>

        <section className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calculator size={18} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Paliers globaux prix dégressifs</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {bulkTiers.map((tier, index) => (
              <div key={tier.min_quantity} className="grid grid-cols-2 gap-2">
                <input type="number" min={1} value={tier.min_quantity} onChange={(e) => setBulkTiers((prev) => prev.map((item, i) => i === index ? { ...item, min_quantity: Number(e.target.value) || 1 } : item))} className={inputClass} />
                <input type="number" min={0} max={100} step={1} value={tier.discount_pct} onChange={(e) => setBulkTiers((prev) => prev.map((item, i) => i === index ? { ...item, discount_pct: Number(e.target.value) || 0 } : item))} className={inputClass} />
              </div>
            ))}
          </div>
        </section>

        {/* Pricing Defaults */}
        <section className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calculator size={18} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Tarification intelligente</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Paramètres par défaut du calcul automatique des prix pour les vendeurs.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Marge (%)</label>
              <input
                type="number"
                min={1}
                max={100}
                step={1}
                value={pricing.margin_pct}
                onChange={(e) => setPricing((p) => ({ ...p, margin_pct: Number(e.target.value) || 15 }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Multiplicateur</label>
              <input
                type="number"
                min={1}
                max={10}
                step={0.5}
                value={pricing.multiplier}
                onChange={(e) => setPricing((p) => ({ ...p, multiplier: Number(e.target.value) || 3 }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Marge vendeur max (&lt;50$)</label>
              <input
                type="number"
                min={0}
                max={5}
                step={0.1}
                value={pricing.max_extra_margin_under_50}
                onChange={(e) => setPricing((p) => ({ ...p, max_extra_margin_under_50: Number(e.target.value) || 0 }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Marge vendeur max (≥100$)</label>
              <input
                type="number"
                min={0}
                max={10}
                step={0.1}
                value={pricing.max_extra_margin_over_100}
                onChange={(e) => setPricing((p) => ({ ...p, max_extra_margin_over_100: Number(e.target.value) || 0 }))}
                className={inputClass}
              />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-3">
            Formule : prix = coût + (coût × marge% / 100) × multiplicateur. Arrondi stratégique (.99/.49).
          </p>
          <div className="mt-4 pt-4 border-t border-border">
            <label className="text-xs text-muted-foreground block mb-1">Commission plateforme par défaut (%)</label>
            <p className="text-[10px] text-muted-foreground mb-2">Appliquée aux vendeurs indépendants sans surcharge spécifique.</p>
            <input
              type="number"
              min={0}
              max={50}
              step={0.5}
              value={pricing.platform_commission_default}
              onChange={(e) => setPricing((p) => ({ ...p, platform_commission_default: Number(e.target.value) || 10 }))}
              className={inputClass + " max-w-[200px]"}
            />
          </div>
        </section>

        <section className="bg-card border-2 border-destructive/30 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={18} className="text-destructive" />
            <h2 className="text-sm font-semibold text-foreground">Mode maintenance</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-destructive/5 rounded-lg">
              <div>
                <p className="text-sm font-medium text-foreground">Activer la maintenance</p>
                <p className="text-xs text-muted-foreground">Bloque l'accès à la plateforme pour tous sauf les administrateurs</p>
              </div>
              <Switch
                checked={maintenance.enabled}
                onCheckedChange={(checked) => setMaintenance(prev => ({
                  ...prev,
                  enabled: checked,
                  end_time: checked ? new Date(Date.now() + prev.duration_minutes * 60 * 1000).toISOString() : prev.end_time,
                }))}
              />
            </div>
            {maintenance.enabled && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Titre affiché</label>
                  <input
                    type="text"
                    value={maintenance.title}
                    onChange={(e) => setMaintenance(prev => ({ ...prev, title: e.target.value }))}
                    className={inputClass}
                    placeholder="Maintenance en cours"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Message affiché</label>
                  <textarea
                    value={maintenance.message}
                    onChange={(e) => setMaintenance(prev => ({ ...prev, message: e.target.value }))}
                    className={inputClass + " min-h-[80px] resize-y"}
                    placeholder="Nous effectuons une mise à jour planifiée..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Durée (minutes)</label>
                    <input
                      type="number"
                      min={5}
                      max={1440}
                      step={5}
                      value={maintenance.duration_minutes}
                      onChange={(e) => {
                        const mins = Number(e.target.value);
                        setMaintenance(prev => ({
                          ...prev,
                          duration_minutes: mins,
                          end_time: new Date(Date.now() + mins * 60 * 1000).toISOString(),
                        }));
                      }}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Fin estimée</label>
                    <input
                      type="text"
                      readOnly
                      value={maintenance.end_time ? new Date(maintenance.end_time).toLocaleString("fr-FR") : "—"}
                      className={inputClass + " bg-muted/50 cursor-not-allowed"}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  💡 Astuce admin : Double-cliquez en bas à droite de la page de maintenance et entrez <code className="bg-muted px-1 rounded">zandofy-admin-bypass</code> pour accéder au site.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Free Shipping Threshold */}
        <section className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Truck size={18} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Seuil de livraison gratuite</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div>
                <p className="text-sm font-medium text-foreground">Activer la livraison gratuite</p>
                <p className="text-xs text-muted-foreground">Les commandes au-dessus du seuil bénéficient de la livraison gratuite</p>
              </div>
              <Switch checked={freeShipping.enabled} onCheckedChange={(checked) => setFreeShipping(prev => ({ ...prev, enabled: checked }))} />
            </div>
            {freeShipping.enabled && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Montant minimum ($)</label>
                  <input type="number" min={0} step={1} value={freeShipping.amount} onChange={(e) => setFreeShipping(prev => ({ ...prev, amount: Number(e.target.value) }))} className={inputClass} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Devise</label>
                  <select value={freeShipping.currency} onChange={(e) => setFreeShipping(prev => ({ ...prev, currency: e.target.value }))} className={inputClass}>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="XAF">XAF (FCFA)</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Referral Settings */}
        <section className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users size={18} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Programme de parrainage</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div>
                <p className="text-sm font-medium text-foreground">Activer le parrainage</p>
                <p className="text-xs text-muted-foreground">Les utilisateurs peuvent parrainer et gagner des ZandoPoints</p>
              </div>
              <Switch checked={referral.enabled} onCheckedChange={(checked) => setReferral(prev => ({ ...prev, enabled: checked }))} />
            </div>
            {referral.enabled && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Commission (%)</label>
                    <input type="number" min={0} max={50} step={1} value={referral.commission_pct} onChange={(e) => setReferral(prev => ({ ...prev, commission_pct: Number(e.target.value) }))} className={inputClass} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Commandes max récompensées</label>
                    <input type="number" min={1} max={100} step={1} value={referral.max_rewarded_orders} onChange={(e) => setReferral(prev => ({ ...prev, max_rewarded_orders: Number(e.target.value) }))} className={inputClass} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Remise bienvenue filleul (%)</label>
                    <input type="number" min={0} max={50} step={1} value={referral.welcome_discount_pct} onChange={(e) => setReferral(prev => ({ ...prev, welcome_discount_pct: Number(e.target.value) }))} className={inputClass} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Expiration des points (mois)</label>
                    <input type="number" min={1} max={60} step={1} value={referral.points_expiry_months} onChange={(e) => setReferral(prev => ({ ...prev, points_expiry_months: Number(e.target.value) }))} className={inputClass} />
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg mt-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Conversion en carte cadeau</p>
                    <p className="text-xs text-muted-foreground">Permettre aux clients de convertir leurs points en carte cadeau</p>
                  </div>
                  <Switch checked={referral.gift_card_enabled} onCheckedChange={(checked) => setReferral(prev => ({ ...prev, gift_card_enabled: checked }))} />
                </div>
                <div className="mt-3">
                  <label className="text-xs text-muted-foreground block mb-1">Taux de conversion (points pour 1$)</label>
                  <input type="number" min={1} max={500} step={1} value={referral.points_per_dollar} onChange={(e) => setReferral(prev => ({ ...prev, points_per_dollar: Math.max(1, Number(e.target.value)) }))} className={inputClass} />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {referral.points_per_dollar} ZandoPoints = $1 USD · Exemple : 500 pts = ${(500 / referral.points_per_dollar).toFixed(2)}
                  </p>
                </div>
              </>
            )}
          </div>
        </section>

        {/* API Keys */}
        <section className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Key size={18} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Clés API</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Fournisseur de tracking</label>
              <div className="flex gap-2">
                {["17track", "AfterShip"].map((p) => (
                  <button key={p} onClick={() => setTrackingProvider(p)} className={`px-4 py-2 text-sm rounded-lg border transition-colors ${trackingProvider === p ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:border-primary/50"}`}>{p}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Clé API {trackingProvider}</label>
              <input type="password" placeholder="••••••••••••••••" className={inputClass} />
            </div>
          </div>
        </section>

        {/* Shipping rates */}
        <section className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign size={18} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Tarifs d'expédition</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: "Livraison locale (Kinshasa)", value: "$3.00" },
              { label: "Livraison nationale (RDC)", value: "$8.00" },
              { label: "Livraison Afrique de l'Ouest", value: "$15.00" },
              { label: "Livraison internationale", value: "$25.00" },
            ].map((r) => (
              <div key={r.label}>
                <label className="text-xs text-muted-foreground block mb-1">{r.label}</label>
                <input defaultValue={r.value} className={inputClass} />
              </div>
            ))}
          </div>
        </section>

        {/* Notifications */}
        <section className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Bell size={18} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Notifications globales</h2>
          </div>
          <div className="space-y-3">
            {[
              { label: "Notifications Push", desc: "Envoyer des notifications push aux utilisateurs", enabled: true },
              { label: "Alertes Email", desc: "Emails de confirmation et suivi de commande", enabled: true },
              { label: "Alertes SMS", desc: "SMS pour les livreurs et transporteurs", enabled: false },
            ].map((n) => (
              <div key={n.label} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-foreground">{n.label}</p>
                  <p className="text-xs text-muted-foreground">{n.desc}</p>
                </div>
                <button className={`w-10 h-6 rounded-full transition-colors ${n.enabled ? "bg-primary" : "bg-border"}`}>
                  <span className={`block w-4 h-4 rounded-full bg-white shadow transition-transform ${n.enabled ? "translate-x-5" : "translate-x-1"}`} />
                </button>
              </div>
            ))}
          </div>
        </section>

        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Enregistrer les paramètres
        </button>
      </div>
    </AdminLayout>
  );
}
