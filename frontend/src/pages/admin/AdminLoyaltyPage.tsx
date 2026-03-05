import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Crown, Save, Loader2, Check, X, Clock } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function AdminLoyaltyPage() {
  const queryClient = useQueryClient();

  const { data: tiers = [], isLoading } = useQuery({
    queryKey: ["customer-tiers"],
    queryFn: async () => {
      const { data } = await supabase.from("customer_tiers").select("*").order("sort_order");
      return data ?? [];
    },
  });

  const { data: requests = [], isLoading: loadingReqs } = useQuery({
    queryKey: ["badge-requests"],
    queryFn: async () => {
      const { data } = await supabase.from("badge_requests").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: profilesMap = {} } = useQuery({
    queryKey: ["admin-profiles-map"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, first_name, last_name, email");
      if (!data) return {};
      const map: Record<string, string> = {};
      data.forEach((p) => { map[p.id] = `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.email || "Inconnu"; });
      return map;
    },
  });

  const [editing, setEditing] = useState<Record<string, { discount_pct: number; min_orders: number; min_spent: number }>>({});

  const startEdit = (tier: any) => {
    setEditing((prev) => ({
      ...prev,
      [tier.id]: { discount_pct: Number(tier.discount_pct), min_orders: tier.min_orders, min_spent: Number(tier.min_spent) },
    }));
  };

  const saveEdit = async (tierId: string) => {
    const vals = editing[tierId];
    if (!vals) return;
    const { error } = await supabase.from("customer_tiers").update({
      discount_pct: vals.discount_pct,
      min_orders: vals.min_orders,
      min_spent: vals.min_spent,
      updated_at: new Date().toISOString(),
    }).eq("id", tierId);
    if (error) { toast.error(error.message); return; }
    setEditing((prev) => { const n = { ...prev }; delete n[tierId]; return n; });
    queryClient.invalidateQueries({ queryKey: ["customer-tiers"] });
    toast.success("Barème mis à jour");
  };

  const handleRequest = async (reqId: string, status: "approved" | "rejected", userId: string, tierName: string) => {
    const { error } = await supabase.from("badge_requests").update({
      status,
      reviewed_at: new Date().toISOString(),
    }).eq("id", reqId);
    if (error) { toast.error(error.message); return; }

    if (status === "approved") {
      await supabase.from("profiles").update({ customer_tier: tierName }).eq("id", userId);
    }
    queryClient.invalidateQueries({ queryKey: ["badge-requests"] });
    toast.success(status === "approved" ? "Badge accordé" : "Demande rejetée");
  };

  const pendingReqs = requests.filter((r) => r.status === "pending");

  return (
    <AdminLayout title="Programme de fidélité">
      {/* Tiers table */}
      <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <Crown size={16} className="text-primary" /> Barèmes de fidélité
      </h2>
      <div className="bg-card border border-border rounded-xl overflow-hidden mb-8">
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b border-border bg-muted/30">
                  <th className="text-left p-3 font-medium">Badge</th>
                  <th className="text-left p-3 font-medium">Min. commandes</th>
                  <th className="text-left p-3 font-medium">Min. dépensé ($)</th>
                  <th className="text-left p-3 font-medium">Réduction (%)</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tiers.map((tier) => {
                  const ed = editing[tier.id];
                  return (
                    <tr key={tier.id} className="border-b border-border/50 last:border-0">
                      <td className="p-3 font-medium text-foreground">{tier.badge_label}</td>
                      <td className="p-3">
                        {ed ? (
                          <input type="number" value={ed.min_orders} onChange={(e) => setEditing((p) => ({ ...p, [tier.id]: { ...p[tier.id], min_orders: +e.target.value } }))}
                            className="w-20 px-2 py-1 text-xs border border-border rounded bg-background" />
                        ) : tier.min_orders}
                      </td>
                      <td className="p-3">
                        {ed ? (
                          <input type="number" value={ed.min_spent} onChange={(e) => setEditing((p) => ({ ...p, [tier.id]: { ...p[tier.id], min_spent: +e.target.value } }))}
                            className="w-24 px-2 py-1 text-xs border border-border rounded bg-background" />
                        ) : `$${Number(tier.min_spent).toLocaleString()}`}
                      </td>
                      <td className="p-3">
                        {ed ? (
                          <input type="number" step="0.5" value={ed.discount_pct} onChange={(e) => setEditing((p) => ({ ...p, [tier.id]: { ...p[tier.id], discount_pct: +e.target.value } }))}
                            className="w-16 px-2 py-1 text-xs border border-border rounded bg-background" />
                        ) : `${Number(tier.discount_pct)}%`}
                      </td>
                      <td className="p-3 text-right">
                        {ed ? (
                          <button onClick={() => saveEdit(tier.id)} className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg">
                            <Save size={12} />
                          </button>
                        ) : (
                          <button onClick={() => startEdit(tier)} className="px-3 py-1.5 text-xs bg-muted rounded-lg hover:bg-muted/80 text-foreground">
                            Modifier
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Badge requests */}
      <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
        <Clock size={16} className="text-amber-500" /> Demandes de badge ({pendingReqs.length} en attente)
      </h2>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loadingReqs ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>
        ) : requests.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">Aucune demande.</div>
        ) : (
          <div className="divide-y divide-border/50">
            {requests.map((req) => {
              const userName = (profilesMap as any)[req.user_id] || req.user_id.slice(0, 8);
              return (
                <div key={req.id} className="flex items-center gap-3 p-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{userName}</p>
                    <p className="text-xs text-muted-foreground">
                      Demande : <span className="font-semibold text-primary">{req.requested_tier}</span>
                      {" · "}
                      {format(new Date(req.created_at), "d MMM yyyy", { locale: fr })}
                    </p>
                  </div>
                  {req.status === "pending" ? (
                    <div className="flex gap-1">
                      <button onClick={() => handleRequest(req.id, "approved", req.user_id, req.requested_tier)}
                        className="p-2 bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300">
                        <Check size={14} />
                      </button>
                      <button onClick={() => handleRequest(req.id, "rejected", req.user_id, req.requested_tier)}
                        className="p-2 bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <span className={`text-xs px-2 py-1 rounded-full ${req.status === "approved" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-destructive/10 text-destructive"}`}>
                      {req.status === "approved" ? "Approuvé" : "Rejeté"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
