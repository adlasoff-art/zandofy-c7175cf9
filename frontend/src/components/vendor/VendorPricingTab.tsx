import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/lib/supabase-helpers";
import { Check, Crown, Truck, Package, Warehouse, Percent, Shield, Star, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

interface Props {
  storeId: string;
}

const visibilityLabels: Record<string, string> = {
  standard: "Standard",
  badge_verified: "Badge vérifié",
  homepage_promo: "Accueil & Promo",
  dedicated_manager: "Gestionnaire dédié",
};

export function VendorPricingTab({ storeId }: Props) {
  const { user } = useAuth();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  // Fetch service packages
  const { data: packages = [], isLoading } = useQuery({
    queryKey: ["service-packages-vendor"],
    queryFn: async () => {
      const { data } = await fromTable("service_packages")
        .select("*")
        .eq("is_active", true)
        .eq("target", "vendor")
        .order("rank", { ascending: true });
      return data || [];
    },
  });

  // Fetch current subscription
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

  // Fetch KYC status
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

  // Fetch commission rate
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

  const currentPackageId = currentSub?.package_id;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Tarification & Packages</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Choisissez le package adapté à votre activité.
        </p>
      </div>

      {/* Commission rate */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Percent size={18} className="text-primary" />
          <h3 className="text-sm font-bold text-foreground">Commission plateforme</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Votre taux de commission actuel est de{" "}
          <span className="font-bold text-foreground">{commissionRate ?? 10}%</span> sur chaque vente livrée.
        </p>
      </div>

      {/* Current subscription */}
      {currentSub && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Crown size={18} className="text-primary" />
            <h3 className="text-sm font-bold text-foreground">Votre package actuel</h3>
          </div>
          <p className="text-sm text-foreground font-medium">{currentSub.service_packages?.name}</p>
          <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
            <span>Cycle: {currentSub.billing_cycle === "yearly" ? "Annuel" : "Mensuel"}</span>
            {currentSub.paid_until && <span>Payé jusqu'au: {new Date(currentSub.paid_until).toLocaleDateString("fr-FR")}</span>}
            {currentSub.trust_unlocked && <Badge variant="default" className="text-[10px]">Confiance débloquée</Badge>}
          </div>
        </div>
      )}

      {/* Package cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Package size={18} className="text-primary" />
            <h3 className="text-sm font-bold text-foreground">Packages vendeur</h3>
          </div>
          <div className="flex items-center gap-1 bg-muted rounded-full p-0.5 text-xs">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={`px-3 py-1 rounded-full transition-colors ${billingCycle === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              Mensuel
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={`px-3 py-1 rounded-full transition-colors ${billingCycle === "yearly" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              Annuel
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1, 2].map(i => <div key={i} className="h-56 bg-muted animate-pulse rounded-lg" />)}
          </div>
        ) : packages.length === 0 ? (
          <div className="text-center py-8 bg-card border border-border rounded-lg">
            <Package size={32} className="mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">Aucun package disponible.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {packages.map((pkg: any) => {
              const price = billingCycle === "yearly" ? pkg.price_yearly : pkg.price_monthly;
              const isCurrent = pkg.id === currentPackageId;
              const isUpgrade = currentSub?.service_packages?.rank != null && pkg.rank > currentSub.service_packages.rank;
              const services = pkg.included_services || [];

              return (
                <div
                  key={pkg.id}
                  className={`bg-card border-2 rounded-lg p-4 transition-colors flex flex-col ${
                    isCurrent ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-sm font-bold text-foreground">{pkg.name}</h4>
                    {isCurrent && (
                      <Badge className="text-[10px]">Actuel</Badge>
                    )}
                  </div>
                  {pkg.description && <p className="text-xs text-muted-foreground">{pkg.description}</p>}

                  <div className="mt-3">
                    <span className="text-xl font-bold text-foreground">${price}</span>
                    <span className="text-xs text-muted-foreground">/{billingCycle === "yearly" ? "an" : "mois"}</span>
                  </div>

                  <ul className="mt-3 space-y-1.5 flex-1 text-xs text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <Truck size={12} className="text-primary shrink-0" />
                      {pkg.max_deliveries_per_day} courses/jour · {pkg.max_riders} livreurs
                    </li>
                    <li className="flex items-center gap-2">
                      <Warehouse size={12} className="text-primary shrink-0" />
                      Hub: {pkg.hub_storage_free_kg > 0 ? `${pkg.hub_storage_free_kg} kg gratuit` : "Payant (0,59$/jour/kg)"}
                    </li>
                    <li className="flex items-center gap-2">
                      <Shield size={12} className="text-primary shrink-0" />
                      Retrait: {pkg.withdrawal_delay_days}j
                      {pkg.trust_threshold_months > 0 && ` (après ${pkg.trust_threshold_months} mois + $${pkg.trust_threshold_sales} ventes)`}
                    </li>
                    <li className="flex items-center gap-2">
                      <Star size={12} className="text-primary shrink-0" />
                      {visibilityLabels[pkg.visibility_level] || pkg.visibility_level}
                    </li>
                    {services.length > 0 && (
                      <li className="flex items-start gap-2">
                        <Zap size={12} className="text-primary shrink-0 mt-0.5" />
                        <span>{services.length} services inclus</span>
                      </li>
                    )}
                  </ul>

                  <button
                    disabled={!kycVerified || isCurrent}
                    className="w-full mt-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                  >
                    {isCurrent ? "Package actuel" : !kycVerified ? "KYC requis" : isUpgrade ? "Passer au supérieur" : "Souscrire"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Hub storage info */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Warehouse size={18} className="text-primary" />
          <h3 className="text-sm font-bold text-foreground">Stockage Hub</h3>
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• 14 jours de stockage gratuit (lundi – samedi, hors jours fériés)</p>
          <p>• À partir du 15ᵉ jour : <span className="font-semibold text-foreground">$0,59/jour par kg</span> pour tout stock ≥ 1 kg</p>
          <p>• Le quota gratuit dépend de votre package (ex: 10 kg pour Pro, 50 kg pour Premium)</p>
          <p>• Pénalités prélevées automatiquement sur le solde de la boutique</p>
        </div>
      </div>

      {!kycVerified && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-300 dark:border-amber-700 rounded-lg p-4 text-xs text-amber-800 dark:text-amber-300">
          ⚠️ Vous devez compléter votre vérification d'identité (KYC) pour souscrire à un package.
        </div>
      )}
    </div>
  );
}
