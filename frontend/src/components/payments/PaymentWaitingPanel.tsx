import { useEffect, useRef, useState } from "react";
import { Loader2, ShieldCheck, X, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaymentWaitingPanelProps {
  /** Durée totale d'attente en secondes (par défaut 180 = 3 min). */
  durationSeconds?: number;
  /** Texte décrivant l'opérateur (ex. "Orange Money"). */
  providerLabel?: string;
  /** Référence à afficher (optionnel). */
  reference?: string | null;
  /** Indique si une vérification manuelle est en cours. */
  checking?: boolean;
  /** Callback quand l'utilisateur clique sur "Vérifier maintenant". */
  onCheck: () => void;
  /** Callback quand l'utilisateur clique sur "Annuler l'attente". */
  onCancel: () => void;
  /** Callback déclenché quand le compte à rebours atteint zéro. */
  onExpire?: () => void;
  /** Auto-abandon si pas d'action après expiration (défaut 60s). */
  onAutoAbandon?: () => void;
  autoAbandonAfterExpireSeconds?: number;
}

/**
 * Panneau visuel pendant l'attente d'un paiement Mobile Money.
 */
export function PaymentWaitingPanel({
  durationSeconds = 180,
  providerLabel,
  reference,
  checking = false,
  onCheck,
  onCancel,
  onExpire,
  onAutoAbandon,
  autoAbandonAfterExpireSeconds = 60,
}: PaymentWaitingPanelProps) {
  const [remaining, setRemaining] = useState(durationSeconds);
  const [graceRemaining, setGraceRemaining] = useState<number | null>(null);
  const expireFiredRef = useRef(false);
  const abandonFiredRef = useRef(false);

  useEffect(() => {
    if (remaining <= 0) {
      if (!expireFiredRef.current) {
        expireFiredRef.current = true;
        onExpire?.();
        setGraceRemaining(autoAbandonAfterExpireSeconds);
      }
      return;
    }
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  useEffect(() => {
    if (graceRemaining === null) return;
    if (graceRemaining <= 0) {
      if (!abandonFiredRef.current) {
        abandonFiredRef.current = true;
        onAutoAbandon?.();
      }
      return;
    }
    const id = setInterval(
      () => setGraceRemaining((g) => (g === null ? null : Math.max(0, g - 1))),
      1000
    );
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graceRemaining]);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const pct = Math.max(0, Math.min(100, (remaining / durationSeconds) * 100));

  const isUrgent = remaining > 0 && remaining <= 60;
  const isExpired = remaining === 0;

  return (
    <div className="space-y-4 pt-2 border-t border-border">
      {/* Header status */}
      <div className="flex flex-col items-center gap-3 py-3 text-center">
        {isExpired ? (
          <AlertTriangle size={32} className="text-destructive" />
        ) : (
          <Loader2 size={32} className="animate-spin text-primary" />
        )}
        <p className="text-sm font-semibold text-foreground">
          {isExpired
            ? "Délai écoulé — vérifiez l'état de votre paiement"
            : "En attente de validation sur votre téléphone"}
        </p>
        {!isExpired && (
          <p className="text-xs text-muted-foreground max-w-xs">
            Ouvrez l'application{providerLabel ? ` ${providerLabel}` : " Mobile Money"} et validez le paiement avec votre code PIN.
          </p>
        )}
      </div>

      {/* Countdown */}
      {!isExpired && (
        <div
          className={`rounded-lg border p-3 ${
            isUrgent
              ? "border-destructive/40 bg-destructive/10"
              : "border-border bg-muted/40"
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className={`flex items-center gap-2 text-xs font-medium ${isUrgent ? "text-destructive" : "text-foreground"}`}>
              <Clock size={14} />
              <span>{isUrgent ? "Cette transaction va bientôt expirer" : "Temps restant pour confirmer"}</span>
            </div>
            <span className={`font-mono font-bold text-sm ${isUrgent ? "text-destructive" : "text-foreground"}`}>
              {pad(minutes)}:{pad(seconds)}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-background overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ${isUrgent ? "bg-destructive" : "bg-primary"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {isUrgent && (
            <p className="text-[11px] text-destructive mt-2">
              Si vous avez déjà saisi votre PIN, cliquez sur « Vérifier » pour confirmer la commande.
            </p>
          )}
        </div>
      )}

      {/* Reference */}
      {reference && (
        <p className="text-[11px] text-muted-foreground text-center">
          Référence transaction : <span className="font-mono text-foreground">{reference}</span>
        </p>
      )}

      {/* Primary CTA — pulses when urgent or expired */}
      <Button
        onClick={onCheck}
        disabled={checking}
        className={`w-full ${isUrgent || isExpired ? "animate-pulse" : ""}`}
        size="lg"
      >
        {checking ? (
          <Loader2 size={16} className="mr-2 animate-spin" />
        ) : (
          <ShieldCheck size={16} className="mr-2" />
        )}
        {checking
          ? "Vérification en cours..."
          : isExpired
          ? "Vérifier l'état de la commande"
          : "Vérifier maintenant le paiement"}
      </Button>

      <p className="text-[11px] text-muted-foreground text-center">
        Vous avez payé mais cette page n'a pas réagi ? Cliquez sur « Vérifier » pour finaliser votre commande.
      </p>

      <Button variant="outline" onClick={onCancel} className="w-full">
        <X size={14} className="mr-2" /> Annuler l'attente
      </Button>
    </div>
  );
}
