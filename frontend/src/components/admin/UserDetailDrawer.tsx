import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/lib/supabase-helpers";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Loader2, AlertTriangle, Ban, ShieldCheck, Mail, ChevronRight, X,
  ClipboardList, Activity, Brain, UserCheck, LogIn
} from "lucide-react";
import type { AppRole } from "@/hooks/use-roles";

const ALL_ROLES: AppRole[] = ["admin", "manager", "vendor", "shipper", "rider"];

const roleLabels: Record<string, string> = {
  admin: "Admin", manager: "Manager", vendor: "Vendeur", shipper: "Transporteur", rider: "Livreur",
};

const roleBadgeColors: Record<string, string> = {
  admin: "bg-destructive/10 text-destructive",
  manager: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  vendor: "bg-primary/10 text-primary",
  shipper: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  rider: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

const severityLabels: Record<string, string> = {
  warning: "Avertissement",
  final_warning: "Dernier avertissement",
};

const auditActionLabels: Record<string, string> = {
  ban: "Bannissement",
  unban: "Débannissement",
  add_role: "Rôle ajouté",
  remove_role: "Rôle retiré",
  warning: "Avertissement",
  reset_password: "Réinit. mot de passe",
  impersonation_start: "Impersonation démarrée",
  impersonation_end: "Impersonation terminée",
};

const activityActionLabels: Record<string, string> = {
  login: "Connexion",
  logout: "Déconnexion",
  profile_update: "Mise à jour profil",
  search: "Recherche",
  page_view: "Vue page",
  address_add: "Adresse ajoutée",
  address_delete: "Adresse supprimée",
  payment_method_add: "Méthode paiement ajoutée",
  payment_method_delete: "Méthode paiement supprimée",
  order_placed: "Commande passée",
  order_cancelled: "Commande annulée",
  kyc_submitted: "KYC soumis",
  password_changed: "Mot de passe changé",
  settings_changed: "Paramètres modifiés",
  impersonated: "Impersonation par admin",
};

const getFunctionErrorMessage = async (error: unknown, fallback = "Une erreur est survenue") => {
  if (!error || typeof error !== "object") return fallback;

  const baseMessage = "message" in error && typeof error.message === "string"
    ? error.message
    : fallback;

  const context = "context" in error ? error.context : null;
  if (!context || typeof context !== "object" || !("json" in context) || typeof context.json !== "function") {
    return baseMessage;
  }

  try {
    const payload = await context.json();
    if (payload && typeof payload === "object") {
      if ("error" in payload && typeof payload.error === "string") return payload.error;
      if ("message" in payload && typeof payload.message === "string") return payload.message;
    }
  } catch {
    // noop
  }

  return baseMessage;
};

interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  is_banned: boolean;
  ban_reason: string | null;
  banned_at: string | null;
  display_id?: number | null;
  nationality?: string | null;
  residence_address?: string | null;
  residence_city?: string | null;
  last_known_lat?: number | null;
  last_known_lng?: number | null;
  last_login_at?: string | null;
  login_count?: number | null;
  preferred_language?: string | null;
  preferred_contact_channel?: string | null;
  customer_tier?: string | null;
}

interface UserDetailDrawerProps {
  user: UserProfile & { roles: AppRole[] };
  onClose: () => void;
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

export function UserDetailDrawer({ user, onClose }: UserDetailDrawerProps) {
  const queryClient = useQueryClient();
  const [warningReason, setWarningReason] = useState("");
  const [warningSeverity, setWarningSeverity] = useState<"warning" | "final_warning">("warning");
  const [banReason, setBanReason] = useState("");
  const [showBanConfirm, setShowBanConfirm] = useState(false);
  const [showAddRole, setShowAddRole] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [showActivityLogs, setShowActivityLogs] = useState(false);
  const [showAiAnalysis, setShowAiAnalysis] = useState(false);

  // Fetch warnings
  const { data: warnings = [] } = useQuery({
    queryKey: ["user-warnings", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_warnings")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Fetch orders count
  const { data: orderStats } = useQuery({
    queryKey: ["user-order-stats", user.id],
    queryFn: async () => {
      const { count: total } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      const { count: cancelled } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "cancelled");
      return { total: total || 0, cancelled: cancelled || 0 };
    },
  });

  // Fetch auth details
  const { data: authDetails } = useQuery({
    queryKey: ["user-auth-details", user.id],
    queryFn: async () => {
      const res = await supabase.functions.invoke("admin-users", {
        body: { action: "get_user_details", userId: user.id },
      });
      return res.data;
    },
  });

  // Fetch audit logs for this user
  const { data: auditLogs = [] } = useQuery({
    queryKey: ["user-audit-logs", user.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_audit_logs")
        .select("*")
        .eq("target_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    enabled: showAuditLog,
  });

  // Fetch admin names for audit logs
  const { data: adminProfiles = {} } = useQuery({
    queryKey: ["audit-admin-profiles", auditLogs.map((l: any) => l.admin_id).join(",")],
    queryFn: async () => {
      const ids = [...new Set(auditLogs.map((l: any) => l.admin_id))];
      if (ids.length === 0) return {};
      const { data } = await supabase.from("profiles").select("id, first_name, last_name").in("id", ids);
      const map: Record<string, string> = {};
      data?.forEach((p) => { map[p.id] = `${p.first_name || ""} ${p.last_name || ""}`.trim() || "Admin"; });
      return map;
    },
    enabled: auditLogs.length > 0,
  });

  // Fetch activity logs
  const { data: activityLogs = [], isLoading: activityLoading } = useQuery({
    queryKey: ["user-activity-logs", user.id],
    queryFn: async () => {
      const { data } = await fromTable("user_activity_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
    enabled: showActivityLogs,
  });

  // Fetch vendor→customer ratings
  const { data: customerRatings } = useQuery({
    queryKey: ["customer-ratings", user.id],
    queryFn: async () => {
      const { data } = await fromTable("customer_ratings")
        .select("rating")
        .eq("customer_id", user.id);
      if (!data || data.length === 0) return null;
      const avg = data.reduce((s: number, r: any) => s + r.rating, 0) / data.length;
      return { avg: Math.round(avg * 10) / 10, count: data.length };
    },
  });

  // AI analysis
  const aiAnalysisMutation = useMutation({
    mutationFn: async (analysisType: "risk" | "segmentation") => {
      const res = await supabase.functions.invoke("ai-user-analysis", {
        body: { targetUserId: user.id, analysisType },
      });
      if (res.error) throw new Error(res.error.message);
      return res.data;
    },
    onError: (e: any) => toast.error(`Analyse IA échouée: ${e.message}`),
  });

  // Impersonation — open in new tab
  const impersonateMutation = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke("impersonate-user", {
        body: { action: "start", targetUserId: user.id },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["user-audit-logs", user.id] });
      // Open new tab with impersonation token
      const url = `${window.location.origin}/impersonate?token=${data.token}`;
      window.open(url, "_blank");
      toast.success(`Onglet d'impersonation ouvert pour ${data.targetName}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Send warning
  const sendWarningMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("user_warnings").insert({
        user_id: user.id,
        warned_by: (await supabase.auth.getUser()).data.user!.id,
        reason: warningReason,
        severity: warningSeverity,
      });
      if (error) throw error;
      await logAudit("warning", user.id, { reason: warningReason, severity: warningSeverity });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-warnings", user.id] });
      queryClient.invalidateQueries({ queryKey: ["user-audit-logs", user.id] });
      setWarningReason("");
      toast.success("Avertissement envoyé");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Reset password
  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke("admin-users", {
        body: { action: "reset_password", userId: user.id },
      });
      if (res.error) throw new Error(await getFunctionErrorMessage(res.error, "Échec d'envoi de l'email de réinitialisation"));
      if (res.data?.error) throw new Error(res.data.error);
      await logAudit("reset_password", user.id, { email: res.data.email });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["user-audit-logs", user.id] });
      toast.success(`Email de réinitialisation envoyé à ${data.email}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Ban/Unban
  const banMutation = useMutation({
    mutationFn: async (action: "ban_user" | "unban_user") => {
      const res = await supabase.functions.invoke("admin-users", {
        body: { action, userId: user.id, reason: banReason },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      await logAudit(action === "ban_user" ? "ban" : "unban", user.id, { reason: banReason || undefined });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["user-audit-logs", user.id] });
      setShowBanConfirm(false);
      setBanReason("");
      toast.success(user.is_banned ? "Utilisateur débanni" : "Utilisateur banni");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Add/Remove role
  const addRoleMutation = useMutation({
    mutationFn: async (role: AppRole) => {
      const { error } = await supabase.from("user_roles").insert({ user_id: user.id, role });
      if (error) throw error;
      await logAudit("add_role", user.id, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-all-roles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["user-audit-logs", user.id] });
      setShowAddRole(false);
      toast.success("Rôle ajouté");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeRoleMutation = useMutation({
    mutationFn: async (role: AppRole) => {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", user.id).eq("role", role);
      if (error) throw error;
      await logAudit("remove_role", user.id, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-all-roles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["user-audit-logs", user.id] });
      toast.success("Rôle retiré");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const availableRoles = ALL_ROLES.filter(r => !user.roles.includes(r));
  const cancellationRate = orderStats && orderStats.total > 0
    ? Math.round((orderStats.cancelled / orderStats.total) * 100)
    : 0;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-card border-l border-border z-50 overflow-y-auto shadow-2xl animate-in slide-in-from-right-full duration-300">
        <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-foreground">Fiche utilisateur</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-6">
          {/* User header */}
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground shrink-0">
              {(user.first_name?.[0] || user.email?.[0] || "?").toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">#{user.display_id || "—"}</span>
                <h3 className="font-semibold text-foreground truncate">
                  {user.first_name || ""} {user.last_name || ""}
                </h3>
                {user.is_banned && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-destructive/10 text-destructive">BANNI</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground truncate">{user.email}</p>
              {user.phone && <p className="text-xs text-muted-foreground">{user.phone}</p>}
              {user.nationality && <p className="text-xs text-muted-foreground">🌍 {user.nationality}</p>}
              <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{user.id}</p>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-muted/30 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-foreground">{orderStats?.total ?? "—"}</p>
              <p className="text-[10px] text-muted-foreground">Commandes</p>
            </div>
            <div className="bg-muted/30 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-foreground">{cancellationRate}%</p>
              <p className="text-[10px] text-muted-foreground">Annulations</p>
            </div>
            <div className="bg-muted/30 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-foreground">{customerRatings ? `${customerRatings.avg}★` : "—"}</p>
              <p className="text-[10px] text-muted-foreground">Note vendeur</p>
            </div>
            <div className="bg-muted/30 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-foreground">{warnings.length}</p>
              <p className="text-[10px] text-muted-foreground">Alertes</p>
            </div>
          </div>

          {/* Auth info */}
          <div className="bg-muted/20 rounded-xl p-4 space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Informations compte</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Inscrit le</span>
                <p className="font-medium text-foreground">{format(new Date(user.created_at), "d MMM yyyy", { locale: fr })}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Dernière connexion</span>
                <p className="font-medium text-foreground">
                  {user.last_login_at ? format(new Date(user.last_login_at), "d MMM yyyy HH:mm", { locale: fr }) : authDetails?.last_sign_in_at ? format(new Date(authDetails.last_sign_in_at), "d MMM yyyy HH:mm", { locale: fr }) : "—"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Connexions</span>
                <p className="font-medium text-foreground">{user.login_count ?? "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Email confirmé</span>
                <p className="font-medium text-foreground">{authDetails?.email_confirmed_at ? "✓ Oui" : "✗ Non"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Tier client</span>
                <p className="font-medium text-foreground capitalize">{user.customer_tier || "bronze"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Providers</span>
                <p className="font-medium text-foreground">{authDetails?.providers?.join(", ") || "email"}</p>
              </div>
            </div>
          </div>

          {/* Location & Preferences */}
          <div className="bg-muted/20 rounded-xl p-4 space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Localisation & Préférences</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-muted-foreground">Résidence</span>
                <p className="font-medium text-foreground">{user.residence_address ? `${user.residence_address}, ${user.residence_city || ""}` : "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">GPS</span>
                <p className="font-medium text-foreground">
                  {user.last_known_lat && user.last_known_lng
                    ? `${user.last_known_lat.toFixed(4)}, ${user.last_known_lng.toFixed(4)}`
                    : "Non disponible"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Langue</span>
                <p className="font-medium text-foreground">{user.preferred_language === "fr" ? "Français" : user.preferred_language === "en" ? "English" : user.preferred_language || "fr"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Canal préféré</span>
                <p className="font-medium text-foreground capitalize">{user.preferred_contact_channel || "chat"}</p>
              </div>
            </div>
          </div>

          {/* Roles */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Rôles</h4>
              {availableRoles.length > 0 && (
                <button onClick={() => setShowAddRole(!showAddRole)} className="text-xs text-primary hover:underline">
                  + Ajouter
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {user.roles.length === 0 && <span className="text-xs text-muted-foreground italic">Client (aucun rôle)</span>}
              {user.roles.map(role => (
                <span key={role} className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full ${roleBadgeColors[role] || "bg-muted text-muted-foreground"}`}>
                  {roleLabels[role] || role}
                  <button onClick={() => removeRoleMutation.mutate(role)} className="ml-0.5 hover:text-destructive"><X size={10} /></button>
                </span>
              ))}
            </div>
            {showAddRole && (
              <div className="flex flex-wrap gap-1.5 p-2 bg-muted/30 rounded-lg">
                {availableRoles.map(role => (
                  <button key={role} onClick={() => addRoleMutation.mutate(role)}
                    className="text-xs px-3 py-1.5 rounded-full border border-border hover:bg-primary hover:text-primary-foreground transition-colors">
                    {roleLabels[role]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</h4>

            {/* Impersonation */}
            <button
              onClick={() => impersonateMutation.mutate()}
              disabled={impersonateMutation.isPending}
              className="w-full flex items-center gap-3 px-4 py-3 bg-blue-500/5 rounded-xl hover:bg-blue-500/10 transition-colors text-sm text-blue-600 dark:text-blue-400"
            >
              <Eye size={16} />
              <span className="flex-1 text-left">Voir comme cet utilisateur</span>
              {impersonateMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} className="text-muted-foreground" />}
            </button>

            <button
              onClick={() => resetPasswordMutation.mutate()}
              disabled={resetPasswordMutation.isPending}
              className="w-full flex items-center gap-3 px-4 py-3 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors text-sm text-foreground"
            >
              <Mail size={16} className="text-primary" />
              <span className="flex-1 text-left">Envoyer réinitialisation mot de passe</span>
              {resetPasswordMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} className="text-muted-foreground" />}
            </button>

            {!user.is_banned ? (
              <button
                onClick={() => setShowBanConfirm(true)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-destructive/5 rounded-xl hover:bg-destructive/10 transition-colors text-sm text-destructive"
              >
                <Ban size={16} />
                <span className="flex-1 text-left">Bannir l'utilisateur</span>
                <ChevronRight size={14} />
              </button>
            ) : (
              <button
                onClick={() => banMutation.mutate("unban_user")}
                disabled={banMutation.isPending}
                className="w-full flex items-center gap-3 px-4 py-3 bg-emerald-500/5 rounded-xl hover:bg-emerald-500/10 transition-colors text-sm text-emerald-600"
              >
                <ShieldCheck size={16} />
                <span className="flex-1 text-left">Débannir l'utilisateur</span>
                {banMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <ChevronRight size={14} />}
              </button>
            )}
          </div>

          {/* Ban confirm */}
          {showBanConfirm && (
            <div className="p-4 border border-destructive/30 rounded-xl bg-destructive/5 space-y-3">
              <p className="text-sm font-medium text-destructive">Confirmer le bannissement</p>
              <textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Raison du bannissement..."
                className="w-full p-2.5 text-sm border border-border rounded-lg bg-background resize-none h-20"
              />
              <div className="flex gap-2">
                <button onClick={() => setShowBanConfirm(false)} className="flex-1 py-2 text-xs rounded-lg border border-border hover:bg-muted">Annuler</button>
                <button
                  onClick={() => banMutation.mutate("ban_user")}
                  disabled={banMutation.isPending || !banReason.trim()}
                  className="flex-1 py-2 text-xs rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                >
                  {banMutation.isPending ? "..." : "Confirmer le ban"}
                </button>
              </div>
            </div>
          )}

          {/* Ban info */}
          {user.is_banned && (
            <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-xl space-y-1">
              <p className="text-xs font-medium text-destructive">Banni {user.banned_at ? `le ${format(new Date(user.banned_at), "d MMM yyyy", { locale: fr })}` : ""}</p>
              {user.ban_reason && <p className="text-xs text-muted-foreground">{user.ban_reason}</p>}
            </div>
          )}

          {/* Warnings section */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Avertissements ({warnings.length})</h4>
            <div className="p-3 bg-muted/20 rounded-xl space-y-2">
              <div className="flex gap-2">
                <select
                  value={warningSeverity}
                  onChange={(e) => setWarningSeverity(e.target.value as "warning" | "final_warning")}
                  className="px-2 py-1.5 text-xs border border-border rounded-lg bg-background"
                >
                  <option value="warning">Avertissement</option>
                  <option value="final_warning">Dernier avertissement</option>
                </select>
              </div>
              <textarea
                value={warningReason}
                onChange={(e) => setWarningReason(e.target.value)}
                placeholder="Raison de l'avertissement..."
                className="w-full p-2.5 text-sm border border-border rounded-lg bg-background resize-none h-16"
              />
              <button
                onClick={() => sendWarningMutation.mutate()}
                disabled={sendWarningMutation.isPending || !warningReason.trim()}
                className="w-full py-2 text-xs rounded-lg bg-accent text-accent-foreground hover:bg-accent/80 disabled:opacity-50 transition-colors"
              >
                {sendWarningMutation.isPending ? "Envoi..." : "Envoyer l'avertissement"}
              </button>
            </div>
            <div className="space-y-2">
              {warnings.map((w: any) => (
                <div key={w.id} className="flex items-start gap-2 p-2.5 bg-muted/10 rounded-lg border border-border/50">
                  <AlertTriangle size={14} className={w.severity === "final_warning" ? "text-destructive mt-0.5" : "text-accent-foreground mt-0.5"} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        w.severity === "final_warning" ? "bg-destructive/10 text-destructive" : "bg-accent/20 text-accent-foreground"
                      }`}>
                        {severityLabels[w.severity] || w.severity}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(w.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                      </span>
                    </div>
                    <p className="text-xs text-foreground mt-1">{w.reason}</p>
                  </div>
                </div>
              ))}
              {warnings.length === 0 && <p className="text-xs text-muted-foreground italic text-center py-2">Aucun avertissement</p>}
            </div>
          </div>

          {/* AI Analysis */}
          <div className="space-y-3">
            <button
              onClick={() => setShowAiAnalysis(!showAiAnalysis)}
              className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
            >
              <Brain size={14} />
              Analyse IA {showAiAnalysis ? "▲" : "▼"}
            </button>
            {showAiAnalysis && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => aiAnalysisMutation.mutate("segmentation")}
                    disabled={aiAnalysisMutation.isPending}
                    className="flex-1 py-2 text-xs rounded-lg border border-border hover:bg-primary/5 hover:border-primary/30 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <UserCheck size={12} />
                    {aiAnalysisMutation.isPending && aiAnalysisMutation.variables === "segmentation" ? <Loader2 size={12} className="animate-spin" /> : "Segmentation"}
                  </button>
                  <button
                    onClick={() => aiAnalysisMutation.mutate("risk")}
                    disabled={aiAnalysisMutation.isPending}
                    className="flex-1 py-2 text-xs rounded-lg border border-border hover:bg-destructive/5 hover:border-destructive/30 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <AlertTriangle size={12} />
                    {aiAnalysisMutation.isPending && aiAnalysisMutation.variables === "risk" ? <Loader2 size={12} className="animate-spin" /> : "Score risque"}
                  </button>
                </div>

                {aiAnalysisMutation.data && (
                  <div className="p-4 bg-muted/20 rounded-xl space-y-3">
                    {aiAnalysisMutation.data.stats && (
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="text-center">
                          <p className="font-bold text-foreground">${aiAnalysisMutation.data.stats.total_spent}</p>
                          <p className="text-[10px] text-muted-foreground">Dépensé</p>
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-foreground">${aiAnalysisMutation.data.stats.avg_basket}</p>
                          <p className="text-[10px] text-muted-foreground">Panier moyen</p>
                        </div>
                        <div className="text-center">
                          <p className="font-bold text-foreground">{aiAnalysisMutation.data.stats.cancellation_rate}%</p>
                          <p className="text-[10px] text-muted-foreground">Taux annulation</p>
                        </div>
                      </div>
                    )}

                    {aiAnalysisMutation.data.analysis && (
                      <div className="space-y-2">
                        {aiAnalysisMutation.data.analysis.segment && (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium capitalize">
                              {aiAnalysisMutation.data.analysis.segment}
                            </span>
                            {aiAnalysisMutation.data.analysis.risk_score != null && (
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                                aiAnalysisMutation.data.analysis.risk_score > 70 ? "bg-destructive/10 text-destructive" :
                                aiAnalysisMutation.data.analysis.risk_score > 40 ? "bg-amber-100 text-amber-700" :
                                "bg-emerald-100 text-emerald-700"
                              }`}>
                                Risque: {aiAnalysisMutation.data.analysis.risk_score}/100
                              </span>
                            )}
                          </div>
                        )}
                        {aiAnalysisMutation.data.analysis.summary && (
                          <p className="text-xs text-foreground">{aiAnalysisMutation.data.analysis.summary}</p>
                        )}
                        {aiAnalysisMutation.data.analysis.flags?.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase">Signalements</p>
                            {aiAnalysisMutation.data.analysis.flags.map((f: string, i: number) => (
                              <p key={i} className="text-xs text-amber-600 dark:text-amber-400">⚠ {f}</p>
                            ))}
                          </div>
                        )}
                        {aiAnalysisMutation.data.analysis.recommendations?.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase">Recommandations</p>
                            {aiAnalysisMutation.data.analysis.recommendations.map((r: string, i: number) => (
                              <p key={i} className="text-xs text-foreground">• {r}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Activity Logs */}
          <div className="space-y-3">
            <button
              onClick={() => setShowActivityLogs(!showActivityLogs)}
              className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
            >
              <Activity size={14} />
              Logs d'activité {showActivityLogs ? "▲" : "▼"}
            </button>
            {showActivityLogs && (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {activityLoading && <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-muted-foreground" /></div>}
                {!activityLoading && activityLogs.length === 0 && (
                  <p className="text-xs text-muted-foreground italic text-center py-2">Aucun log d'activité</p>
                )}
                {activityLogs.map((log: any) => (
                  <div key={log.id} className="flex items-start gap-2 p-2.5 bg-muted/10 rounded-lg border border-border/50">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 font-medium">
                          {activityActionLabels[log.action] || log.action}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(log.created_at), "d MMM yyyy HH:mm:ss", { locale: fr })}
                        </span>
                      </div>
                      {log.metadata && (
                        <div className="text-[10px] text-foreground/70 mt-0.5 space-x-2">
                          {log.metadata.page_path && <span>📄 {log.metadata.page_path}</span>}
                          {log.metadata.browser && <span>🌐 {log.metadata.browser}</span>}
                          {log.metadata.device && <span>📱 {log.metadata.device}</span>}
                          {log.metadata.os && <span>💻 {log.metadata.os}</span>}
                          {log.metadata.impersonated_by && <span className="text-amber-600">👁 par admin</span>}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Audit Log */}
          <div className="space-y-3">
            <button
              onClick={() => setShowAuditLog(!showAuditLog)}
              className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
            >
              <ClipboardList size={14} />
              Journal d'audit {showAuditLog ? "▲" : "▼"}
            </button>
            {showAuditLog && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {auditLogs.length === 0 && <p className="text-xs text-muted-foreground italic text-center py-2">Aucune action enregistrée</p>}
                {auditLogs.map((log: any) => (
                  <div key={log.id} className="flex items-start gap-2 p-2.5 bg-muted/10 rounded-lg border border-border/50">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                          {auditActionLabels[log.action] || log.action}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(log.created_at), "d MMM yyyy HH:mm", { locale: fr })}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        par {(adminProfiles as Record<string, string>)[log.admin_id] || "Admin"}
                      </p>
                      {log.details && Object.keys(log.details).length > 0 && (
                        <p className="text-[10px] text-foreground/70 mt-0.5">
                          {log.details.reason || log.details.role || log.details.email || ""}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
