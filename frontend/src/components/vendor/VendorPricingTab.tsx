import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Check, Crown, Truck, Package, Warehouse, Percent, ExternalLink } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";

interface Props {
  storeId: string;
}

interface ServicePlan {
  id: string;
  name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number | null;
  features: string[];
  is_active: boolean;
}

export function VendorPricingTab({ storeId }: Props) {
  const { user } = useAuth();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  // Fetch service plans
  const { data: servicePlans = [], isLoading: plansLoading } = useQuery({
    queryKey: ["platform-service-plans-vendor"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("platform_service_plans")
        .select("*")
        .eq("is_active", true)
        .order("price_monthly", { ascending: true });
      return (data || []) as ServicePlan[];
    },
  });

  // Fetch delivery subscriptions for this store
  const { data: deliverySubs = [], isLoading: subsLoading } = useQuery({
    queryKey: ["delivery-subs-vendor", storeId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("delivery_subscriptions")
        .select("*")
        .eq("store_id", storeId);
      return data || [];
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

  const isLoading = plansLoading || subsLoading;

  const deliveryTiers = [
    { tier: "standard", label: "Standard", maxRiders: 2, hub: false, deliveries: "5–10/jour", color: "border-border" },
    { tier: "professional", label: "Professionnel", maxRiders: 5, hub: true, deliveries: "20–50/jour", color: "border-primary/50" },
    { tier: "premium", label: "Premium", maxRiders: 10, hub: true, deliveries: "50–100/jour", color: "border-primary" },
  ];

  const activeDeliverySub = deliverySubs.find((s: any) => s.is_active);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Tarification & Abonnements</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Gérez vos abonnements aux services de la plateforme.
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

      {/* Service Plans */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Crown size={18} className="text-primary" />
            <h3 className="text-sm font-bold text-foreground">Plans de services</h3>
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
            {[1, 2].map(i => (
              <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : servicePlans.length === 0 ? (
          <div className="text-center py-8 bg-card border border-border rounded-lg">
            <Package size={32} className="mx-auto text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">Aucun plan de service disponible pour le moment.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {servicePlans.map(plan => {
              const price = billingCycle === "yearly" && plan.price_yearly
                ? plan.price_yearly
                : plan.price_monthly;
              const features = Array.isArray(plan.features) ? plan.features : [];
              return (
                <div key={plan.id} className="bg-card border border-border rounded-lg p-4 hover:border-primary/30 transition-colors">
                  <h4 className="text-sm font-bold text-foreground">{plan.name}</h4>
                  {plan.description && (
                    <p className="text-xs text-muted-foreground mt-1">{plan.description}</p>
                  )}
                  <div className="mt-3">
                    <span className="text-xl font-bold text-foreground">${price}</span>
                    <span className="text-xs text-muted-foreground">/{billingCycle === "yearly" ? "an" : "mois"}</span>
                  </div>
                  {features.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {features.map((f, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <Check size={14} className="text-primary shrink-0 mt-0.5" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    disabled={!kycVerified}
                    className="w-full mt-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                  >
                    {kycVerified ? "Souscrire" : "KYC requis"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delivery plans */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Truck size={18} className="text-primary" />
          <h3 className="text-sm font-bold text-foreground">Plans de livraison</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {deliveryTiers.map(tier => {
            const isActive = activeDeliverySub?.tier === tier.tier;
            return (
              <div
                key={tier.tier}
                className={`bg-card border-2 rounded-lg p-4 transition-colors ${isActive ? "border-primary bg-primary/5" : tier.color}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold text-foreground">{tier.label}</h4>
                  {isActive && (
                    <span className="text-[10px] font-semibold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                      Actif
                    </span>
                  )}
                </div>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  <li className="flex items-center gap-1.5">
                    <Check size={12} className="text-primary" />
                    {tier.deliveries}
                  </li>
                  <li className="flex items-center gap-1.5">
                    <Check size={12} className="text-primary" />
                    Jusqu'à {tier.maxRiders} livreurs
                  </li>
                  <li className="flex items-center gap-1.5">
                    {tier.hub ? (
                      <Check size={12} className="text-primary" />
                    ) : (
                      <span className="w-3 h-3 text-muted-foreground/30">—</span>
                    )}
                    Stockage Hub
                  </li>
                </ul>
                <button
                  disabled={!kycVerified || isActive}
                  className="w-full mt-3 py-2 text-xs font-semibold rounded-lg border border-primary text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isActive ? "Plan actuel" : kycVerified ? "Choisir" : "KYC requis"}
                </button>
              </div>
            );
          })}
        </div>
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
          <p>• Pénalités prélevées automatiquement sur le solde de la boutique</p>
        </div>
      </div>

      {!kycVerified && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-300 dark:border-amber-700 rounded-lg p-4 text-xs text-amber-800 dark:text-amber-300">
          ⚠️ Vous devez compléter votre vérification d'identité (KYC) pour souscrire à un service.
        </div>
      )}
    </div>
  );
}
