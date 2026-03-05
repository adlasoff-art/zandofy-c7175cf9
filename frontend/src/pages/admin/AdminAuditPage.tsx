import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Shield, Ban, UserPlus, UserMinus, AlertTriangle, KeyRound, Loader2, Filter } from "lucide-react";

const ACTION_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  ban: { label: "Bannissement", icon: Ban, color: "text-destructive" },
  unban: { label: "Débannissement", icon: Shield, color: "text-emerald-600" },
  add_role: { label: "Rôle ajouté", icon: UserPlus, color: "text-primary" },
  remove_role: { label: "Rôle retiré", icon: UserMinus, color: "text-amber-600" },
  warning: { label: "Avertissement", icon: AlertTriangle, color: "text-amber-500" },
  reset_password: { label: "Réinit. mot de passe", icon: KeyRound, color: "text-blue-500" },
};

type ActionFilter = "all" | string;

export default function AdminAuditPage() {
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["admin-audit-logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

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

  const filtered = actionFilter === "all" ? logs : logs.filter((l) => l.action === actionFilter);

  const getName = (id: string) => (profilesMap as any)[id]?.name || id.slice(0, 8);

  return (
    <AdminLayout title="Journal d'audit">
      {/* Filter chips */}
      <div className="flex gap-1.5 overflow-x-auto mb-4 pb-1">
        <button
          onClick={() => setActionFilter("all")}
          className={`px-3 py-1.5 text-xs font-medium rounded-full border whitespace-nowrap transition-colors ${
            actionFilter === "all"
              ? "bg-foreground text-background border-foreground"
              : "bg-card text-foreground border-border hover:border-foreground"
          }`}
        >
          Tout ({logs.length})
        </button>
        {Object.entries(ACTION_CONFIG).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setActionFilter(key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border whitespace-nowrap transition-colors ${
              actionFilter === key
                ? "bg-foreground text-background border-foreground"
                : "bg-card text-foreground border-border hover:border-foreground"
            }`}
          >
            {cfg.label}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-primary" size={24} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">Aucune action enregistrée.</div>
        ) : (
          <div className="divide-y divide-border/50">
            {filtered.map((log) => {
              const cfg = ACTION_CONFIG[log.action] || { label: log.action, icon: Shield, color: "text-muted-foreground" };
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
    </AdminLayout>
  );
}
