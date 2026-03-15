import { ShieldAlert, ShieldCheck, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KycStatusBadge } from "./KycStatusBadge";
import type { KycStatus } from "@/hooks/use-kyc";

interface Props {
  kycStatus: KycStatus;
  needsKyc: boolean;
  isOrderBlocked: boolean;
  onStartKyc: () => void;
}

export function KycBanner({ kycStatus, needsKyc, isOrderBlocked, onStartKyc }: Props) {
  if (kycStatus === "approved" || !needsKyc) return null;

  return (
    <div className={`rounded-lg border p-4 space-y-3 ${
      isOrderBlocked
        ? "border-destructive/50 bg-destructive/5"
        : kycStatus === "pending"
          ? "border-amber-300 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-700"
          : "border-primary/30 bg-primary/5"
    }`}>
      <div className="flex items-start gap-3">
        {isOrderBlocked ? (
          <ShieldAlert size={20} className="text-destructive mt-0.5 shrink-0" />
        ) : kycStatus === "pending" ? (
          <Clock size={20} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        ) : (
          <ShieldAlert size={20} className="text-primary mt-0.5 shrink-0" />
        )}
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium text-foreground">
            {isOrderBlocked
              ? "Vérification requise pour continuer"
              : kycStatus === "pending"
                ? "Vérification en cours d'examen"
                : kycStatus === "rejected" || kycStatus === "resubmission_required"
                  ? "Vérification à resoumettre"
                  : "Complétez votre vérification d'identité"}
          </p>
          <p className="text-xs text-muted-foreground">
            {isOrderBlocked
              ? "Vous avez atteint la limite de commandes. Complétez votre vérification d'identité pour continuer à commander."
              : kycStatus === "pending"
                ? "Votre demande est en cours d'examen. Vous recevrez une notification sous 24-48h."
                : kycStatus === "rejected" || kycStatus === "resubmission_required"
                  ? "Votre précédente soumission n'a pas été acceptée. Veuillez corriger et resoumettre."
                  : "Débloquez les options de paiement avancées et la livraison à domicile."}
          </p>
        </div>
        <KycStatusBadge status={kycStatus} />
      </div>

      {kycStatus !== "pending" && (
        <Button size="sm" className="w-full sm:w-auto" onClick={onStartKyc}>
          {kycStatus === "rejected" || kycStatus === "resubmission_required" ? "Resoumettre" : "Commencer la vérification"}
          <ArrowRight size={14} className="ml-1" />
        </Button>
      )}
    </div>
  );
}
