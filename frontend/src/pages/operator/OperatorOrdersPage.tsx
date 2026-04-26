/**
 * OperatorOrdersPage — Lot 11B Phase B2
 *
 * Liste des commandes assignées à l'opérateur.
 * Tabs : à assigner / en cours / livrées / annulées.
 * Action : assigner à un rider de la flotte.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOperatorContext } from "@/hooks/use-operator-context";
import { fromTable } from "@/lib/supabase-helpers";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Truck, MapPin, Phone, Package, User } from "lucide-react";

type TabKey = "pending" | "in_progress" | "delivered" | "cancelled";

const TAB_FILTERS: Record<TabKey, (statuses: string[], rider: string | null) => boolean> = {
  pending: (s, r) => !r && (s.includes("confirmed") || s.includes("preparing") || s.includes("shipped") || s.includes("arrived")),
  in_progress: (s, r) => !!r && !s.includes("delivered") && !s.includes("cancelled"),
  delivered: (s) => s.includes("delivered"),
  cancelled: (s) => s.includes("cancelled"),
};

export default function OperatorOrdersPage() {
  const { operator } = useOperatorContext();
  const [tab, setTab] = useState<TabKey>("pending");
  const queryClient = useQueryClient();
  const [assigning, setAssigning] = useState<string | null>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["operator-orders", operator?.id],
    enabled: !!operator?.id,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await fromTable("orders")
        .select(`
          id, order_ref, status, total, last_mile_fee, shipping_first_name, shipping_last_name,
          shipping_phone, shipping_address, shipping_city, shipping_commune, shipping_quartier,
          assigned_rider_id, assigned_rider_name, created_at
        `)
        .eq("delivery_operator_id", operator!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: riders = [] } = useQuery({
    queryKey: ["operator-riders-active-list", operator?.id],
    enabled: !!operator?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await fromTable("delivery_operator_riders")
        .select("rider_user_id, status")
        .eq("operator_id", operator!.id)
        .eq("status", "active");
      return (data ?? []) as Array<{ rider_user_id: string }>;
    },
  });

  const filtered = orders.filter((o) => TAB_FILTERS[tab]([o.status], o.assigned_rider_id));

  const assign = async (orderId: string, riderId: string) => {
    setAssigning(orderId);
    try {
      const { error } = await supabase.functions.invoke("operator-assign-rider-to-order", {
        body: { order_id: orderId, rider_id: riderId },
      });
      if (error) throw new Error(error.message);
      toast.success("Course assignée");
      queryClient.invalidateQueries({ queryKey: ["operator-orders"] });
    } catch (e: any) {
      toast.error(e.message || "Échec assignation");
    } finally {
      setAssigning(null);
    }
  };

  if (!operator) return null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Courses</h1>
        <p className="text-sm text-muted-foreground">Commandes assignées à votre entreprise</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {(Object.keys(TAB_FILTERS) as TabKey[]).map((t) => {
          const count = orders.filter((o) => TAB_FILTERS[t]([o.status], o.assigned_rider_id)).length;
          const labels: Record<TabKey, string> = {
            pending: "À assigner", in_progress: "En cours",
            delivered: "Livrées", cancelled: "Annulées",
          };
          return (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === t
                  ? "border-[hsl(var(--operator-primary))] text-[hsl(var(--operator-primary))]"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>
              {labels[t]} {count > 0 && <span className="ml-1 text-xs opacity-70">({count})</span>}
            </button>
          );
        })}
      </div>

      {isLoading && <Loader2 className="animate-spin mx-auto my-8" size={24} />}

      {!isLoading && filtered.length === 0 && (
        <Card>
          <CardContent className="pt-8 text-center text-sm text-muted-foreground">
            <Truck size={32} className="mx-auto mb-2 opacity-30" />
            Aucune course dans cette catégorie
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {filtered.map((o) => {
          const isPending = tab === "pending";
          const fullAddress = [o.shipping_address, o.shipping_quartier, o.shipping_commune, o.shipping_city]
            .filter(Boolean).join(", ");
          return (
            <Card key={o.id}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-muted-foreground">{o.order_ref}</p>
                    <p className="font-semibold text-sm flex items-center gap-1">
                      <User size={12} /> {o.shipping_first_name} {o.shipping_last_name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">${Number(o.last_mile_fee || 0).toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground">Frais livraison</p>
                  </div>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1.5"><MapPin size={11} /> {fullAddress}</p>
                  <p className="flex items-center gap-1.5"><Phone size={11} /> {o.shipping_phone}</p>
                  {o.assigned_rider_name && (
                    <p className="flex items-center gap-1.5 text-[hsl(var(--operator-primary))]">
                      <Package size={11} /> Assigné à {o.assigned_rider_name}
                    </p>
                  )}
                </div>
                {isPending && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    {riders.length === 0 ? (
                      <p className="text-xs text-amber-600">
                        Aucun rider actif. <a href="/operator/fleet" className="underline">Inviter un livreur</a>
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2 items-center">
                        <span className="text-xs text-muted-foreground">Assigner à :</span>
                        {riders.map((r) => (
                          <Button key={r.rider_user_id} size="sm" variant="outline"
                            disabled={assigning === o.id}
                            onClick={() => assign(o.id, r.rider_user_id)}>
                            {assigning === o.id ? <Loader2 className="animate-spin" size={12} /> :
                              <span className="font-mono text-[10px]">{r.rider_user_id.slice(0, 8)}</span>}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}