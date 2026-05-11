import { AlertTriangle, Clock, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/contexts/I18nContext";

interface DisputeSLABadgeProps {
  slaResponseDueAt?: string | null;
  slaResolutionDueAt?: string | null;
  vendorFirstResponseAt?: string | null;
  escalatedAt?: string | null;
  isOverdue?: boolean | null;
  status: string;
}

/**
 * Affiche un badge SLA contextuel : escalade auto, retard, échéance à venir.
 */
export function DisputeSLABadge({
  slaResponseDueAt,
  slaResolutionDueAt,
  vendorFirstResponseAt,
  escalatedAt,
  isOverdue,
  status,
}: DisputeSLABadgeProps) {
  const { t } = useI18n();
  if (["resolved", "closed", "rejected"].includes(status)) return null;

  if (isOverdue) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
        <AlertTriangle size={10} /> {t("dispute.list.sla.overdue") || "En retard (>7j)"}
      </span>
    );
  }

  if (escalatedAt) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
        <ShieldAlert size={10} /> {t("dispute.list.sla.escalated") || "Escaladé"}
      </span>
    );
  }

  if (!vendorFirstResponseAt && slaResponseDueAt) {
    const due = new Date(slaResponseDueAt);
    const now = new Date();
    const hours = Math.max(0, Math.round((due.getTime() - now.getTime()) / 3600000));
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold",
          hours <= 12
            ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
        )}
      >
        <Clock size={10} /> {t("dispute.list.sla.responseDue", { h: hours }) || `Réponse vendeur sous ${hours}h`}
      </span>
    );
  }

  if (slaResolutionDueAt) {
    const due = new Date(slaResolutionDueAt);
    const now = new Date();
    const days = Math.max(0, Math.round((due.getTime() - now.getTime()) / 86400000));
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
        <Clock size={10} /> {t("dispute.list.sla.resolutionDue", { d: days }) || `Résolution sous ${days}j`}
      </span>
    );
  }

  return null;
}