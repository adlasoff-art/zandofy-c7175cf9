import { AdminLayout } from "@/components/admin/AdminLayout";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fromTable } from "@/lib/supabase-helpers";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ArrowLeftRight, Search, CheckCircle, XCircle, RotateCcw, FileText,
  AlertTriangle, Loader2, Eye, Shield
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  under_review: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-muted text-muted-foreground",
};

const statusLabels: Record<string, string> = {
  pending: "En attente",
  under_review: "En révision",
  completed: "Approuvé",
  rejected: "Rejeté",
  cancelled: "Annulé",
};

export default function AdminStoreTransfersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [actionDialog, setActionDialog] = useState<"approve" | "reject" | "review" | null>(null);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["admin-store-transfers", statusFilter],
    queryFn: async () => {
      let q = fromTable("store_transfer_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q.limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch profiles & stores for display
  const userIds = [...new Set(requests.flatMap((r: any) => [r.from_user_id, r.to_user_id]))] as string[];
  const storeIds = [...new Set(requests.map((r: any) => r.store_id))] as string[];

  const { data: profiles = [] } = useQuery({
    queryKey: ["transfer-profiles", userIds.join(",")],
    queryFn: async () => {
      if (!userIds.length) return [];
      const { data } = await supabase.from("profiles").select("id, first_name, last_name, email, avatar_url").in("id", userIds);
      return data || [];
    },
    enabled: userIds.length > 0,
  });

  const { data: stores = [] } = useQuery({
    queryKey: ["transfer-stores", storeIds.join(",")],
    queryFn: async () => {
      if (!storeIds.length) return [];
      const { data } = await supabase.from("stores").select("id, name, logo_url").in("id", storeIds);
      return data || [];
    },
    enabled: storeIds.length > 0,
  });

  const getProfile = (id: string) => profiles.find((p: any) => p.id === id);
  const getStore = (id: string) => stores.find((s: any) => s.id === id);

  const actionMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes: string }) => {
      if (status === "completed") {
        const { data, error } = await supabase.rpc("complete_store_transfer", {
          p_request_id: id,
          p_admin_id: user?.id,
          p_admin_notes: notes || null,
        });
        if (error) throw error;

        const result = data as {
          from_user_id: string;
          to_user_id: string;
          store_id: string;
          store_name: string;
          vendor_role_removed: boolean;
        };

        await supabase.from("notifications").insert([
          {
            user_id: result.from_user_id,
            type: "system",
            title: "Transfert approuvé",
            message: `Le transfert de la boutique « ${result.store_name} » a été approuvé. Vous n'êtes plus propriétaire.`,
            link: result.vendor_role_removed ? "/dashboard" : "/vendor",
          },
          {
            user_id: result.to_user_id,
            type: "system",
            title: "Boutique transférée",
            message: `Vous êtes désormais propriétaire de « ${result.store_name} ». Certains avantages sont réinitialisés (rétention 30j, coupons désactivés).`,
            link: "/vendor",
          },
        ]);

        await fromTable("admin_audit_logs").insert({
          admin_id: user?.id,
          action: "store_transfer_approved",
          target_user_id: result.to_user_id,
          details: {
            store_id: result.store_id,
            from: result.from_user_id,
            to: result.to_user_id,
            vendor_role_removed: result.vendor_role_removed,
          },
        });

        return;
      }

      const { error } = await fromTable("store_transfer_requests").update({
        status,
        admin_notes: notes,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Action effectuée" });
      qc.invalidateQueries({ queryKey: ["admin-store-transfers"] });
      setActionDialog(null);
      setSelectedRequest(null);
      setAdminNotes("");
    },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const filtered = requests.filter((r: any) => {
    if (!search) return true;
    const from = getProfile(r.from_user_id);
    const to = getProfile(r.to_user_id);
    const store = getStore(r.store_id);
    const s = search.toLowerCase();
    return (
      from?.email?.toLowerCase().includes(s) ||
      to?.email?.toLowerCase().includes(s) ||
      store?.name?.toLowerCase().includes(s) ||
      (from?.first_name + " " + from?.last_name).toLowerCase().includes(s)
    );
  });

  const handleAction = (action: "approve" | "reject" | "review", req: any) => {
    setSelectedRequest(req);
    setAdminNotes(req.admin_notes || "");
    setActionDialog(action);
  };

  const confirmAction = () => {
    if (!selectedRequest || !actionDialog) return;
    const statusMap = { approve: "completed", reject: "rejected", review: "under_review" };
    actionMutation.mutate({ id: selectedRequest.id, status: statusMap[actionDialog], notes: adminNotes });
  };

  return (
    <AdminLayout title="Transferts de boutiques">
      <div className="space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {["all", "pending", "under_review", "completed", "rejected"].map((s) => {
            const count = s === "all" ? requests.length : requests.filter((r: any) => r.status === s).length;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`p-3 rounded-lg border text-left transition-colors ${statusFilter === s ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/50"}`}
              >
                <p className="text-lg font-bold text-foreground">{count}</p>
                <p className="text-xs text-muted-foreground">{s === "all" ? "Total" : statusLabels[s]}</p>
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom, email ou boutique..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">Aucune demande de transfert.</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((req: any) => {
              const from = getProfile(req.from_user_id);
              const to = getProfile(req.to_user_id);
              const store = getStore(req.store_id);
              return (
                <div key={req.id} className="bg-card border border-border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-foreground">{store?.name || "Boutique"}</span>
                        <Badge className={statusColors[req.status] || ""}>{statusLabels[req.status] || req.status}</Badge>
                        {req.transfer_type === "claim" && (
                          <Badge variant="outline" className="text-orange-600 border-orange-300">
                            <AlertTriangle size={12} className="mr-1" /> Réclamation
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                        <p>De : {from?.first_name} {from?.last_name} ({from?.email})</p>
                        <p>À : {to?.first_name} {to?.last_name} ({to?.email})</p>
                        {req.reason && <p className="italic">Motif : {req.reason}</p>}
                        <p>Créé le {req.created_at ? format(new Date(req.created_at), "dd MMM yyyy HH:mm", { locale: fr }) : "N/A"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {req.documents?.length > 0 && (
                        <Button variant="ghost" size="sm" title="Voir documents">
                          <FileText size={14} />
                          <span className="ml-1 text-xs">{req.documents.length}</span>
                        </Button>
                      )}
                      {req.status === "pending" || req.status === "under_review" ? (
                        <>
                          <Button size="sm" variant="outline" onClick={() => handleAction("review", req)}>
                            <Eye size={14} className="mr-1" /> Révision
                          </Button>
                          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleAction("approve", req)}>
                            <CheckCircle size={14} className="mr-1" /> Approuver
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleAction("reject", req)}>
                            <XCircle size={14} className="mr-1" /> Rejeter
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {req.admin_notes && (
                    <div className="text-xs bg-muted/50 rounded p-2">
                      <span className="font-medium">Notes admin :</span> {req.admin_notes}
                    </div>
                  )}

                  {req.claim_warning_accepted && (
                    <div className="flex items-center gap-1.5 text-xs text-orange-600">
                      <Shield size={12} />
                      <span>Le demandeur a accepté l'avertissement de sanction pour réclamation infondée</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Action Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={() => { setActionDialog(null); setSelectedRequest(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog === "approve" && "Approuver le transfert"}
              {actionDialog === "reject" && "Rejeter le transfert"}
              {actionDialog === "review" && "Demander une révision"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {actionDialog === "approve" && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-xs text-yellow-800">
                <AlertTriangle size={14} className="inline mr-1" />
                En approuvant, le propriétaire sera changé. Le nouveau propriétaire aura : rétention 30 jours, coupons/collaborateurs/self-delivery désactivés.
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-foreground">Notes admin</label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Ajoutez des notes ou justifications..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Annuler</Button>
            <Button
              onClick={confirmAction}
              disabled={actionMutation.isPending}
              className={actionDialog === "reject" ? "bg-destructive hover:bg-destructive/90" : actionDialog === "approve" ? "bg-green-600 hover:bg-green-700" : ""}
            >
              {actionMutation.isPending && <Loader2 size={14} className="animate-spin mr-1" />}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
