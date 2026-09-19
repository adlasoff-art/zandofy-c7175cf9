/**
 * Vendor payment modes: MoMo / Carte (Keccel) / Hors plateforme.
 * Persists via SECURITY DEFINER RPC vendor_update_payment_modes.
 */
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CreditCard, Smartphone, Banknote, Loader2, Save, Info } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { useVendorOffPlatformAccess } from "@/hooks/use-vendor-off-platform-access";
import { VendorPaymentNumbers } from "@/components/vendor/VendorPaymentNumbers";

interface Props {
  storeId: string;
}

export function VendorPaymentModesTab({ storeId }: Props) {
  const queryClient = useQueryClient();
  const { data: access } = useVendorOffPlatformAccess(storeId);

  const { data: override, isLoading } = useQuery({
    queryKey: ["vendor-payment-modes", storeId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("vendor_pricing_overrides")
        .select(
          "vendor_mobile_money_enabled, vendor_card_enabled, vendor_off_platform_enabled",
        )
        .eq("store_id", storeId)
        .maybeSingle();
      return data;
    },
  });

  const [mobileMoney, setMobileMoney] = useState(true);
  const [card, setCard] = useState(true);
  const [offPlatform, setOffPlatform] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!override) return;
    setMobileMoney(override.vendor_mobile_money_enabled !== false);
    setCard(override.vendor_card_enabled !== false);
    setOffPlatform(override.vendor_off_platform_enabled === true);
  }, [override]);

  const handleSave = async () => {
    if (!mobileMoney && !card && !offPlatform) {
      toast.error("Sélectionnez au moins un mode de perception");
      return;
    }
    setSaving(true);
    try {
      const { error } = await (supabase as any).rpc("vendor_update_payment_modes", {
        p_store_id: storeId,
        p_mobile_money: mobileMoney,
        p_card: card,
        p_off_platform: offPlatform,
      });
      if (error) throw error;
      toast.success("Modes de paiement enregistrés");
      queryClient.invalidateQueries({ queryKey: ["vendor-payment-modes", storeId] });
      queryClient.invalidateQueries({ queryKey: ["vendor-off-platform-access", storeId] });
      queryClient.invalidateQueries({ queryKey: ["vendor-autonomous", storeId] });
    } catch (e: any) {
      toast.error(e?.message || "Impossible d'enregistrer");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  const modes = [
    {
      key: "mm" as const,
      label: "Mobile Money (KelPay)",
      desc: "Le client paie via Orange / M-Pesa / Airtel sur Zandofy. Encaissement plateforme.",
      icon: Smartphone,
      checked: mobileMoney,
      onChange: setMobileMoney,
    },
    {
      key: "card" as const,
      label: "Carte bancaire (Keccel)",
      desc: "Visa / Mastercard via Keccel sur Zandofy. Pas de compte Stripe requis.",
      icon: CreditCard,
      checked: card,
      onChange: setCard,
    },
    {
      key: "off" as const,
      label: "Hors plateforme",
      desc: "Le client paie vos numéros / QR directement, puis envoie une preuve. Essai 30 jours puis abonnement.",
      icon: Banknote,
      checked: offPlatform,
      onChange: setOffPlatform,
    },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-base font-bold text-foreground">Perception des paiements</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Choisissez comment vos clients peuvent vous payer. Au moins un mode requis.
        </p>
      </div>

      <div className="space-y-3">
        {modes.map((m) => {
          const Icon = m.icon;
          return (
            <label
              key={m.key}
              className={`flex gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                m.checked ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
              }`}
            >
              <input
                type="checkbox"
                className="mt-1"
                checked={m.checked}
                onChange={(e) => m.onChange(e.target.checked)}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Icon size={16} className="text-primary shrink-0" />
                  {m.label}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">{m.desc}</p>
              </div>
            </label>
          );
        })}
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        Enregistrer
      </button>

      {offPlatform && (
        <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info size={14} className="shrink-0 mt-0.5 text-primary" />
            <div>
              {access?.reason === "trial" && access.trialEndsAt && (
                <p>
                  Essai hors plateforme actif jusqu’au{" "}
                  <strong className="text-foreground">
                    {new Date(access.trialEndsAt).toLocaleDateString("fr-FR")}
                  </strong>
                  {access.daysLeft != null ? ` (${access.daysLeft} j restants)` : ""}.
                </p>
              )}
              {access?.reason === "subscription" && (
                <p>Accès hors plateforme via votre abonnement numéros Mobile Money.</p>
              )}
              {access?.reason === "grant" && (
                <p>Accès hors plateforme accordé par l’administration.</p>
              )}
              {access && !access.allowed && (
                <p>
                  Essai terminé. Souscrivez le forfait numéros pour continuer à afficher vos
                  numéros / QR.{" "}
                  <Link to="/pricing" className="text-primary underline">
                    Voir les tarifs
                  </Link>
                </p>
              )}
            </div>
          </div>
          <VendorPaymentNumbers storeId={storeId} />
        </div>
      )}
    </div>
  );
}
