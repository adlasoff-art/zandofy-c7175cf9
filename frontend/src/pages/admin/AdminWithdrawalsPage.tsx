import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Banknote, Search, Loader2, Check, X, Settings2, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  pending: { label: "En attente", class: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  approved: { label: "Approuvé", class: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  rejected: { label: "Refusé", class: "bg-destructive/10 text-destructive" },
  paid: { label: "Payé", class: "bg-primary/10 text-primary" },
};

const METHOD_LABELS: Record<string, string> = {
  mobile_money: "Mobile Money",
  bank_transfer: "Virement",
  visa: "Carte Visa",
};

const RETENTION_OPTIONS = [
  { value: 0, label: "Instantané" },
  { value: 7, label: "7 jours" },
  { value: 14, label: "14 jours" },
  { value: 30, label: "30 jours" },
];

const FREQUENCY_OPTIONS = [
  { value: "daily", label: "Quotidien" },
  { value: "weekly", label: "Hebdomadaire" },
  { value: "monthly", label: "Mensuel" },
];

export default function AdminWithdrawalsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("pending");
  const [configStore, setConfigStore] = useState<any>(null);

  // Fetch withdrawal requests with store names
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["admin-withdrawals", filterStatus],
    queryFn: async () => {
      let query = supabase
        .from("withdrawal_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      const { data } = await query;
      if (!data || data.length === 0) return [];

      // Get store names
      const storeIds = [...new Set(data.map((r: any) => r.store_id))];
      const { data: stores } = await supabase
        .from("stores")
        .select("id, name")
        .in("id", storeIds);
      const storeMap = new Map((stores || []).map((s: any) => [s.id, s.name]));

      return data.map((r: any) => ({ ...r, store_name: storeMap.get(r.store_id) || "—" }));
    },
  });

  // Fetch wallets for config
  const { data: wallets = [] } = useQuery({
    queryKey: ["admin-wallets"],
    queryFn: async () => {
      const { data } = await supabase
        .from("vendor_wallets")
        .select("*")
        .order("created_at", { ascending: false });

      if (!data || data.length === 0) return [];

      const storeIds = data.map((w: any) => w.store_id);
      const { data: stores } = await supabase
        .from("stores")
        .select("id, name")
        .in("id", storeIds);
      const storeMap = new Map((stores || []).map((s: any) => [s.id, s.name]));

      return data.map((w: any) => ({ ...w, store_name: storeMap.get(w.store_id) || "—" }));
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const { error } = await supabase
        .from("withdrawal_requests")
        .update({
          status,
          admin_notes: notes || null,
          reviewed_by: user?.id || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;

      // If approved, debit the wallet
      if (status === "approved" || status === "paid") {
        const request = requests.find((r: any) => r.id === id);
        if (request) {
          // Debit wallet manually
          const { data: w } = await supabase
            .from("vendor_wallets")
            .select("available_balance, total_withdrawn")
            .eq("store_id", request.store_id)
            .single();

          if (w) {
            await supabase.from("vendor_wallets").update({
              available_balance: Math.max(0, Number(w.available_balance) - Number(request.amount)),
              total_withdrawn: Number(w.total_withdrawn) + Number(request.amount),
            }).eq("store_id", request.store_id);
          }

          // Log transaction
          await supabase.from("vendor_transactions").insert({
            store_id: request.store_id,
            type: "debit",
            amount: request.amount,
            withdrawal_request_id: id,
            description: `Retrait ${METHOD_LABELS[request.method] || request.method} - ${status === "paid" ? "Payé" : "Approuvé"}`,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-withdrawals"] });
      queryClient.invalidateQueries({ queryKey: ["admin-wallets"] });
      toast.success("Demande mise à jour");
    },
    onError: () => toast.error("Erreur"),
  });

  const updateWalletConfig = useMutation({
    mutationFn: async ({ storeId, field, value }: { storeId: string; field: string; value: any }) => {
      const { error } = await supabase
        .from("vendor_wallets")
        .update({ [field]: value })
        .eq("store_id", storeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-wallets"] });
      toast.success("Configuration mise à jour");
    },
    onError: () => toast.error("Erreur"),
  });

  const filtered = requests.filter((r: any) =>
    r.store_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout title="Retraits vendeurs">
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Banknote size={20} className="text-primary" />
          Gestion des retraits
        </h1>

        <Tabs defaultValue="requests">
          <TabsList>
            <TabsTrigger value="requests">Demandes de retrait</TabsTrigger>
            <TabsTrigger value="config">Configuration par boutique</TabsTrigger>
          </TabsList>

          <TabsContent value="requests" className="space-y-4 mt-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Rechercher une boutique..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm bg-card border border-border rounded-md"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 text-sm bg-card border border-border rounded-md"
              >
                <option value="all">Tous</option>
                <option value="pending">En attente</option>
                <option value="approved">Approuvés</option>
                <option value="rejected">Refusés</option>
                <option value="paid">Payés</option>
              </select>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 size={24} className="animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">Aucune demande trouvée</p>
            ) : (
              <div className="space-y-3">
                {filtered.map((req: any) => {
                  const st = STATUS_LABELS[req.status] || STATUS_LABELS.pending;
                  return (
                    <div key={req.id} className="bg-card border border-border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <Store size={14} className="text-primary" />
                            <span className="text-sm font-bold text-foreground">{req.store_name}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {METHOD_LABELS[req.method] || req.method} · {new Date(req.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-foreground">${Number(req.amount).toFixed(2)}</p>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${st.class}`}>
                            {st.label}
                          </span>
                        </div>
                      </div>

                      {req.status === "pending" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                            onClick={() => reviewMutation.mutate({ id: req.id, status: "approved" })}
                            disabled={reviewMutation.isPending}
                          >
                            <Check size={14} className="mr-1" /> Approuver
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                            onClick={() => {
                              const notes = prompt("Motif du refus (optionnel) :");
                              reviewMutation.mutate({ id: req.id, status: "rejected", notes: notes || undefined });
                            }}
                            disabled={reviewMutation.isPending}
                          >
                            <X size={14} className="mr-1" /> Refuser
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => reviewMutation.mutate({ id: req.id, status: "paid" })}
                            disabled={reviewMutation.isPending}
                          >
                            <Banknote size={14} className="mr-1" /> Marquer Payé
                          </Button>
                        </div>
                      )}

                      {req.admin_notes && (
                        <p className="text-xs text-muted-foreground border-t border-border pt-2">
                          Note : {req.admin_notes}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="config" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">Configurez le délai de rétention et le minimum de retrait par boutique.</p>
            {wallets.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">Aucun portefeuille créé</p>
            ) : (
              <div className="space-y-3">
                {wallets.map((w: any) => (
                  <div key={w.id} className="bg-card border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Store size={14} className="text-primary" />
                        <span className="text-sm font-bold text-foreground">{w.store_name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        Solde : ${Number(w.available_balance).toFixed(2)} dispo / ${Number(w.pending_balance).toFixed(2)} en attente
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Rétention</label>
                        <select
                          value={w.retention_days}
                          onChange={(e) => updateWalletConfig.mutate({
                            storeId: w.store_id,
                            field: "retention_days",
                            value: parseInt(e.target.value),
                          })}
                          className="w-full px-2 py-1.5 text-sm bg-card border border-border rounded-md"
                        >
                          {RETENTION_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Min. retrait ($)</label>
                        <Input
                          type="number"
                          value={w.min_withdrawal}
                          onChange={(e) => updateWalletConfig.mutate({
                            storeId: w.store_id,
                            field: "min_withdrawal",
                            value: parseFloat(e.target.value) || 10,
                          })}
                          className="h-8 text-sm"
                          min={0}
                          step="1"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground block mb-1">Fréquence</label>
                        <select
                          value={w.withdrawal_frequency}
                          onChange={(e) => updateWalletConfig.mutate({
                            storeId: w.store_id,
                            field: "withdrawal_frequency",
                            value: e.target.value,
                          })}
                          className="w-full px-2 py-1.5 text-sm bg-card border border-border rounded-md"
                        >
                          {FREQUENCY_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
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
