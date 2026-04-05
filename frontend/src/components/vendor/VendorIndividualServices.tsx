import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Check, Zap, Loader2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface Props {
  storeId: string;
  billingCycle: "monthly" | "yearly";
  kycVerified: boolean;
}

export function VendorIndividualServices({ storeId, billingCycle, kycVerified }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [subscribingId, setSubscribingId] = useState<string | null>(null);

  // Fetch individual service plans
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

  // Fetch current active services from vendor_subscriptions
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

  // Fetch included services from current package subscription
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

  const handleSubscribe = async (service: any) => {
    if (!kycVerified) return;
    setSubscribingId(service.id);

    try {
      const newServices = { ...activeServices, [service.service_key]: true };
      const paidUntil = new Date();
      if (billingCycle === "yearly") {
        paidUntil.setFullYear(paidUntil.getFullYear() + 1);
      } else {
        paidUntil.setMonth(paidUntil.getMonth() + 1);
      }

      if (vendorSub?.id) {
        await supabase
          .from("vendor_subscriptions")
          .update({
            active_services: newServices as any,
            service_paid_until: paidUntil.toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", vendorSub.id);
      } else {
        await supabase
          .from("vendor_subscriptions")
          .insert({
            store_id: storeId,
            active_services: newServices as any,
            service_paid_until: paidUntil.toISOString(),
          } as any);
      }

      toast({ title: "Service activé", description: `${service.label} a été activé avec succès.` });
      queryClient.invalidateQueries({ queryKey: ["vendor-sub-services", storeId] });
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setSubscribingId(null);
    }
  };

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
              onClick={() => handleSubscribe(svc)}
              disabled={isIncluded || isActive || !kycVerified || subscribingId === svc.id}
              className="w-full mt-3 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-1.5"
            >
              {subscribingId === svc.id && <Loader2 size={12} className="animate-spin" />}
              {isIncluded ? "Inclus" : isActive ? "Déjà actif" : !kycVerified ? "KYC requis" : "Souscrire"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
