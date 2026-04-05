import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Check, Zap } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { SubscriptionCheckoutDialog } from "@/components/payments/SubscriptionCheckoutDialog";

interface Props {
  storeId: string;
  billingCycle: "monthly" | "yearly";
  kycVerified: boolean;
}

export function VendorIndividualServices({ storeId, billingCycle, kycVerified }: Props) {
  const queryClient = useQueryClient();
  const [checkoutService, setCheckoutService] = useState<any>(null);

  const { data: services = [], isLoading } = useQuery({
    queryKey: ["platform-service-plans"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("platform_service_plans")
        .select("*")
        .eq("is_active", true)
        .order("price_monthly", { ascending: true });
      return data || [];
    },
  });

  const { data: vendorSub } = useQuery({
    queryKey: ["vendor-sub-services", storeId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("vendor_subscriptions")
        .select("id, active_services, service_paid_until")
        .eq("store_id", storeId)
        .maybeSingle();
      return data as { id: string; active_services: Record<string, boolean> | null; service_paid_until: string | null } | null;
    },
  });

  const { data: packageSub } = useQuery({
    queryKey: ["store-package-sub-services", storeId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("store_package_subscriptions")
        .select("*, service_packages(included_services)")
        .eq("store_id", storeId)
        .eq("is_active", true)
        .maybeSingle();
      return data;
    },
  });

  const includedInPackage: string[] = packageSub?.service_packages?.included_services || [];
  const activeServices: Record<string, boolean> = (vendorSub?.active_services as any) || {};

  const checkoutPrice = checkoutService
    ? (billingCycle === "yearly" ? checkoutService.price_yearly : checkoutService.price_monthly)
    : 0;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[1, 2].map(i => <div key={i} className="h-40 bg-muted animate-pulse rounded-lg" />)}
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <div className="text-center py-6 bg-card border border-border rounded-lg">
        <Zap size={28} className="mx-auto text-muted-foreground/30 mb-2" />
        <p className="text-sm text-muted-foreground">Aucun service individuel disponible.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {services.map((svc: any) => {
          const isIncluded = includedInPackage.includes(svc.service_key);
          const isActive = activeServices[svc.service_key] === true;
          const price = billingCycle === "yearly" ? svc.price_yearly : svc.price_monthly;
          const features: string[] = Array.isArray(svc.features) ? svc.features : [];

          return (
            <div
              key={svc.id}
              className={`bg-card border-2 rounded-lg p-4 transition-colors flex flex-col ${
                isIncluded || isActive ? "border-primary/40 bg-primary/5" : "border-border hover:border-primary/20"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-sm font-bold text-foreground">{svc.label}</h4>
                {isIncluded && <Badge variant="secondary" className="text-[10px]">Inclus dans le package</Badge>}
                {!isIncluded && isActive && <Badge className="text-[10px]">Actif</Badge>}
              </div>
              {svc.description && <p className="text-xs text-muted-foreground mt-0.5">{svc.description}</p>}

              <div className="mt-3">
                <span className="text-lg font-bold text-foreground">${price}</span>
                <span className="text-xs text-muted-foreground">/{billingCycle === "yearly" ? "an" : "mois"}</span>
              </div>

              {features.length > 0 && (
                <ul className="mt-2 space-y-1 flex-1 text-xs text-muted-foreground">
                  {features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <Check size={10} className="text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              )}

              <button
                onClick={() => setCheckoutService(svc)}
                disabled={isIncluded || isActive || !kycVerified}
                className="w-full mt-3 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {isIncluded ? "Inclus" : isActive ? "Déjà actif" : !kycVerified ? "KYC requis" : "Souscrire"}
              </button>
            </div>
          );
        })}
      </div>

      {checkoutService && (
        <SubscriptionCheckoutDialog
          open={!!checkoutService}
          onOpenChange={(open) => { if (!open) setCheckoutService(null); }}
          itemName={checkoutService.label}
          price={checkoutPrice}
          billingCycle={billingCycle}
          subscriptionType="service"
          serviceKey={checkoutService.service_key}
          storeId={storeId}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["vendor-sub-services", storeId] });
            setCheckoutService(null);
          }}
        />
      )}
    </>
  );
}
