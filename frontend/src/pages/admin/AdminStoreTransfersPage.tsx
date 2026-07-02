import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminUserPicker } from "@/components/admin/AdminUserPicker";
import { useMemo, useState } from "react";
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
  ArrowLeftRight, Search, CheckCircle, XCircle, FileText,
  AlertTriangle, Loader2, Eye, Shield, Store, Plus
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface AdminStoreOption {
  id: string;
  name: string;
  owner_id: string;
  is_platform_owned: boolean;
  owner_email: string | null;
  owner_name: string | null;
}

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
  const [initiateOpen, setInitiateOpen] = useState(false);
  const [initiateStoreId, setInitiateStoreId] = useState<string>("");
  const [initiateToUserId, setInitiateToUserId] = useState<string | null>(null);
  const [initiateReason, setInitiateReason] = useState("");
  const [initiateConfirmOpen, setInitiateConfirmOpen] = useState(false);
  const [storeSearch, setStoreSearch] = useState("");

  const { data: adminStores = [] } = useQuery({
    queryKey: ["admin-transfer-stores"],
    queryFn: async (): Promise<AdminStoreOption[]> => {
      const { data: stores, error } = await supabase
        .from("stores")
        .select("id, name, owner_id, is_platform_owned")
        .order("name");
      if (error) throw error;

      const ownerIds = [...new Set((stores || []).map((s) => s.owner_id).filter(Boolean))] as string[];
      let ownerMap: Record<string, { email: string | null; first_name: string | null; last_name: string | null }> = {};
      if (ownerIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, email, first_name, last_name")
          .in("id", ownerIds);
        ownerMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
      }

      return (stores || []).map((s) => ({
        id: s.id,
        name: s.name,
        owner_id: s.owner_id,
        is_platform_owned: s.is_platform_owned ?? false,
        owner_email: ownerMap[s.owner_id]?.email ?? null,
        owner_name: ownerMap[s.owner_id]
          ? `${ownerMap[s.owner_id].first_name || ""} ${ownerMap[s.owner_id].last_name || ""}`.trim() || null
          : null,
      }));
    },
  });

  const selectedInitiateStore = useMemo(
    () => adminStores.find((s) => s.id === initiateStoreId) ?? null,
    [adminStores, initiateStoreId],
  );

  const filteredAdminStores = useMemo(() => {
    const q = storeSearch.trim().toLowerCase();
    if (!q) return adminStores;
    return adminStores.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.owner_email?.toLowerCase().includes(q) ||
        s.owner_name?.toLowerCase().includes(q),
    );
  }, [adminStores, storeSearch]);

  const { data: recipientStoreCount = 0 } = useQuery({
    queryKey: ["admin-transfer-recipient-stores", initiateToUserId],
    enabled: !!initiateToUserId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("stores")
        .select("id", { count: "exact", head: true })
        .eq("owner_id", initiateToUserId!);
      if (error) throw error;
      return count ?? 0;
    },
  });

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

  const initiateMutation = useMutation({
    mutationFn: async () => {
      if (!initiateStoreId || !initiateToUserId || !initiateReason.trim()) {
        throw new Error("Boutique, destinataire et motif requis");
      }
      const { data, error } = await supabase.rpc("admin_execute_store_transfer", {
        p_store_id: initiateStoreId,
        p_to_user_id: initiateToUserId,
        p_reason: initiateReason.trim(),
        p_admin_notes: null,
      });
      if (error) throw error;

      const result = data as {
        from_user_id: string;
        to_user_id: string;
        store_id: string;
        store_name: string;
        vendor_role_removed: boolean;
        recipient_store_count_after: number;
      };

      await supabase.from("notifications").insert([
        {
          user_id: result.from_user_id,
          type: "system",
          title: "Boutique transférée (admin)",
          message: `La boutique « ${result.store_name} » a été transférée par l'administrateur.`,
          link: result.vendor_role_removed ? "/dashboard" : "/vendor",
        },
        {
          user_id: result.to_user_id,
          type: "system",
          title: "Boutique reçue",
          message: `Vous êtes désormais propriétaire de « ${result.store_name} » (${result.recipient_store_count_after} boutique(s) au total).`,
          link: "/vendor",
        },
      ]);

      await fromTable("admin_audit_logs").insert({
        admin_id: user?.id,
        action: "store_transfer_admin_initiated",
        target_user_id: result.to_user_id,
        details: {
          store_id: result.store_id,
          from: result.from_user_id,
          to: result.to_user_id,
          vendor_role_removed: result.vendor_role_removed,
        },
      });

      return result;
    },
    onSuccess: (result) => {
      toast({
        title: "Transfert effectué",
        description: `« ${result.store_name} » transférée avec succès.`,
      });
      qc.invalidateQueries({ queryKey: ["admin-store-transfers"] });
      qc.invalidateQueries({ queryKey: ["admin-transfer-stores"] });
      setInitiateConfirmOpen(false);
      setInitiateOpen(false);
      setInitiateStoreId("");
      setInitiateToUserId(null);
      setInitiateReason("");
      setStoreSearch("");
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
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

  const canInitiate =
    !!initiateStoreId &&
    !!initiateToUserId &&
    initiateReason.trim().length >= 3 &&
    initiateToUserId !== selectedInitiateStore?.owner_id;

  return (
    <AdminLayout title="Transferts de boutiques">
      <div className="space-y-4">
        <div className="bg-card border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-semibold text-sm flex items-center gap-2">
                <Plus size={16} className="text-primary" />
                Initier un transfert (admin)
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Transfert immédiat : choisissez une boutique et le compte destinataire (même s'il a déjà d'autres boutiques).
              </p>
            </div>
            <Button size="sm" onClick={() => setInitiateOpen(true)}>
              <ArrowLeftRight size={14} className="mr-1" /> Nouveau transfert
            </Button>
          </div>
        </div>

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
                        {req.transfer_type === "admin_initiated" && (
                          <Badge variant="outline" className="text-primary border-primary/30">
                            <Shield size={12} className="mr-1" /> Admin
                          </Badge>
                        )}
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

      {/* Initiate transfer dialog */}
      <Dialog open={initiateOpen} onOpenChange={setInitiateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store size={18} /> Transférer une boutique
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Boutique à transférer</label>
              <Input
                placeholder="Filtrer par nom ou propriétaire..."
                value={storeSearch}
                onChange={(e) => setStoreSearch(e.target.value)}
                className="mt-1 mb-2"
              />
              <Select value={initiateStoreId} onValueChange={setInitiateStoreId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une boutique" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {filteredAdminStores.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                      {s.is_platform_owned ? " (Plateforme)" : ""}
                      {s.owner_email ? ` — ${s.owner_email}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedInitiateStore && (
                <p className="text-xs text-muted-foreground mt-1">
                  Propriétaire actuel : {selectedInitiateStore.owner_name || "—"}
                  {selectedInitiateStore.owner_email ? ` (${selectedInitiateStore.owner_email})` : ""}
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium">Nouveau propriétaire</label>
              <div className="mt-1">
                <AdminUserPicker
                  value={initiateToUserId}
                  onChange={setInitiateToUserId}
                  excludeUserId={selectedInitiateStore?.owner_id}
                  placeholder="Rechercher par email ou nom"
                />
              </div>
              {initiateToUserId && (
                <p className="text-xs text-muted-foreground mt-1">
                  Ce compte possède déjà {recipientStoreCount} boutique(s). Après transfert : {recipientStoreCount + 1}.
                </p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium">Motif</label>
              <Textarea
                value={initiateReason}
                onChange={(e) => setInitiateReason(e.target.value)}
                placeholder="Ex. regroupement de boutiques plateforme sur un seul compte..."
                rows={3}
                className="mt-1"
              />
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-xs text-yellow-800">
              <AlertTriangle size={14} className="inline mr-1" />
              Le transfert s'exécute immédiatement. Irréversible. Rétention 30j et avantages réinitialisés pour la boutique transférée.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInitiateOpen(false)}>Annuler</Button>
            <Button disabled={!canInitiate} onClick={() => setInitiateConfirmOpen(true)}>
              Transférer maintenant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={initiateConfirmOpen} onOpenChange={setInitiateConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer le transfert</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Transférer « {selectedInitiateStore?.name} » vers le compte sélectionné ?
            Cette action est immédiate et définitive.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInitiateConfirmOpen(false)}>Annuler</Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              disabled={initiateMutation.isPending}
              onClick={() => initiateMutation.mutate()}
            >
              {initiateMutation.isPending && <Loader2 size={14} className="animate-spin mr-1" />}
              Confirmer le transfert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
