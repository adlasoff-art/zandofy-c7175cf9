import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/lib/supabase-helpers";
import { Crown, Percent, ShoppingBag, Phone, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { VENDOR_TIERS } from "@/lib/vendor-tiers";
import { SubscriptionCheckoutDialog } from "@/components/payments/SubscriptionCheckoutDialog";
import { Link } from "react-router-dom";
import {
  DEFAULT_GATEWAY_FEES,
  estimateVendorNet,
  parseGatewayFees,
  type GatewayFees,
} from "@/lib/gateway-fees";
import { useVendorOffPlatformAccess } from "@/hooks/use-vendor-off-platform-access";

interface Props {
  storeId: string;
}

export function VendorPricingTab({ storeId }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [checkoutPkg, setCheckoutPkg] = useState<any>(null);

  const { data: mmPackage, isLoading } = useQuery({
    queryKey: ["service-package-mm"],
    queryFn: async () => {
      const { data } = await fromTable("service_packages")
        .select("*")
        .eq("slug", "vendor_mm_numbers")
        .eq("is_active", true)
        .maybeSingle();
      return data;
    },
  });

  const { data: currentSub } = useQuery({
    queryKey: ["store-package-sub", storeId],
    queryFn: async () => {
      const { data } = await fromTable("store_package_subscriptions")
        .select("*, service_packages(*)")
        .eq("store_id", storeId)
        .eq("is_active", true)
        .maybeSingle();
      return data;
    },
  });

  const { data: vendorSub } = useQuery({
    queryKey: ["vendor-subscription-tier", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("vendor_subscriptions")
        .select("*")
        .eq("store_id", storeId)
        .maybeSingle();
      return data;
    },
  });

  const { data: kycVerified } = useQuery({
    queryKey: ["kyc-status-vendor", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await (supabase as any)
        .from("kyc_verifications")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });

  const { data: commissionRate } = useQuery({
    queryKey: ["commission-rate-vendor", storeId],
    queryFn: async () => {
      const { data: override } = await (supabase as any)
        .from("vendor_pricing_overrides")
        .select("commission_rate")
        .eq("store_id", storeId)
        .maybeSingle();
      if (override?.commission_rate != null) return override.commission_rate;
      const { data: settings } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "pricing_defaults")
        .maybeSingle();
      return (settings?.value as any)?.platform_commission_default ?? 10;
    },
  });

  const { data: productOverride } = useQuery({
    queryKey: ["product-override", storeId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("vendor_pricing_overrides")
        .select("max_products_override, vendor_custom_payment_numbers_enabled, mm_granted_by_admin")
        .eq("store_id", storeId)
        .maybeSingle();
      return data;
    },
  });

  const { data: monetization } = useQuery({
    queryKey: ["vendor-monetization-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "vendor_monetization")
        .maybeSingle();
      return (data?.value as any) || {};
    },
  });

  const { data: gatewayFees = DEFAULT_GATEWAY_FEES } = useQuery({
    queryKey: ["gateway-fees-vendor-pricing"],
    queryFn: async (): Promise<GatewayFees> => {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "gateway_fees")
        .maybeSingle();
      return parseGatewayFees(data?.value);
    },
  });

  const { data: offAccess } = useVendorOffPlatformAccess(storeId);

  const currentTier = (vendorSub as any)?.tier || "beginner";
  const tierConfig = VENDOR_TIERS[currentTier as keyof typeof VENDOR_TIERS] || VENDOR_TIERS.beginner;
  const freeMax = monetization?.free_max_products ?? productOverride?.max_products_override ?? (vendorSub as any)?.max_products ?? tierConfig.maxProducts;
  const mmPrice = mmPackage?.price_monthly ?? monetization?.mm_numbers_monthly_price_usd ?? 9.99;
  const hasMm =
    ((currentSub as any)?.service_packages?.slug === "vendor_mm_numbers" &&
      (!(currentSub as any)?.paid_until || new Date((currentSub as any).paid_until).getTime() > Date.now())) ||
    (productOverride?.vendor_custom_payment_numbers_enabled === true &&
      (productOverride as any)?.mm_granted_by_admin === true);

  const commissionPct = Number(commissionRate ?? monetization?.default_commission_pct ?? 10);
  const sampleGross = 100;
  const netMoMo = estimateVendorNet(sampleGross, commissionPct, "mobile_money", gatewayFees);
  const netCard = estimateVendorNet(sampleGross, commissionPct, "card", gatewayFees);

  const handleSubscriptionSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["store-package-sub", storeId] });
    queryClient.invalidateQueries({ queryKey: ["vendor-subscription-tier", storeId] });
    queryClient.invalidateQueries({ queryKey: ["product-override", storeId] });
    setCheckoutPkg(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Vendre gratuitement</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Pas d&apos;abonnement obligatoire. La plateforme prélève une commission sur chaque commande livrée.
        </p>
      </div>

      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Percent size={18} className="text-primary" />
          <h3 className="text-sm font-bold text-foreground">Commission plateforme</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Taux actuel :{" "}
          <span className="font-bold text-foreground text-lg">{commissionPct}%</span>
          {" "}sur chaque vente livrée.
        </p>
        <p className="text-[11px] text-muted-foreground leading-relaxed" title="Estimation indicative — hors coûts produit">
          Ex. sur $100 brut : net ≈ ${netMoMo.net.toFixed(2)} (MoMo, −${netMoMo.commission.toFixed(2)} commission −${netMoMo.gatewayFee.toFixed(2)} frais)
          {" · "}
          ≈ ${netCard.net.toFixed(2)} (Carte Keccel, −${netCard.commission.toFixed(2)} −${netCard.gatewayFee.toFixed(2)})
        </p>
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          <Badge className={tierConfig.badgeClass}>Gratuit</Badge>
          <span className="flex items-center gap-1">
            <ShoppingBag size={14} />
            Catalogue jusqu&apos;à <strong className="text-foreground">{freeMax}</strong> produits
          </span>
        </div>
      </div>

      {offAccess?.reason === "trial" && offAccess.trialEndsAt && (
        <div className="text-xs text-amber-800 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
          Essai hors plateforme jusqu&apos;au {new Date(offAccess.trialEndsAt).toLocaleDateString("fr-FR")}
          {offAccess.daysLeft != null ? ` (${offAccess.daysLeft} j)` : ""}.{" "}
          {!hasMm && (
            <button
              type="button"
              className="underline text-primary"
              onClick={() => mmPackage && setCheckoutPkg(mmPackage)}
            >
              Souscrire le forfait numéros
            </button>
          )}
        </div>
      )}

      {/* MM upsell — single clear card */}
      <div className="bg-card border-2 border-primary/30 rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Phone size={18} className="text-primary" />
            <h3 className="text-sm font-bold text-foreground">Forfait numéros Mobile Money</h3>
          </div>
          {hasMm && <Badge>Actif</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          Affichez vos propres numéros au checkout boutique. Sans forfait, les clients paient via les canaux plateforme Zandofy.
        </p>
        <ul className="text-xs text-muted-foreground space-y-1">
          <li className="flex items-center gap-2"><Check size={12} className="text-primary" /> Orange Money, M-Pesa, Airtel, AfriMoney</li>
          <li className="flex items-center gap-2"><Check size={12} className="text-primary" /> Self-serve — activation après paiement</li>
        </ul>
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <span className="text-2xl font-bold text-foreground">${Number(mmPrice).toFixed(2)}</span>
            <span className="text-xs text-muted-foreground"> / mois</span>
          </div>
          {isLoading ? (
            <div className="h-9 w-28 bg-muted animate-pulse rounded-lg" />
          ) : hasMm ? (
            <Link
              to="/vendor"
              className="text-xs font-medium text-primary underline-offset-2 hover:underline"
              onClick={() => { /* settings tab has numbers */ }}
            >
              Gérer les numéros dans Paramètres
            </Link>
          ) : (
            <button
              onClick={() => mmPackage && setCheckoutPkg(mmPackage)}
              disabled={!kycVerified || !mmPackage}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {!kycVerified ? "KYC requis" : !mmPackage ? "Bientôt disponible" : "S'abonner"}
            </button>
          )}
        </div>
      </div>

      {currentSub && (currentSub as any)?.service_packages?.slug !== "vendor_mm_numbers" && (
        <div className="bg-muted/40 border border-border rounded-lg p-3 text-xs text-muted-foreground">
          <Crown size={14} className="inline mr-1" />
          Package historique actif : {(currentSub as any)?.service_packages?.name}
          {(currentSub as any)?.paid_until && (
            <> — payé jusqu&apos;au {new Date((currentSub as any).paid_until).toLocaleDateString("fr-FR")}</>
          )}
        </div>
      )}

      {checkoutPkg && (
        <SubscriptionCheckoutDialog
          open={!!checkoutPkg}
          onOpenChange={(o) => !o && setCheckoutPkg(null)}
          itemName={checkoutPkg.name}
          price={checkoutPkg.price_monthly}
          billingCycle="monthly"
          subscriptionType="package"
          packageId={checkoutPkg.id}
          storeId={storeId}
          onSuccess={handleSubscriptionSuccess}
        />
      )}
    </div>
  );
}
