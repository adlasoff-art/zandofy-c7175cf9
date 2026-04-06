import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fromTable } from "@/lib/supabase-helpers";
import { Check, Package, Truck, Crown, Warehouse } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { SubscriptionCheckoutDialog } from "@/components/payments/SubscriptionCheckoutDialog";

export function CustomerPricingTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [checkoutPkg, setCheckoutPkg] = useState<any>(null);

  // Fetch client-targeted service packages
  const { data: packages = [], isLoading } = useQuery({
    queryKey: ["service-packages-client"],
    queryFn: async () => {
      const { data } = await fromTable("service_packages")
        .select("*")
        .eq("is_active", true)
        .eq("target", "client")
        .order("rank", { ascending: true });
      return data || [];
    },
  });

  // Fetch current subscription
  const { data: currentSub } = useQuery({
    queryKey: ["client-package-sub", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await fromTable("store_package_subscriptions")
        .select("*, service_packages(*)")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const currentPackageId = currentSub?.package_id;

  const handleSubscribe = (pkg: any) => {
    setCheckoutPkg(pkg);
  };

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["client-package-sub", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["service-packages-client"] });
    setCheckoutPkg(null);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Mes abonnements</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Souscrivez à un forfait pour profiter de la livraison à domicile et d'autres avantages.
        </p>
      </div>

      {/* Current subscription */}
      {currentSub && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Crown size={18} className="text-primary" />
            <h3 className="text-sm font-bold text-foreground">Votre forfait actuel</h3>
          </div>
          <p className="text-sm text-foreground font-medium">{currentSub.service_packages?.name}</p>
          <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
            <span>Cycle : {currentSub.billing_cycle === "yearly" ? "Annuel" : "Mensuel"}</span>
            {currentSub.paid_until && (
              <span>Valide jusqu'au : {new Date(currentSub.paid_until).toLocaleDateString("fr-FR")}</span>
            )}
          </div>
        </div>
      )}

      {/* Billing cycle toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package size={18} className="text-primary" />
          <h3 className="text-sm font-bold text-foreground">Forfaits disponibles</h3>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="client-billing-toggle" className={`text-xs ${billingCycle === "monthly" ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
            Mensuel
          </Label>
          <Switch
            id="client-billing-toggle"
            checked={billingCycle === "yearly"}
            onCheckedChange={(checked) => setBillingCycle(checked ? "yearly" : "monthly")}
          />
          <Label htmlFor="client-billing-toggle" className={`text-xs ${billingCycle === "yearly" ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
            Annuel
          </Label>
        </div>
      </div>

      {/* Package cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2].map(i => <div key={i} className="h-56 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : packages.length === 0 ? (
        <div className="text-center py-8 bg-card border border-border rounded-lg">
          <Package size={32} className="mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">Aucun forfait client disponible pour le moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {packages.map((pkg: any) => {
            const price = billingCycle === "yearly" ? pkg.price_yearly : pkg.price_monthly;
            const isCurrent = pkg.id === currentPackageId;
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
                  {isCurrent && <Badge className="text-[10px]">Actuel</Badge>}
                </div>
                {pkg.description && <p className="text-xs text-muted-foreground">{pkg.description}</p>}

                <div className="mt-3">
                  <span className="text-xl font-bold text-foreground">${price}</span>
                  <span className="text-xs text-muted-foreground">/{billingCycle === "yearly" ? "an" : "mois"}</span>
                </div>

                <ul className="mt-3 space-y-1.5 flex-1 text-xs text-muted-foreground">
                  {pkg.max_deliveries_per_day > 0 && (
                    <li className="flex items-center gap-2">
                      <Truck size={12} className="text-primary shrink-0" />
                      {pkg.max_deliveries_per_day} livraisons/jour incluses
                    </li>
                  )}
                  {pkg.hub_storage_free_kg > 0 && (
                    <li className="flex items-center gap-2">
                      <Warehouse size={12} className="text-primary shrink-0" />
                      {pkg.hub_storage_free_kg} kg de stockage Hub gratuit
                    </li>
                  )}
                  {services.length > 0 && services.map((svc: string, idx: number) => (
                    <li key={idx} className="flex items-center gap-2">
                      <Check size={12} className="text-primary shrink-0" />
                      <span>{svc}</span>
                    </li>
                  ))}
                </ul>

                <button
                  disabled={isCurrent}
                  onClick={() => !isCurrent && handleSubscribe(pkg)}
                  className="w-full mt-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                >
                  {isCurrent ? "Forfait actuel" : "Souscrire"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Subscription checkout dialog */}
      {checkoutPkg && (
        <SubscriptionCheckoutDialog
          open={!!checkoutPkg}
          onOpenChange={(open) => { if (!open) setCheckoutPkg(null); }}
          itemName={checkoutPkg.name}
          price={billingCycle === "yearly" ? checkoutPkg.price_yearly : checkoutPkg.price_monthly}
          billingCycle={billingCycle}
          subscriptionType="package"
          packageId={checkoutPkg.id}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}