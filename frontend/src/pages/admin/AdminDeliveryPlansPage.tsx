import { AdminLayout } from "@/components/admin/AdminLayout";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fromTable } from "@/lib/supabase-helpers";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Save, Truck, Package, Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const VENDOR_PLANS = [
  { plan_type: "vendor_5", label: "5 livraisons/jour", tiers: { standard: { riders: 1, hub: false }, professional: { riders: 2, hub: false }, premium: { riders: 2, hub: true } } },
  { plan_type: "vendor_10", label: "10 livraisons/jour", tiers: { standard: { riders: 1, hub: false }, professional: { riders: 2, hub: false }, premium: { riders: 2, hub: true } } },
  { plan_type: "vendor_20", label: "20 livraisons/jour", tiers: { standard: { riders: 2, hub: false }, professional: { riders: 3, hub: false }, premium: { riders: 4, hub: true } } },
  { plan_type: "vendor_50", label: "50 livraisons/jour", tiers: { standard: { riders: 2, hub: false }, professional: { riders: 3, hub: false }, premium: { riders: 5, hub: true } } },
  { plan_type: "vendor_100", label: "100 livraisons/jour", tiers: { standard: { riders: 4, hub: false }, professional: { riders: 5, hub: false }, premium: { riders: 10, hub: true } } },
];

export default function AdminDeliveryPlansPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: config } = useQuery({
    queryKey: ["delivery-plans-config"],
    queryFn: async () => {
      const { data } = await supabase.from("platform_settings").select("*").eq("key", "delivery_plans").maybeSingle();
      return data?.value as any || {};
    },
  });

  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: ["delivery-subscriptions-admin"],
    queryFn: async () => {
      const { data, error } = await fromTable("delivery_subscriptions").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: hubItems = [] } = useQuery({
    queryKey: ["hub-storage-admin"],
    queryFn: async () => {
      const { data, error } = await fromTable("hub_storage_tracking").select("*").order("arrived_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  const hubConfig = config?.hub_storage || { free_days: 14, daily_rate: 0.25, min_weight_kg: 1 };

  const activeVendorSubs = subscriptions.filter((s: any) => s.store_id && s.is_active).length;
  const activeClientSubs = subscriptions.filter((s: any) => s.user_id && !s.store_id && s.is_active).length;
  const penaltyItems = hubItems.filter((h: any) => h.is_penalty_active).length;

  return (
    <AdminLayout title="Plans de livraison & Hub">
      <div className="space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-card border border-border rounded-lg p-3">
            <p className="text-lg font-bold text-foreground">{activeVendorSubs}</p>
            <p className="text-xs text-muted-foreground">Abonnements vendeurs actifs</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-3">
            <p className="text-lg font-bold text-foreground">{activeClientSubs}</p>
            <p className="text-xs text-muted-foreground">Abonnements clients actifs</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-3">
            <p className="text-lg font-bold text-foreground">{hubItems.length}</p>
            <p className="text-xs text-muted-foreground">Articles en Hub</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-3">
            <p className="text-lg font-bold text-destructive">{penaltyItems}</p>
            <p className="text-xs text-muted-foreground">Pénalités actives</p>
          </div>
        </div>

        <Tabs defaultValue="plans">
          <TabsList>
            <TabsTrigger value="plans">Grille vendeurs</TabsTrigger>
            <TabsTrigger value="clients">Clients</TabsTrigger>
            <TabsTrigger value="hub">Stockage Hub</TabsTrigger>
            <TabsTrigger value="subscriptions">Abonnements actifs</TabsTrigger>
          </TabsList>

          <TabsContent value="plans" className="mt-4">
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left p-3 font-medium">Plan</th>
                    <th className="text-center p-3 font-medium">Standard</th>
                    <th className="text-center p-3 font-medium">Professionnel</th>
                    <th className="text-center p-3 font-medium">Premium</th>
                  </tr>
                </thead>
                <tbody>
                  {VENDOR_PLANS.map((plan) => (
                    <tr key={plan.plan_type} className="border-b border-border last:border-0">
                      <td className="p-3 font-medium text-foreground">{plan.label}</td>
                      {(["standard", "professional", "premium"] as const).map((tier) => {
                        const t = plan.tiers[tier];
                        return (
                          <td key={tier} className="p-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Users size={14} className="text-muted-foreground" />
                              <span className="font-semibold">{t.riders}</span>
                            </div>
                            {t.hub && (
                              <Badge variant="outline" className="text-xs mt-1 text-primary border-primary/30">
                                <Package size={10} className="mr-0.5" /> Hub
                              </Badge>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="clients" className="mt-4">
            <div className="bg-card border border-border rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-sm text-foreground">Abonnement livraison client</h3>
              <p className="text-xs text-muted-foreground">
                Les clients peuvent souscrire un abonnement mensuel ou annuel pour la livraison à domicile.
                À chaque commande arrivée au Hub, la livraison est incluse dans l'abonnement.
              </p>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• <strong>Mensuel</strong> : tarif configuré par l'admin</p>
                <p>• <strong>Annuel</strong> : tarif configuré par l'admin (économie ~20%)</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="hub" className="mt-4 space-y-3">
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="font-semibold text-sm text-foreground mb-2">Paramètres Hub</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground">Jours gratuits</span>
                  <p className="font-semibold text-foreground">{hubConfig.free_days} jours</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Tarif journalier</span>
                  <p className="font-semibold text-foreground">${hubConfig.daily_rate}/jour</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Poids minimum</span>
                  <p className="font-semibold text-foreground">{hubConfig.min_weight_kg} kg</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Jours ouvrés</span>
                  <p className="font-semibold text-foreground">Lun-Sam</p>
                </div>
              </div>
            </div>

            {hubItems.length > 0 ? (
              <div className="space-y-2">
                {hubItems.map((item: any) => {
                  const isOverdue = new Date(item.free_until) < new Date();
                  return (
                    <div key={item.id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between gap-3">
                      <div className="text-xs text-muted-foreground">
                        <p className="text-sm font-medium text-foreground">{item.weight_kg} kg</p>
                        <p>Arrivé le {new Date(item.arrived_at).toLocaleDateString("fr")}</p>
                        <p>Gratuit jusqu'au {new Date(item.free_until).toLocaleDateString("fr")}</p>
                      </div>
                      <div className="text-right">
                        {isOverdue ? (
                          <div>
                            <Badge variant="destructive">Pénalité active</Badge>
                            <p className="text-xs text-destructive font-semibold mt-1">${item.total_penalty?.toFixed(2) || "0.00"}</p>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-green-600 border-green-300">Gratuit</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center text-muted-foreground text-sm py-4">Aucun article en stockage Hub.</p>
            )}
          </TabsContent>

          <TabsContent value="subscriptions" className="mt-4">
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={24} /></div>
            ) : subscriptions.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">Aucun abonnement.</p>
            ) : (
              <div className="space-y-2">
                {subscriptions.map((sub: any) => (
                  <div key={sub.id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between gap-3 text-sm">
                    <div>
                      <span className="font-medium text-foreground">{sub.plan_type}</span>
                      <span className="mx-2 text-muted-foreground">•</span>
                      <Badge variant="outline">{sub.tier}</Badge>
                      {sub.hub_storage && <Badge variant="outline" className="ml-1 text-primary">Hub</Badge>}
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">${sub.price}</span>
                      {sub.paid_until && <p>Jusqu'au {new Date(sub.paid_until).toLocaleDateString("fr")}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
