import { useState, useMemo } from "react";
import { LocationHierarchyFilter, type LocationFilters } from "@/components/admin/LocationHierarchyFilter";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Search, UserCheck, ShieldCheck, Store, Truck, Bike, Loader2, Download, Ban, Users, Wifi, Archive, RefreshCw } from "lucide-react";
import { DataTablePagination } from "@/components/ui/DataTablePagination";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  format, subDays, subMonths, subWeeks, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval,
  startOfDay, endOfDay, isWithinInterval, parseISO,
} from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { UserDetailDrawer } from "@/components/admin/UserDetailDrawer";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { AppRole } from "@/hooks/use-roles";
import { ALL_APP_ROLES, ROLE_LABELS_FR } from "@/lib/role-labels";
import { Checkbox } from "@/components/ui/checkbox";

type RoleFilter = "all" | "customer" | AppRole;
type StatusFilter = "all" | "active" | "banned" | "online" | "offline";
type GenderFilter = "all" | "male" | "female" | "other";
type AgeFilter = "all" | "18-25" | "26-35" | "36-45" | "46+";
type ChartPeriod = "day" | "week" | "month" | "year";
type SignupFilter = "all" | "today" | "yesterday" | "7d" | "30d" | "custom";
type ActivityFilter = "all" | "seen_today" | "seen_7d" | "never_logged_in";

const ALL_ROLES: AppRole[] = ALL_APP_ROLES;

const roleIcons: Record<string, React.ElementType> = {
  vendor: Store,
  forwarder: Truck,
  shipper: Truck,
  operator: Truck,
  rider: Bike,
  customer: UserCheck,
  admin: ShieldCheck,
  manager: ShieldCheck,
};

const roleLabels = ROLE_LABELS_FR;

const roleBadgeColors: Record<string, string> = {
  admin: "bg-destructive/10 text-destructive",
  manager: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  vendor: "bg-primary/10 text-primary",
  forwarder: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  shipper: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  operator: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  rider: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

const DEFAULT_PAGE_SIZE = 25;

function getAge(birthYear: number | null | undefined): number | null {
  if (!birthYear) return null;
  return new Date().getFullYear() - birthYear;
}

function matchesAge(birthYear: number | null | undefined, filter: AgeFilter): boolean {
  if (filter === "all") return true;
  const age = getAge(birthYear);
  if (age === null) return false;
  switch (filter) {
    case "18-25": return age >= 18 && age <= 25;
    case "26-35": return age >= 26 && age <= 35;
    case "36-45": return age >= 36 && age <= 45;
    case "46+": return age >= 46;
    default: return true;
  }
}

function lastSignIn(u: { auth_last_sign_in_at?: string | null; last_login_at?: string | null }) {
  return u.auth_last_sign_in_at || u.last_login_at || null;
}

function isArchived(u: { deleted_at?: string | null; ban_reason?: string | null }) {
  return Boolean(u.deleted_at) || Boolean(u.ban_reason?.startsWith("[SOFT_DELETE]"));
}

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("all");
  const [ageFilter, setAgeFilter] = useState<AgeFilter>("all");
  const [signupFilter, setSignupFilter] = useState<SignupFilter>("all");
  const [signupFrom, setSignupFrom] = useState("");
  const [signupTo, setSignupTo] = useState("");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [showArchives, setShowArchives] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("day");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const [locationFilters, setLocationFilters] = useState<LocationFilters>({});

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*");
      return (data ?? []) as any[];
    },
  });

  const { data: userRolesMap = {} } = useQuery({
    queryKey: ["admin-all-roles"],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("user_id, role");
      if (!data) return {};
      const map: Record<string, string[]> = {};
      data.forEach((r) => { if (!map[r.user_id]) map[r.user_id] = []; map[r.user_id].push(r.role); });
      return map;
    },
  });

  const syncSignInsMutation = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke("admin-users", {
        body: { action: "sync_auth_sign_ins" },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success(`Connexions Auth synchronisées (${data?.count ?? 0} comptes)`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const batchSoftDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      let ok = 0;
      const failures: string[] = [];
      for (const userId of ids) {
        const res = await supabase.functions.invoke("admin-users", {
          body: { action: "soft_delete_user", userId, reason: "Batch soft-delete jamais connecté" },
        });
        if (!res.error && !res.data?.error) ok += 1;
        else failures.push(userId.slice(0, 8));
      }
      return { ok, failCount: failures.length };
    },
    onSuccess: ({ ok, failCount }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setSelectedIds(new Set());
      if (failCount > 0) {
        toast.warning(`${ok} archivé(s), ${failCount} échec(s) — réessayez (rate limit possible)`);
      } else {
        toast.success(`${ok} compte(s) archivé(s)`);
      }
    },
    onError: (e: any) => toast.error(e.message),
  });

  const users = useMemo(() => profiles.map((p) => ({
    ...p,
    roles: ((userRolesMap as Record<string, string[]>)[p.id] || []) as AppRole[],
  })), [profiles, userRolesMap]);

  const ONLINE_THRESHOLD = useMemo(() => new Date(Date.now() - 5 * 60 * 1000).toISOString(), []);
  const onlineCount = useMemo(() =>
    users.filter(u => !isArchived(u) && u.is_online && u.last_seen_at && u.last_seen_at > ONLINE_THRESHOLD).length,
    [users, ONLINE_THRESHOLD]
  );

  const filtered = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const yesterdayStart = startOfDay(subDays(now, 1));
    const day7 = subDays(now, 7);
    const day30 = subDays(now, 30);

    return users.filter((u) => {
      const archived = isArchived(u);
      if (showArchives) {
        if (!archived) return false;
      } else if (archived) {
        return false;
      }

      const matchesSearch = !search ||
        `${u.first_name} ${u.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
        (u.email || "").toLowerCase().includes(search.toLowerCase());
      const matchesRole =
        roleFilter === "all" ||
        (roleFilter === "customer" && u.roles.length === 0) ||
        (roleFilter !== "customer" && u.roles.includes(roleFilter as AppRole));
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "banned" && u.is_banned) ||
        (statusFilter === "active" && !u.is_banned) ||
        (statusFilter === "online" && u.is_online && u.last_seen_at && u.last_seen_at > ONLINE_THRESHOLD) ||
        (statusFilter === "offline" && (!u.is_online || !u.last_seen_at || u.last_seen_at <= ONLINE_THRESHOLD));
      const matchesGender = genderFilter === "all" || (u.gender || "").toLowerCase() === genderFilter;
      const matchesAgeFilter = matchesAge(u.birth_year, ageFilter);

      const created = new Date(u.created_at);
      let matchesSignup = true;
      if (signupFilter === "today") matchesSignup = created >= todayStart;
      else if (signupFilter === "yesterday") matchesSignup = created >= yesterdayStart && created < todayStart;
      else if (signupFilter === "7d") matchesSignup = created >= day7;
      else if (signupFilter === "30d") matchesSignup = created >= day30;
      else if (signupFilter === "custom" && signupFrom && signupTo) {
        try {
          matchesSignup = isWithinInterval(created, {
            start: startOfDay(parseISO(signupFrom)),
            end: endOfDay(parseISO(signupTo)),
          });
        } catch {
          matchesSignup = true;
        }
      }

      const signIn = lastSignIn(u);
      const seenAt = u.last_seen_at ? new Date(u.last_seen_at) : null;
      let matchesActivity = true;
      if (activityFilter === "never_logged_in") matchesActivity = !signIn;
      else if (activityFilter === "seen_today") matchesActivity = !!seenAt && seenAt >= todayStart;
      else if (activityFilter === "seen_7d") matchesActivity = !!seenAt && seenAt >= day7;

      const matchesCountry = !locationFilters.country ||
        (u.nationality || "").toUpperCase() === locationFilters.country.toUpperCase() ||
        (u.residence_country || "").toUpperCase() === locationFilters.country.toUpperCase();
      const matchesCity = !locationFilters.city ||
        (u.residence_city || "").toLowerCase().includes(locationFilters.city.toLowerCase());

      return matchesSearch && matchesRole && matchesStatus && matchesGender && matchesAgeFilter
        && matchesSignup && matchesActivity && matchesCountry && matchesCity;
    });
  }, [
    users, search, roleFilter, statusFilter, genderFilter, ageFilter, ONLINE_THRESHOLD,
    signupFilter, signupFrom, signupTo, activityFilter, showArchives, locationFilters,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleSearch = (val: string) => { setSearch(val); setCurrentPage(1); };
  const handleRoleFilter = (val: RoleFilter) => { setRoleFilter(val); setCurrentPage(1); };
  const handleStatusFilter = (val: StatusFilter) => { setStatusFilter(val); setCurrentPage(1); };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllPage = () => {
    const pageIds = paginated.map((u) => u.id);
    const allSelected = pageIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const exportCSV = () => {
    const headers = ["ID", "Nom", "Email", "Téléphone", "Nationalité", "Rôles", "Statut", "Inscrit le", "Dernière connexion", "Archivé"];
    const rows = filtered.map(u => [
      `#${u.display_id || ""}`,
      `${u.first_name || ""} ${u.last_name || ""}`.trim(),
      u.email || "",
      u.phone || "",
      u.nationality || "",
      u.roles.length > 0 ? u.roles.map(r => roleLabels[r]).join(", ") : "Client",
      u.is_banned ? "Banni" : "Actif",
      format(new Date(u.created_at), "yyyy-MM-dd"),
      lastSignIn(u) ? format(new Date(lastSignIn(u)!), "yyyy-MM-dd HH:mm") : "Jamais",
      u.deleted_at ? format(new Date(u.deleted_at), "yyyy-MM-dd") : "",
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `utilisateurs-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filtered.length} utilisateurs exportés`);
  };

  const selectedUser = selectedUserId ? users.find(u => u.id === selectedUserId) : null;

  const liveUsers = users.filter(u => !isArchived(u));
  const archivedCount = users.filter(u => isArchived(u)).length;
  const bannedCount = liveUsers.filter(u => u.is_banned).length;
  const activeCount = liveUsers.filter(u => !u.is_banned).length;
  const neverLoggedCount = liveUsers.filter(u => !lastSignIn(u)).length;

  const chartData = useMemo(() => {
    const now = new Date();
    let intervals: Date[];
    let formatStr: string;

    switch (chartPeriod) {
      case "day":
        intervals = eachDayOfInterval({ start: subDays(now, 30), end: now });
        formatStr = "dd/MM";
        break;
      case "week":
        intervals = eachWeekOfInterval({ start: subWeeks(now, 12), end: now });
        formatStr = "dd/MM";
        break;
      case "month":
        intervals = eachMonthOfInterval({ start: subMonths(now, 12), end: now });
        formatStr = "MMM yy";
        break;
      case "year":
        intervals = eachMonthOfInterval({ start: subMonths(now, 24), end: now });
        formatStr = "MMM yy";
        break;
      default:
        intervals = eachDayOfInterval({ start: subDays(now, 30), end: now });
        formatStr = "dd/MM";
    }

    return intervals.map((d, i) => {
      const nextD = intervals[i + 1] || now;
      const count = liveUsers.filter(u => {
        const c = new Date(u.created_at);
        return c >= d && c < nextD;
      }).length;
      return { label: format(d, formatStr, { locale: fr }), count };
    });
  }, [liveUsers, chartPeriod]);

  const isUserOnline = (u: any) => u.is_online && u.last_seen_at && u.last_seen_at > ONLINE_THRESHOLD;

  const handleBatchSoftDelete = () => {
    const ids = [...selectedIds].filter((id) => {
      const u = users.find((x) => x.id === id);
      return u && !isArchived(u) && !u.roles.includes("admin");
    });
    if (ids.length === 0) {
      toast.error("Aucune sélection éligible");
      return;
    }
    if (!confirm(`Archiver (soft-delete) ${ids.length} compte(s) sélectionné(s) ?`)) return;
    batchSoftDeleteMutation.mutate(ids);
  };

  return (
    <AdminLayout title="Gestion des utilisateurs">
      <div className="mb-4">
        <LocationHierarchyFilter value={locationFilters} onChange={setLocationFilters} levels={["country", "city"]} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 mb-4">
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-primary" />
            <span className="text-xs text-muted-foreground">Total</span>
          </div>
          <p className="text-xl font-bold text-foreground mt-1">{liveUsers.length}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="flex items-center gap-2">
            <UserCheck size={16} className="text-emerald-500" />
            <span className="text-xs text-muted-foreground">Actifs</span>
          </div>
          <p className="text-xl font-bold text-foreground mt-1">{activeCount}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 cursor-pointer hover:border-primary/50 transition-colors" onClick={() => handleStatusFilter("online")}>
          <div className="flex items-center gap-2">
            <Wifi size={16} className="text-emerald-500" />
            <span className="text-xs text-muted-foreground">En ligne</span>
          </div>
          <p className="text-xl font-bold text-emerald-600 mt-1">{onlineCount}</p>
        </div>
        <div
          className="bg-card border border-border rounded-xl p-3 cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => { setActivityFilter("never_logged_in"); setCurrentPage(1); }}
        >
          <div className="flex items-center gap-2">
            <Ban size={16} className="text-amber-500" />
            <span className="text-xs text-muted-foreground">Jamais connecté</span>
          </div>
          <p className="text-xl font-bold text-foreground mt-1">{neverLoggedCount}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="flex items-center gap-2">
            <Ban size={16} className="text-destructive" />
            <span className="text-xs text-muted-foreground">Bannis</span>
          </div>
          <p className="text-xl font-bold text-foreground mt-1">{bannedCount}</p>
        </div>
        <div
          className="bg-card border border-border rounded-xl p-3 cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => { setShowArchives(!showArchives); setCurrentPage(1); }}
        >
          <div className="flex items-center gap-2">
            <Archive size={16} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Archives</span>
          </div>
          <p className="text-xl font-bold text-foreground mt-1">{archivedCount}</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground">Inscriptions</h3>
          <div className="flex gap-1">
            {(["day", "week", "month", "year"] as ChartPeriod[]).map(p => (
              <button
                key={p}
                onClick={() => setChartPeriod(p)}
                className={`px-2.5 py-1 text-[10px] font-medium rounded-full border transition-colors ${
                  chartPeriod === p ? "bg-foreground text-background border-foreground" : "bg-card text-foreground border-border hover:border-foreground"
                }`}
              >
                {p === "day" ? "Jour" : p === "week" ? "Semaine" : p === "month" ? "Mois" : "Année"}
              </button>
            ))}
          </div>
        </div>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Inscriptions" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher par nom ou email..."
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-card border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilter(e.target.value as StatusFilter)}
              className="px-3 py-2 text-xs bg-card border border-border rounded-lg"
            >
              <option value="all">Tous statuts</option>
              <option value="active">Actifs</option>
              <option value="banned">Bannis</option>
              <option value="online">En ligne</option>
              <option value="offline">Hors ligne</option>
            </select>
            <select
              value={signupFilter}
              onChange={(e) => { setSignupFilter(e.target.value as SignupFilter); setCurrentPage(1); }}
              className="px-3 py-2 text-xs bg-card border border-border rounded-lg"
            >
              <option value="all">Inscription</option>
              <option value="today">Aujourd'hui</option>
              <option value="yesterday">Hier</option>
              <option value="7d">7 jours</option>
              <option value="30d">30 jours</option>
              <option value="custom">Plage custom</option>
            </select>
            <select
              value={activityFilter}
              onChange={(e) => { setActivityFilter(e.target.value as ActivityFilter); setCurrentPage(1); }}
              className="px-3 py-2 text-xs bg-card border border-border rounded-lg"
            >
              <option value="all">Activité</option>
              <option value="seen_today">Vu aujourd'hui</option>
              <option value="seen_7d">Vu 7 jours</option>
              <option value="never_logged_in">Jamais connecté</option>
            </select>
            <select
              value={genderFilter}
              onChange={(e) => { setGenderFilter(e.target.value as GenderFilter); setCurrentPage(1); }}
              className="px-3 py-2 text-xs bg-card border border-border rounded-lg"
            >
              <option value="all">Genre</option>
              <option value="male">Homme</option>
              <option value="female">Femme</option>
              <option value="other">Autre</option>
            </select>
            <select
              value={ageFilter}
              onChange={(e) => { setAgeFilter(e.target.value as AgeFilter); setCurrentPage(1); }}
              className="px-3 py-2 text-xs bg-card border border-border rounded-lg"
            >
              <option value="all">Âge</option>
              <option value="18-25">18-25 ans</option>
              <option value="26-35">26-35 ans</option>
              <option value="36-45">36-45 ans</option>
              <option value="46+">46+ ans</option>
            </select>
            <button
              type="button"
              onClick={() => { setShowArchives(!showArchives); setCurrentPage(1); }}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs border rounded-lg transition-colors ${
                showArchives ? "bg-foreground text-background border-foreground" : "bg-card border-border hover:bg-muted"
              }`}
            >
              <Archive size={14} /> Archives
            </button>
            <button
              type="button"
              onClick={() => syncSignInsMutation.mutate()}
              disabled={syncSignInsMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-2 text-xs bg-card border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
              title="Synchroniser last_sign_in Auth → profiles"
            >
              {syncSignInsMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Sync Auth
            </button>
            <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 text-xs bg-card border border-border rounded-lg hover:bg-muted transition-colors">
              <Download size={14} /> CSV ({filtered.length})
            </button>
          </div>
        </div>
        {signupFilter === "custom" && (
          <div className="flex gap-2 items-center text-xs">
            <label className="text-muted-foreground">Du</label>
            <input type="date" value={signupFrom} onChange={(e) => { setSignupFrom(e.target.value); setCurrentPage(1); }} className="px-2 py-1.5 border border-border rounded-lg bg-card" />
            <label className="text-muted-foreground">Au</label>
            <input type="date" value={signupTo} onChange={(e) => { setSignupTo(e.target.value); setCurrentPage(1); }} className="px-2 py-1.5 border border-border rounded-lg bg-card" />
          </div>
        )}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 p-2.5 bg-muted/40 border border-border rounded-lg text-xs">
            <span className="font-medium">{selectedIds.size} sélectionné(s)</span>
            <button
              type="button"
              onClick={handleBatchSoftDelete}
              disabled={batchSoftDeleteMutation.isPending}
              className="px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {batchSoftDeleteMutation.isPending ? "..." : "Soft-delete sélection"}
            </button>
            <button type="button" onClick={() => setSelectedIds(new Set())} className="text-muted-foreground hover:text-foreground">
              Effacer
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-1.5 overflow-x-auto mb-4 pb-1">
        {(["all", "customer", ...ALL_ROLES] as RoleFilter[]).map((r) => {
          const count =
            r === "all"
              ? liveUsers.length
              : r === "customer"
              ? liveUsers.filter((u) => u.roles.length === 0).length
              : liveUsers.filter((u) => u.roles.includes(r as AppRole)).length;
          return (
            <button
              key={r}
              onClick={() => handleRoleFilter(r)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border whitespace-nowrap transition-colors ${
                roleFilter === r
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card text-foreground border-border hover:border-foreground"
              }`}
            >
              {r === "all" ? `Tous (${count})` : `${roleLabels[r]} (${count})`}
            </button>
          );
        })}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                 <tr className="text-xs text-muted-foreground border-b border-border bg-muted/30">
                   <th className="text-left p-3 font-medium w-10">
                     <Checkbox
                       checked={paginated.length > 0 && paginated.every((u) => selectedIds.has(u.id))}
                       onCheckedChange={toggleSelectAllPage}
                       aria-label="Tout sélectionner"
                     />
                   </th>
                   <th className="text-left p-3 font-medium w-16">ID</th>
                   <th className="text-left p-3 font-medium">Utilisateur</th>
                   <th className="text-left p-3 font-medium">Rôle(s)</th>
                   <th className="text-left p-3 font-medium hidden sm:table-cell">Statut</th>
                   <th className="text-left p-3 font-medium hidden md:table-cell">Inscrit le</th>
                   <th className="text-left p-3 font-medium hidden lg:table-cell">Dernière connexion</th>
                   <th className="text-right p-3 font-medium">Détails</th>
                 </tr>
              </thead>
              <tbody>
                {paginated.map((u) => (
                  <tr
                    key={u.id}
                    className={`border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors cursor-pointer ${u.is_banned || isArchived(u) ? "opacity-60" : ""}`}
                    onClick={() => setSelectedUserId(u.id)}
                  >
                     <td className="p-3" onClick={(e) => e.stopPropagation()}>
                       <Checkbox
                         checked={selectedIds.has(u.id)}
                         onCheckedChange={() => toggleSelect(u.id)}
                         aria-label="Sélectionner"
                       />
                     </td>
                     <td className="p-3 text-xs text-muted-foreground font-mono">#{u.display_id || "—"}</td>
                     <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                            {(u.first_name?.[0] || u.email?.[0] || "?").toUpperCase()}
                          </div>
                          <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${
                            isUserOnline(u) ? "bg-emerald-500" : "bg-muted-foreground/30"
                          }`} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-foreground truncate">{u.first_name || ""} {u.last_name || ""}</p>
                          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.length === 0 ? (
                          <span className="text-xs text-muted-foreground italic">Client</span>
                        ) : (
                          u.roles.map((role: string) => {
                            const Icon = roleIcons[role] || UserCheck;
                            return (
                              <span key={role} className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${roleBadgeColors[role] || "bg-muted text-muted-foreground"}`}>
                                <Icon size={10} /> {roleLabels[role] || role}
                              </span>
                            );
                          })
                        )}
                      </div>
                    </td>
                    <td className="p-3 hidden sm:table-cell">
                      <div className="flex flex-col gap-1">
                        {isArchived(u) ? (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium w-fit">
                            <Archive size={10} /> Archivé
                          </span>
                        ) : u.is_banned ? (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium w-fit">
                            <Ban size={10} /> Banni
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 font-medium w-fit">
                            Actif
                          </span>
                        )}
                        {isUserOnline(u) && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 font-medium w-fit">
                            <Wifi size={10} /> En ligne
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-muted-foreground text-xs hidden md:table-cell">
                      {format(new Date(u.created_at), "d MMM yyyy", { locale: fr })}
                    </td>
                    <td className="p-3 text-muted-foreground text-xs hidden lg:table-cell">
                      {lastSignIn(u)
                        ? format(new Date(lastSignIn(u)!), "d MMM yyyy HH:mm", { locale: fr })
                        : <span className="text-muted-foreground/50 italic">Jamais</span>
                      }
                    </td>
                    <td className="p-3 text-right">
                      <button className="px-3 py-1.5 text-xs bg-muted rounded-lg hover:bg-muted/80 text-foreground transition-colors">
                        Voir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">Aucun utilisateur trouvé.</div>
        )}
        <DataTablePagination
          totalItems={filtered.length}
          currentPage={safePage}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
        />
      </div>

      {selectedUser && (
        <UserDetailDrawer
          user={selectedUser}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </AdminLayout>
  );
}
