import { Shield, ShieldCheck, ShieldAlert, ShieldX, Clock } from "lucide-react";
import type { KycStatus } from "@/hooks/use-kyc";

const STATUS_MAP: Record<KycStatus, { label: string; color: string; icon: React.ReactNode }> = {
  not_started: { label: "Non vérifié", color: "bg-muted text-muted-foreground", icon: <Shield size={14} /> },
  pending: { label: "En attente", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", icon: <Clock size={14} /> },
  approved: { label: "Vérifié", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300", icon: <ShieldCheck size={14} /> },
  rejected: { label: "Refusé", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", icon: <ShieldX size={14} /> },
  resubmission_required: { label: "À resoumettre", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300", icon: <ShieldAlert size={14} /> },
};

export function KycStatusBadge({ status }: { status: KycStatus }) {
  const cfg = STATUS_MAP[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}
