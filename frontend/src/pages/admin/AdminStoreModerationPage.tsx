import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Store, Search, Ban, ShieldAlert, ShieldCheck, AlertTriangle, Loader2, X,
  Eye, Package, MessageCircle, Wallet, Flame, Ticket, ChevronRight,
} from "lucide-react";
import { DataTablePagination } from "@/components/ui/DataTablePagination";

const ACTIVITY_OPTIONS = [
  { key: "sales", label: "Ventes", icon: Package, description: "Bloquer les nouvelles commandes" },
  { key: "messaging", label: "Messagerie", icon: MessageCircle, description: "Bloquer l'envoi de messages" },
  { key: "product_listing", label: "Publication produits", icon: Store, description: "Bloquer l'ajout/modification de produits" },
  { key: "withdrawals", label: "Retraits", icon: Wallet, description: "Bloquer les demandes de retrait" },
  { key: "promotions", label: "Promotions", icon: Flame, description: "Bloquer les ventes flash et coupons" },
];

type StoreStatus = "all" | "active" | "suspended" | "banned";

interface StoreRow {
  id: string;
  name: string;
  logo_url: string | null;
  owner_id: string | null;
  is_suspended: boolean;
  is_banned: boolean;
  suspension_reason: string | null;
  ban_reason: string | null;
  suspended_at: string | null;
  banned_at: string | null;
  suspended_activities: string[];
  created_at: string;
  products_count: number | null;
  sales_count: number | null;
  owner_email?: string | null;
  owner_name?: string | null;
}

async function logAudit(action: string, targetUserId: string, details: Record<string, any> = {}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("admin_audit_logs").insert({
    admin_id: user.id,
    action,
    target_user_id: targetUserId,
    details,
  });
}

export default function AdminStoreModerationPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StoreStatus>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Dialog states
  const [selectedStore, setSelectedStore] = useState<StoreRow | null>(null);
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [showBanDialog, setShowBanDialog] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [banReason, setBanReason] = useState("");
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [banOwnerToo, setBanOwnerToo] = useState(false);

  const { data: stores = [], isLoading } = useQuery({
    queryKey: ["admin-store-moderation"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("stores")
        .select("id, name, logo_url, owner_id, is_suspended, is_banned, suspension_reason, ban_reason, suspended_at, banned_at, suspended_activities, created_at, products_count, sales_count")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const ownerIds = [...new Set((data || []).map((s: any) => s.owner_id).filter(Boolean))] as string[];
      let ownerMap: Record<string, { email: string | null; first_name: string | null; last_name: string | null }> = {};
      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, email, first_name, last_name").in("id", ownerIds);
        profiles?.forEach((p) => { ownerMap[p.id] = p; });
      }

      return (data || []).map((s: any) => ({
        ...s,
        suspended_activities: s.suspended_activities || [],
        owner_email: s.owner_id ? ownerMap[s.owner_id]?.email : null,
        owner_name: s.owner_id ? `${ownerMap[s.owner_id]?.first_name || ""} ${ownerMap[s.owner_id]?.last_name || ""}`.trim() : null,
      })) as StoreRow[];
    },
  });

  const filtered = useMemo(() => {
    let list = stores;
    if (statusFilter === "active") list = list.filter((s) => !s.is_suspended && !s.is_banned);
    else if (statusFilter === "suspended") list = list.filter((s) => s.is_suspended && !s.is_banned);
    else if (statusFilter === "banned") list = list.filter((s) => s.is_banned);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s) =>
        s.name.toLowerCase().includes(q) ||
        s.owner_email?.toLowerCase().includes(q) ||
        s.owner_name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [stores, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Counts
  const activeCount = stores.filter((s) => !s.is_suspended && !s.is_banned).length;
  const suspendedCount = stores.filter((s) => s.is_suspended && !s.is_banned).length;
  const bannedCount = stores.filter((s) => s.is_banned).length;

  // Suspend store
  const suspendMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStore) return;
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("stores")
        .update({
          is_suspended: true,
          suspension_reason: suspendReason || "Violation des règles de la plateforme",
          suspended_at: new Date().toISOString(),
          suspended_by: user?.id,
          suspended_activities: selectedActivities,
        })
        .eq("id", selectedStore.id);
      if (error) throw error;

      await logAudit("store_suspend", selectedStore.owner_id || selectedStore.id, {
        store_id: selectedStore.id,
        store_name: selectedStore.name,
        reason: suspendReason,
        activities: selectedActivities,
      });

      // Notify store owner
      if (selectedStore.owner_id) {
        const activitiesText = selectedActivities.length > 0
          ? `Activités suspendues : ${selectedActivities.join(", ")}`
          : "Toutes les activités sont suspendues";
        await supabase.from("notifications").insert({
          user_id: selectedStore.owner_id,
          type: "system",
          title: "Boutique suspendue",
          message: `Votre boutique "${selectedStore.name}" a été suspendue. ${activitiesText}. Raison : ${suspendReason || "Non spécifiée"}.`,
          link: "/vendor",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-store-moderation"] });
      setShowSuspendDialog(false);
      setSuspendReason("");
      setSelectedActivities([]);
      toast.success("Boutique suspendue");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Unsuspend store
  const unsuspendMutation = useMutation({
    mutationFn: async (store: StoreRow) => {
      const { error } = await (supabase as any)
        .from("stores")
        .update({
          is_suspended: false,
          suspension_reason: null,
          suspended_at: null,
          suspended_by: null,
          suspended_activities: [],
        })
        .eq("id", store.id);
      if (error) throw error;

      await logAudit("store_unsuspend", store.owner_id || store.id, {
        store_id: store.id,
        store_name: store.name,
      });

      if (store.owner_id) {
        await supabase.from("notifications").insert({
          user_id: store.owner_id,
          type: "system",
          title: "Suspension levée",
          message: `La suspension de votre boutique "${store.name}" a été levée. Vous pouvez reprendre vos activités.`,
          link: "/vendor",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-store-moderation"] });
      toast.success("Suspension levée");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Ban store
  const banMutation = useMutation({
    mutationFn: async () => {
      if (!selectedStore) return;
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("stores")
        .update({
          is_banned: true,
          is_suspended: false,
          ban_reason: banReason || "Violation grave des conditions d'utilisation",
          banned_at: new Date().toISOString(),
          banned_by: user?.id,
          suspension_reason: null,
          suspended_at: null,
          suspended_by: null,
          suspended_activities: [],
        })
        .eq("id", selectedStore.id);
      if (error) throw error;

      await logAudit("store_ban", selectedStore.owner_id || selectedStore.id, {
        store_id: selectedStore.id,
        store_name: selectedStore.name,
        reason: banReason,
        ban_owner: banOwnerToo,
      });

      // Ban the owner too if requested
      if (banOwnerToo && selectedStore.owner_id) {
        const res = await supabase.functions.invoke("admin-users", {
          body: { action: "ban_user", userId: selectedStore.owner_id, reason: `Bannissement boutique "${selectedStore.name}" : ${banReason}` },
        });
        if (res.error) console.warn("Failed to ban owner:", res.error);
      }

      // Notify owner
      if (selectedStore.owner_id) {
        await supabase.from("notifications").insert({
          user_id: selectedStore.owner_id,
          type: "system",
          title: "Boutique bannie",
          message: `Votre boutique "${selectedStore.name}" a été définitivement bannie. Raison : ${banReason || "Non spécifiée"}.`,
          link: "/vendor",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-store-moderation"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setShowBanDialog(false);
      setBanReason("");
      setBanOwnerToo(false);
      toast.success("Boutique bannie");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Unban store
  const unbanMutation = useMutation({
    mutationFn: async (store: StoreRow) => {
      const { error } = await (supabase as any)
        .from("stores")
        .update({
          is_banned: false,
          ban_reason: null,
          banned_at: null,
          banned_by: null,
        })
        .eq("id", store.id);
      if (error) throw error;

      await logAudit("store_unban", store.owner_id || store.id, {
        store_id: store.id,
        store_name: store.name,
      });

      if (store.owner_id) {
        await supabase.from("notifications").insert({
          user_id: store.owner_id,
          type: "system",
          title: "Bannissement levé",
          message: `Le bannissement de votre boutique "${store.name}" a été levé.`,
          link: "/vendor",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-store-moderation"] });
      toast.success("Bannissement levé");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleActivity = (key: string) => {
    setSelectedActivities((prev) =>
      prev.includes(key) ? prev.filter((a) => a !== key) : [...prev, key]
    );
  };

  function getStoreStatus(s: StoreRow) {
    if (s.is_banned) return { label: "Bannie", color: "bg-destructive/10 text-destructive", icon: Ban };
    if (s.is_suspended) return { label: "Suspendue", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", icon: ShieldAlert };
    return { label: "Active", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", icon: ShieldCheck };
  }

  return (
    <AdminLayout title="Modération boutiques">
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total", value: stores.length, color: "text-foreground" },
          { label: "Actives", value: activeCount, color: "text-emerald-600" },
          { label: "Suspendues", value: suspendedCount, color: "text-amber-600" },
          { label: "Bannies", value: bannedCount, color: "text-destructive" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              placeholder="Rechercher par nom, propriétaire, email..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            {(["all", "active", "suspended", "banned"] as StoreStatus[]).map((s) => (
              <Button
                key={s}
                variant={statusFilter === s ? "default" : "outline"}
                size="sm"
                onClick={() => { setStatusFilter(s); setCurrentPage(1); }}
              >
                {s === "all" ? "Toutes" : s === "active" ? "Actives" : s === "suspended" ? "Suspendues" : "Bannies"}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Store list */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin" /></div>
          ) : paginated.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">Aucune boutique trouvée.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-border bg-muted/30">
                    <th className="text-left p-3 font-medium">Boutique</th>
                    <th className="text-left p-3 font-medium hidden md:table-cell">Propriétaire</th>
                    <th className="text-left p-3 font-medium">Statut</th>
                    <th className="text-left p-3 font-medium hidden sm:table-cell">Produits</th>
                    <th className="text-left p-3 font-medium hidden sm:table-cell">Ventes</th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((s) => {
                    const status = getStoreStatus(s);
                    const StatusIcon = status.icon;
                    return (
                      <tr key={s.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                              {s.logo_url ? (
                                <img src={s.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
                              ) : (
                                <Store size={14} className="text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-foreground truncate">{s.name}</p>
                              <p className="text-xs text-muted-foreground">{format(new Date(s.created_at), "d MMM yyyy", { locale: fr })}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 hidden md:table-cell">
                          <p className="text-foreground text-xs">{s.owner_name || "—"}</p>
                          <p className="text-xs text-muted-foreground">{s.owner_email || "—"}</p>
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${status.color}`}>
                            <StatusIcon size={10} /> {status.label}
                          </span>
                          {s.is_suspended && s.suspended_activities.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-0.5">
                              {s.suspended_activities.map((a) => (
                                <span key={a} className="text-[9px] px-1.5 py-0 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">{a}</span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground hidden sm:table-cell">{s.products_count ?? 0}</td>
                        <td className="p-3 text-muted-foreground hidden sm:table-cell">{s.sales_count ?? 0}</td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {!s.is_banned && !s.is_suspended && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-amber-600 border-amber-300 hover:bg-amber-50 text-xs"
                                onClick={() => { setSelectedStore(s); setShowSuspendDialog(true); }}
                              >
                                <ShieldAlert size={12} className="mr-1" /> Suspendre
                              </Button>
                            )}
                            {s.is_suspended && !s.is_banned && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-emerald-600 border-emerald-300 hover:bg-emerald-50 text-xs"
                                onClick={() => unsuspendMutation.mutate(s)}
                                disabled={unsuspendMutation.isPending}
                              >
                                <ShieldCheck size={12} className="mr-1" /> Lever
                              </Button>
                            )}
                            {!s.is_banned && (
                              <Button
                                size="sm"
                                variant="destructive"
                                className="text-xs"
                                onClick={() => { setSelectedStore(s); setShowBanDialog(true); }}
                              >
                                <Ban size={12} className="mr-1" /> Bannir
                              </Button>
                            )}
                            {s.is_banned && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-emerald-600 border-emerald-300 hover:bg-emerald-50 text-xs"
                                onClick={() => unbanMutation.mutate(s)}
                                disabled={unbanMutation.isPending}
                              >
                                <ShieldCheck size={12} className="mr-1" /> Débannir
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <DataTablePagination
            totalItems={filtered.length}
            currentPage={safePage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
          />
        </CardContent>
      </Card>

      {/* Suspend dialog */}
      <Dialog open={showSuspendDialog} onOpenChange={setShowSuspendDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert size={18} className="text-amber-500" />
              Suspendre « {selectedStore?.name} »
            </DialogTitle>
            <DialogDescription>
              Choisissez les activités à suspendre ou laissez vide pour tout bloquer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Raison de la suspension</label>
              <Textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Ex: Produits contrefaits, retards de livraison..."
                rows={3}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Activités à suspendre</label>
              <p className="text-xs text-muted-foreground mb-3">Si aucune sélectionnée, toutes les activités seront bloquées.</p>
              <div className="space-y-2">
                {ACTIVITY_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isChecked = selectedActivities.includes(opt.key);
                  return (
                    <label
                      key={opt.key}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        isChecked ? "border-amber-400 bg-amber-50 dark:bg-amber-900/10" : "border-border hover:bg-muted/30"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleActivity(opt.key)}
                        className="rounded"
                      />
                      <Icon size={16} className={isChecked ? "text-amber-600" : "text-muted-foreground"} />
                      <div>
                        <p className="text-sm font-medium">{opt.label}</p>
                        <p className="text-xs text-muted-foreground">{opt.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSuspendDialog(false)}>Annuler</Button>
            <Button
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={() => suspendMutation.mutate()}
              disabled={suspendMutation.isPending}
            >
              {suspendMutation.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : <ShieldAlert size={14} className="mr-1" />}
              Confirmer la suspension
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ban dialog */}
      <Dialog open={showBanDialog} onOpenChange={setShowBanDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Ban size={18} />
              Bannir « {selectedStore?.name} »
            </DialogTitle>
            <DialogDescription>
              Le bannissement est définitif. La boutique et tous ses produits seront masqués.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Raison du bannissement</label>
              <Textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Ex: Fraude confirmée, violation grave des CGU..."
                rows={3}
              />
            </div>
            <label className="flex items-center gap-3 p-3 rounded-lg border border-destructive/30 bg-destructive/5 cursor-pointer">
              <Switch checked={banOwnerToo} onCheckedChange={setBanOwnerToo} />
              <div>
                <p className="text-sm font-medium text-foreground">Bannir aussi le propriétaire</p>
                <p className="text-xs text-muted-foreground">
                  L'utilisateur {selectedStore?.owner_name || selectedStore?.owner_email || ""} sera aussi banni de la plateforme.
                </p>
              </div>
            </label>
            <div className="p-3 bg-destructive/5 rounded-lg border border-destructive/20">
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle size={12} />
                Cette action est irréversible pour la boutique. Les commandes en cours ne seront pas annulées automatiquement.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBanDialog(false)}>Annuler</Button>
            <Button
              variant="destructive"
              onClick={() => banMutation.mutate()}
              disabled={banMutation.isPending}
            >
              {banMutation.isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : <Ban size={14} className="mr-1" />}
              Confirmer le bannissement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
