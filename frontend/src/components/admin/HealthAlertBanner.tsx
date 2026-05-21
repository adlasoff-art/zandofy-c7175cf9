import { AlertTriangle, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useHealthIncidents } from "@/hooks/use-system-health";
import { useState } from "react";

/**
 * Lot 18 — Bandeau persistant en tête d'admin tant qu'un incident critique est ouvert.
 */
export function HealthAlertBanner() {
  const { data: incidents = [] } = useHealthIncidents(false);
  const critical = incidents.filter((i) => i.severity === "critical");
  const [dismissed, setDismissed] = useState<string[]>([]);
  const visible = critical.filter((i) => !dismissed.includes(i.id));
  if (visible.length === 0) return null;
  const top = visible[0];
  return (
    <div className="bg-destructive/15 border-b border-destructive/30 px-4 py-2 flex items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
        <span className="font-medium text-destructive shrink-0">
          {visible.length} incident{visible.length > 1 ? "s critiques" : " critique"} :
        </span>
        <Link
          to="/admin/health"
          className="text-foreground hover:underline truncate"
        >
          {top.title}
        </Link>
      </div>
      <button
        onClick={() => setDismissed([...dismissed, top.id])}
        className="shrink-0 p-1 hover:bg-destructive/20 rounded"
        aria-label="Masquer"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}