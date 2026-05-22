import { Activity, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { useGlobalHealthStatus } from "@/hooks/use-system-health";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Lot 18 — Widget compact sur AdminDashboard
 * Affiche un feu vert/orange/rouge global + 3 KPIs.
 */
export function SystemHealthWidget() {
  const { status, downCount, warnCount, okCount, openIncidentsCount, isLoading } =
    useGlobalHealthStatus();

  const statusConfig =
    {
      ok: {
        icon: CheckCircle2,
        label: "Tout fonctionne",
        color: "text-green-500",
        bg: "bg-green-500/10 border-green-500/30",
      },
      warn: {
        icon: AlertTriangle,
        label: "Dégradé",
        color: "text-amber-500",
        bg: "bg-amber-500/10 border-amber-500/30",
      },
      down: {
        icon: XCircle,
        label: "Incident en cours",
        color: "text-destructive",
        bg: "bg-destructive/10 border-destructive/30",
      },
    }[status] ?? {
      icon: Activity,
      label: "Chargement…",
      color: "text-muted-foreground",
      bg: "bg-muted/30 border-border",
    };

  const Icon = statusConfig.icon;

  return (
    <Link to="/admin/health" className="block">
      <Card className={`p-4 border ${statusConfig.bg} hover:opacity-90 transition`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Icon className={`h-8 w-8 shrink-0 ${statusConfig.color}`} />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground truncate">
                  Santé système
                </span>
                <Activity className="h-3 w-3 text-muted-foreground" />
              </div>
              <p className={`text-sm ${statusConfig.color}`}>
                {isLoading ? "Vérification…" : statusConfig.label}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {okCount > 0 && (
              <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
                {okCount} OK
              </Badge>
            )}
            {warnCount > 0 && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30">
                {warnCount} warn
              </Badge>
            )}
            {downCount > 0 && (
              <Badge variant="destructive">{downCount} down</Badge>
            )}
            {openIncidentsCount > 0 && (
              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                {openIncidentsCount} incident{openIncidentsCount > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}