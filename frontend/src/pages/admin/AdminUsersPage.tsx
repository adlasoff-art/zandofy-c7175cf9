import { useState, useMemo } from "react";
import { LocationHierarchyFilter, type LocationFilters } from "@/components/admin/LocationHierarchyFilter";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Search, UserCheck, ShieldCheck, Store, Truck, Bike, Loader2, Download, Ban, Filter, Users, Wifi } from "lucide-react";
import { DataTablePagination } from "@/components/ui/DataTablePagination";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, subMonths, subWeeks, startOfDay, startOfWeek, startOfMonth, startOfYear, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { UserDetailDrawer } from "@/components/admin/UserDetailDrawer";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import type { AppRole } from "@/hooks/use-roles";

type RoleFilter = "all" | "customer" | AppRole;
type StatusFilter = "all" | "active" | "banned" | "online" | "offline";
type GenderFilter = "all" | "male" | "female" | "other";
type AgeFilter = "all" | "18-25" | "26-35" | "36-45" | "46+";
type ChartPeriod = "day" | "week" | "month" | "year";

const ALL_ROLES: AppRole[] = ["admin", "manager", "vendor", "shipper", "rider"];

const roleIcons: Record<string, React.ElementType> = {
  vendor: Store, shipper: Truck, rider: Bike, customer: UserCheck, admin: ShieldCheck, manager: ShieldCheck,
};

const roleLabels: Record<string, string> = {
  vendor: "Vendeur", shipper: "Transporteur", rider: "Livreur", customer: "Client", admin: "Admin", manager: "Manager",
};

const roleBadgeColors: Record<string, string> = {
  admin: "bg-destructive/10 text-destructive",
  manager: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  vendor: "bg-primary/10 text-primary",
  shipper: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
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

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("all");
  const [ageFilter, setAgeFilter] = useState<AgeFilter>("all");
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

  const users = useMemo(() => profiles.map((p) => ({
    ...p,
    roles: ((userRolesMap as Record<string, string[]>)[p.id] || []) as AppRole[],
  })), [profiles, userRolesMap]);

  // Online count: is_online = true AND last_seen_at within 2 minutes
  const TWO_MIN_AGO = useMemo(() => new Date(Date.now() - 2 * 60 * 1000).toISOString(), []);
  const onlineCount = useMemo(() =>
    users.filter(u => u.is_online && u.last_seen_at && u.last_seen_at > TWO_MIN_AGO).length,
    [users, TWO_MIN_AGO]
  );

  const filtered = useMemo(() => users.filter((u) => {
    const matchesSearch = !search ||
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" || u.roles.includes(roleFilter);
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "banned" && u.is_banned) ||
      (statusFilter === "active" && !u.is_banned) ||
      (statusFilter === "online" && u.is_online && u.last_seen_at && u.last_seen_at > TWO_MIN_AGO) ||
      (statusFilter === "offline" && (!u.is_online || !u.last_seen_at || u.last_seen_at <= TWO_MIN_AGO));
    const matchesGender = genderFilter === "all" || (u.gender || "").toLowerCase() === genderFilter;
    const matchesAgeFilter = matchesAge(u.birth_year, ageFilter);
    return matchesSearch && matchesRole && matchesStatus && matchesGender && matchesAgeFilter;
  }), [users, search, roleFilter, statusFilter, genderFilter, ageFilter, TWO_MIN_AGO]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const handleSearch = (val: string) => { setSearch(val); setCurrentPage(1); };
  const handleRoleFilter = (val: RoleFilter) => { setRoleFilter(val); setCurrentPage(1); };
  const handleStatusFilter = (val: StatusFilter) => { setStatusFilter(val); setCurrentPage(1); };

  const exportCSV = () => {
    const headers = ["ID", "Nom", "Email", "Téléphone", "Nationalité", "Rôles", "Statut", "Inscrit le"];
    const rows = filtered.map(u => [
      `#${u.display_id || ""}`,
      `${u.first_name || ""} ${u.last_name || ""}`.trim(),
      u.email || "",
      u.phone || "",
      u.nationality || "",
      u.roles.length > 0 ? u.roles.map(r => roleLabels[r]).join(", ") : "Client",
      u.is_banned ? "Banni" : "Actif",
      format(new Date(u.created_at), "yyyy-MM-dd"),
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

  // Counts
  const bannedCount = users.filter(u => u.is_banned).length;
  const activeCount = users.filter(u => !u.is_banned).length;

  // Registration histogram data
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
      const count = users.filter(u => {
        const c = new Date(u.created_at);
        return c >= d && c < nextD;
      }).length;
      return { label: format(d, formatStr, { locale: fr }), count };
    });
  }, [users, chartPeriod]);

  const isUserOnline = (u: any) => u.is_online && u.last_seen_at && u.last_seen_at > TWO_MIN_AGO;

  return (
    <AdminLayout title="Gestion des utilisateurs">
      {/* Location filters */}
      <div className="mb-4">
        <LocationHierarchyFilter value={locationFilters} onChange={setLocationFilters} levels={["country", "city"]} />
      </div>
      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-primary" />
            <span className="text-xs text-muted-foreground">Total</span>
          </div>
          <p className="text-xl font-bold text-foreground mt-1">{profiles.length}</p>
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
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="flex items-center gap-2">
            <Ban size={16} className="text-destructive" />
            <span className="text-xs text-muted-foreground">Bannis</span>
          </div>
          <p className="text-xl font-bold text-foreground mt-1">{bannedCount}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-primary" />
            <span className="text-xs text-muted-foreground">Staff</span>
          </div>
          <p className="text-xl font-bold text-foreground mt-1">
            {users.filter(u => u.roles.includes("admin") || u.roles.includes("manager")).length}
          </p>
        </div>
      </div>

      {/* Registration histogram */}
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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
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
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-2 text-xs bg-card border border-border rounded-lg hover:bg-muted transition-colors">
            <Download size={14} /> CSV
          </button>
        </div>
      </div>

      {/* Role filter chips */}
      <div className="flex gap-1.5 overflow-x-auto mb-4 pb-1">
        {(["all", ...ALL_ROLES] as RoleFilter[]).map((r) => (
          <button
            key={r}
            onClick={() => handleRoleFilter(r)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border whitespace-nowrap transition-colors ${
              roleFilter === r
                ? "bg-foreground text-background border-foreground"
                : "bg-card text-foreground border-border hover:border-foreground"
            }`}
          >
            {r === "all" ? `Tous (${profiles.length})` : roleLabels[r]}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                 <tr className="text-xs text-muted-foreground border-b border-border bg-muted/30">
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
                    className={`border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors cursor-pointer ${u.is_banned ? "opacity-60" : ""}`}
                    onClick={() => setSelectedUserId(u.id)}
                  >
                     <td className="p-3 text-xs text-muted-foreground font-mono">#{u.display_id || "—"}</td>
                     <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                            {(u.first_name?.[0] || u.email?.[0] || "?").toUpperCase()}
                          </div>
                          {/* Online indicator */}
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
                        {u.is_banned ? (
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
                      {u.last_login_at
                        ? format(new Date(u.last_login_at), "d MMM yyyy HH:mm", { locale: fr })
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

      {/* User detail drawer */}
      {selectedUser && (
        <UserDetailDrawer
          user={selectedUser}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </AdminLayout>
  );
}
