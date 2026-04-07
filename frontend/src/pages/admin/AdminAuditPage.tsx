import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/lib/supabase-helpers";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Shield, Ban, UserPlus, UserMinus, AlertTriangle, KeyRound, Loader2,
  Search, Calendar, ChevronLeft, ChevronRight, Trash2, LogIn, LogOut,
  ShoppingCart, Package, Edit, Eye, MapPin, CreditCard, FileCheck, Settings,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

// ── Admin action configs ──
const ADMIN_ACTION_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  ban: { label: "Bannissement", icon: Ban, color: "text-destructive" },
  unban: { label: "Débannissement", icon: Shield, color: "text-emerald-600" },
  add_role: { label: "Rôle ajouté", icon: UserPlus, color: "text-primary" },
  remove_role: { label: "Rôle retiré", icon: UserMinus, color: "text-amber-600" },
  warning: { label: "Avertissement", icon: AlertTriangle, color: "text-amber-500" },
  reset_password: { label: "Réinit. mot de passe", icon: KeyRound, color: "text-blue-500" },
};

// ── User activity configs ──
const USER_ACTION_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  login: { label: "Connexion", icon: LogIn, color: "text-emerald-600" },
  logout: { label: "Déconnexion", icon: LogOut, color: "text-muted-foreground" },
  profile_update: { label: "Profil modifié", icon: Edit, color: "text-blue-500" },
  search: { label: "Recherche", icon: Search, color: "text-muted-foreground" },
  page_view: { label: "Page vue", icon: Eye, color: "text-muted-foreground" },
  address_add: { label: "Adresse ajoutée", icon: MapPin, color: "text-primary" },
  address_delete: { label: "Adresse supprimée", icon: MapPin, color: "text-destructive" },
  payment_method_add: { label: "Moyen paiement ajouté", icon: CreditCard, color: "text-primary" },
  payment_method_delete: { label: "Moyen paiement supprimé", icon: CreditCard, color: "text-destructive" },
  order_placed: { label: "Commande passée", icon: ShoppingCart, color: "text-emerald-600" },
  order_cancelled: { label: "Commande annulée", icon: ShoppingCart, color: "text-destructive" },
  product_add: { label: "Produit ajouté", icon: Package, color: "text-primary" },
  product_update: { label: "Produit modifié", icon: Package, color: "text-blue-500" },
  product_delete: { label: "Produit supprimé", icon: Package, color: "text-destructive" },
  kyc_submitted: { label: "KYC soumis", icon: FileCheck, color: "text-amber-500" },
  password_changed: { label: "Mot de passe changé", icon: KeyRound, color: "text-blue-500" },
  settings_changed: { label: "Paramètres modifiés", icon: Settings, color: "text-muted-foreground" },
};

type Tab = "admin" | "users";
const PAGE_SIZE = 50;

export default function AdminAuditPage() {
  const [tab, setTab] = useState<Tab>("admin");
  const [adminFilter, setAdminFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [userSearch, setUserSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [adminPage, setAdminPage] = useState(0);
  const [userPage, setUserPage] = useState(0);

  // ── Profiles map ──
  const { data: profilesMap = {} } = useQuery({
    queryKey: ["admin-profiles-map"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, first_name, last_name, email");
      if (!data) return {};
      const map: Record<string, { name: string; email: string }> = {};
      data.forEach((p) => {
        map[p.id] = {
          name: `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Inconnu",
          email: p.email || "",
        };
      });
      return map;
    },
  });

  // ── Admin audit logs ──
  const { data: adminLogs = [], isLoading: adminLoading } = useQuery({
    queryKey: ["admin-audit-logs", adminFilter, dateFrom, dateTo, adminPage],
    queryFn: async () => {
      let query = supabase
        .from("admin_audit_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(adminPage * PAGE_SIZE, (adminPage + 1) * PAGE_SIZE - 1);

      if (adminFilter !== "all") query = query.eq("action", adminFilter);
      if (dateFrom) query = query.gte("created_at", dateFrom);
      if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59`);

      const { data, count } = await query;
      return { rows: data ?? [], total: count ?? 0 };
    },
    select: (d) => d,
  });

  // ── User activity logs ──
  const { data: userLogs = { rows: [], total: 0 }, isLoading: userLoading } = useQuery({
    queryKey: ["user-activity-logs", userFilter, userSearch, dateFrom, dateTo, userPage],
    queryFn: async () => {
      // Find matching user IDs by search
      let matchedUserIds: string[] | null = null;
      if (userSearch.trim()) {
        const term = userSearch.trim().toLowerCase();
        matchedUserIds = Object.entries(profilesMap)
          .filter(([, p]) => p.name.toLowerCase().includes(term) || p.email.toLowerCase().includes(term))
          .map(([id]) => id);
        if (matchedUserIds.length === 0) return { rows: [], total: 0 };
      }

      let query = fromTable("user_activity_logs")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(userPage * PAGE_SIZE, (userPage + 1) * PAGE_SIZE - 1);

      if (userFilter !== "all") query = query.eq("action", userFilter);
      if (dateFrom) query = query.gte("created_at", dateFrom);
      if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59`);
      if (matchedUserIds) query = query.in("user_id", matchedUserIds);

      const { data, count } = await query;
      return { rows: data ?? [], total: count ?? 0 };
    },
    enabled: tab === "users",
  });

  // ── Purge old logs ──
  const purgeMutation = useMutation({
    mutationFn: async (months: number) => {
      const cutoff = new Date();
      cutoff.setMonth(cutoff.getMonth() - months);
      const { error } = await fromTable("user_activity_logs")
        .delete()
        .lt("created_at", cutoff.toISOString());
      if (error) throw error;
    },
    onSuccess: () => toast.success("Logs purgés avec succès"),
    onError: () => toast.error("Erreur lors de la purge"),
  });

  const getName = (id: string) => (profilesMap as any)[id]?.name || id.slice(0, 8);
  const getEmail = (id: string) => (profilesMap as any)[id]?.email || "";

  const adminTotal = typeof adminLogs === "object" && "total" in adminLogs ? (adminLogs as any).total : 0;
  const adminRows = typeof adminLogs === "object" && "rows" in adminLogs ? (adminLogs as any).rows : adminLogs;
  const adminTotalPages = Math.max(1, Math.ceil(adminTotal / PAGE_SIZE));
  const userTotalPages = Math.max(1, Math.ceil(userLogs.total / PAGE_SIZE));

  return (
    <AdminLayout title="Journal d'audit">
      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-border">
        {([
          { key: "admin" as Tab, label: "Actions admin" },
          { key: "users" as Tab, label: "Activité utilisateurs" },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setAdminPage(0); setUserPage(0); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Date filters (shared) */}
      <div className="flex flex-wrap gap-3 items-end mb-4">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Du</label>
          <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setAdminPage(0); setUserPage(0); }} className="w-40 h-9 text-xs" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Au</label>
          <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setAdminPage(0); setUserPage(0); }} className="w-40 h-9 text-xs" />
        </div>
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="text-xs text-primary hover:underline pb-2">
            Réinitialiser dates
          </button>
        )}
      </div>

      {/* ═══ Admin tab ═══ */}
      {tab === "admin" && (
        <>
          <div className="flex gap-1.5 overflow-x-auto mb-4 pb-1">
            <button
              onClick={() => { setAdminFilter("all"); setAdminPage(0); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border whitespace-nowrap transition-colors ${
                adminFilter === "all" ? "bg-foreground text-background border-foreground" : "bg-card text-foreground border-border hover:border-foreground"
              }`}
            >
              Tout
            </button>
            {Object.entries(ADMIN_ACTION_CONFIG).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => { setAdminFilter(key); setAdminPage(0); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border whitespace-nowrap transition-colors ${
                  adminFilter === key ? "bg-foreground text-background border-foreground" : "bg-card text-foreground border-border hover:border-foreground"
                }`}
              >
                {cfg.label}
              </button>
            ))}
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {adminLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>
            ) : adminRows.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">Aucune action enregistrée.</div>
            ) : (
              <div className="divide-y divide-border/50">
                {adminRows.map((log: any) => {
                  const cfg = ADMIN_ACTION_CONFIG[log.action] || { label: log.action, icon: Shield, color: "text-muted-foreground" };
                  const Icon = cfg.icon;
                  const details = log.details as Record<string, any> | null;
                  return (
                    <div key={log.id} className="flex items-start gap-3 p-4 hover:bg-muted/20 transition-colors">
                      <div className={`w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 ${cfg.color}`}>
                        <Icon size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">
                          <span className="font-medium">{getName(log.admin_id)}</span>
                          {" → "}
                          <span className={`font-semibold ${cfg.color}`}>{cfg.label}</span>
                          {" sur "}
                          <span className="font-medium">{getName(log.target_user_id)}</span>
                        </p>
                        {details && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {details.role && `Rôle : ${details.role}`}
                            {details.reason && `Raison : ${details.reason}`}
                            {details.severity && ` · Sévérité : ${details.severity}`}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {format(new Date(log.created_at), "d MMM yyyy à HH:mm", { locale: fr })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pagination */}
          {adminTotal > PAGE_SIZE && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <button onClick={() => setAdminPage(Math.max(0, adminPage - 1))} disabled={adminPage === 0} className="p-2 rounded-lg border border-border disabled:opacity-30 hover:bg-muted transition-colors">
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs text-muted-foreground">Page {adminPage + 1} / {adminTotalPages}</span>
              <button onClick={() => setAdminPage(Math.min(adminTotalPages - 1, adminPage + 1))} disabled={adminPage >= adminTotalPages - 1} className="p-2 rounded-lg border border-border disabled:opacity-30 hover:bg-muted transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}

      {/* ═══ Users tab ═══ */}
      {tab === "users" && (
        <>
          {/* User search */}
          <div className="flex flex-wrap gap-3 items-end mb-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs text-muted-foreground block mb-1">Rechercher un utilisateur</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={userSearch}
                  onChange={(e) => { setUserSearch(e.target.value); setUserPage(0); }}
                  placeholder="Nom ou email..."
                  className="pl-9 h-9 text-xs"
                />
              </div>
            </div>
            <button
              onClick={() => {
                if (confirm("Supprimer les logs de plus de 6 mois ?")) purgeMutation.mutate(6);
              }}
              disabled={purgeMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-destructive border border-destructive/30 rounded-lg hover:bg-destructive/10 transition-colors"
            >
              <Trash2 size={12} /> Purger +6 mois
            </button>
          </div>

          {/* Action chips */}
          <div className="flex gap-1.5 overflow-x-auto mb-4 pb-1">
            <button
              onClick={() => { setUserFilter("all"); setUserPage(0); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border whitespace-nowrap transition-colors ${
                userFilter === "all" ? "bg-foreground text-background border-foreground" : "bg-card text-foreground border-border hover:border-foreground"
              }`}
            >
              Tout
            </button>
            {Object.entries(USER_ACTION_CONFIG).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => { setUserFilter(key); setUserPage(0); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border whitespace-nowrap transition-colors ${
                  userFilter === key ? "bg-foreground text-background border-foreground" : "bg-card text-foreground border-border hover:border-foreground"
                }`}
              >
                {cfg.label}
              </button>
            ))}
          </div>

          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {userLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>
            ) : userLogs.rows.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">Aucune activité enregistrée.</div>
            ) : (
              <div className="divide-y divide-border/50">
                {userLogs.rows.map((log: any) => {
                  const cfg = USER_ACTION_CONFIG[log.action] || { label: log.action, icon: Eye, color: "text-muted-foreground" };
                  const Icon = cfg.icon;
                  const meta = log.metadata as Record<string, any> | null;
                  return (
                    <div key={log.id} className="flex items-start gap-3 p-4 hover:bg-muted/20 transition-colors">
                      <div className={`w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 ${cfg.color}`}>
                        <Icon size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">
                          <span className="font-medium">{getName(log.user_id)}</span>
                          <span className="text-muted-foreground text-xs ml-1">({getEmail(log.user_id)})</span>
                          {" — "}
                          <span className={`font-semibold ${cfg.color}`}>{cfg.label}</span>
                        </p>
                        {meta && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-lg">
                            {meta.page_path && `Page : ${meta.page_path}`}
                            {meta.device && ` · ${meta.device}`}
                            {meta.browser && ` · ${meta.browser}`}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {format(new Date(log.created_at), "d MMM yyyy à HH:mm", { locale: fr })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pagination */}
          {userLogs.total > PAGE_SIZE && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <button onClick={() => setUserPage(Math.max(0, userPage - 1))} disabled={userPage === 0} className="p-2 rounded-lg border border-border disabled:opacity-30 hover:bg-muted transition-colors">
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs text-muted-foreground">Page {userPage + 1} / {userTotalPages}</span>
              <button onClick={() => setUserPage(Math.min(userTotalPages - 1, userPage + 1))} disabled={userPage >= userTotalPages - 1} className="p-2 rounded-lg border border-border disabled:opacity-30 hover:bg-muted transition-colors">
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </AdminLayout>
  );
}
