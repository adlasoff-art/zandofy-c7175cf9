import { Shield, ShieldCheck, ShieldAlert, ShieldX, Clock } from "lucide-react";
import type { KycStatus } from "@/hooks/use-kyc";
import { useI18n } from "@/contexts/I18nContext";

const STATUS_MAP: Record<KycStatus, { labelKey: string; color: string; icon: React.ReactNode }> = {
  not_started: { labelKey: "kyc.status.not_started", color: "bg-muted text-muted-foreground", icon: <Shield size={14} /> },
  pending: { labelKey: "kyc.status.pending", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", icon: <Clock size={14} /> },
  approved: { labelKey: "kyc.status.approved", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300", icon: <ShieldCheck size={14} /> },
  rejected: { labelKey: "kyc.status.rejected", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", icon: <ShieldX size={14} /> },
  resubmission_required: { labelKey: "kyc.status.resubmission_required", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300", icon: <ShieldAlert size={14} /> },
};

export function KycStatusBadge({ status }: { status: KycStatus }) {
  const { t } = useI18n();
  const cfg = STATUS_MAP[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
      {cfg.icon}
      {t(cfg.labelKey)}
    </span>
  );
}
