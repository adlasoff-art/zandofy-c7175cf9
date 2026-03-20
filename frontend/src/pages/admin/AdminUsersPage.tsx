import { useState, useMemo } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Search, UserCheck, ShieldCheck, Store, Truck, Bike, Loader2, Download, Ban, Filter, Users } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import { UserDetailDrawer } from "@/components/admin/UserDetailDrawer";
import type { AppRole } from "@/hooks/use-roles";

type RoleFilter = "all" | AppRole;
type StatusFilter = "all" | "active" | "banned";

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

const ITEMS_PER_PAGE = 15;

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();

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

  const filtered = useMemo(() => users.filter((u) => {
    const matchesSearch = !search ||
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" || u.roles.includes(roleFilter);
    const matchesStatus = statusFilter === "all" ||
      (statusFilter === "banned" && u.is_banned) ||
      (statusFilter === "active" && !u.is_banned);
    return matchesSearch && matchesRole && matchesStatus;
  }), [users, search, roleFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  const handleSearch = (val: string) => { setSearch(val); setCurrentPage(1); };
  const handleRoleFilter = (val: RoleFilter) => { setRoleFilter(val); setCurrentPage(1); };
  const handleStatusFilter = (val: StatusFilter) => { setStatusFilter(val); setCurrentPage(1); };

  const exportCSV = () => {
    const headers = ["Nom", "Email", "Rôles", "Statut", "Inscrit le"];
    const rows = filtered.map(u => [
      `${u.first_name || ""} ${u.last_name || ""}`.trim(),
      u.email || "",
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

  return (
    <AdminLayout title="Gestion des utilisateurs">
      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
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
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilter(e.target.value as StatusFilter)}
            className="px-3 py-2 text-xs bg-card border border-border rounded-lg"
          >
            <option value="all">Tous statuts</option>
            <option value="active">Actifs</option>
            <option value="banned">Bannis</option>
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
                  <th className="text-left p-3 font-medium">Utilisateur</th>
                  <th className="text-left p-3 font-medium">Rôle(s)</th>
                  <th className="text-left p-3 font-medium hidden sm:table-cell">Statut</th>
                  <th className="text-left p-3 font-medium hidden md:table-cell">Inscrit le</th>
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
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                          {(u.first_name?.[0] || u.email?.[0] || "?").toUpperCase()}
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
                          u.roles.map((role) => {
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
                      {u.is_banned ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive font-medium">
                          <Ban size={10} /> Banni
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 font-medium">
                          Actif
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground text-xs hidden md:table-cell">
                      {format(new Date(u.created_at), "d MMM yyyy", { locale: fr })}
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
        {!isLoading && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              {filtered.length} utilisateur{filtered.length > 1 ? "s" : ""} · Page {safePage}/{totalPages}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setCurrentPage(Math.max(1, safePage - 1))}
                disabled={safePage <= 1}
                className="px-3 py-1.5 text-xs rounded-lg border border-border bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Précédent
              </button>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
                disabled={safePage >= totalPages}
                className="px-3 py-1.5 text-xs rounded-lg border border-border bg-card hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
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
