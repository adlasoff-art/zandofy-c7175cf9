import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/contexts/I18nContext";
import { Loader2, Wallet, Banknote, CreditCard, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Method = "wallet" | "cash" | "original_method";
type Action = "apply" | "propose" | "accept" | "reject";

interface DisputeRefundPanelProps {
  disputeId: string;
  orderTotal: number;
  viewerRole: "client" | "vendor" | "admin";
  proposedAmount?: number | null;
  proposedMethod?: string | null;
  proposedStatus?: string | null;
  finalRefundAmount?: number | null;
  finalRefundMethod?: string | null;
  onChanged?: () => void;
}

const PRESETS = [25, 50, 75, 100];

export function DisputeRefundPanel({
  disputeId,
  orderTotal,
  viewerRole,
  proposedAmount,
  proposedMethod,
  proposedStatus,
  finalRefundAmount,
  finalRefundMethod,
  onChanged,
}: DisputeRefundPanelProps) {
  const { t, formatPrice } = useI18n();
  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<Method>("wallet");
  const [busy, setBusy] = useState(false);

  const methodLong = (m?: string | null) => {
    if (m === "wallet") return t("dispute.refund.method.wallet") || "portefeuille";
    if (m === "cash") return t("dispute.refund.method.cash") || "espèces";
    return t("dispute.refund.method.original") || "moyen original";
  };

  const call = async (action: Action, payload?: { amount?: number; method?: Method }) => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("apply-dispute-refund", {
      body: { dispute_id: disputeId, action, ...payload },
    });
    setBusy(false);
    if (error || (data as any)?.error) {
      toast.error(((data as any)?.error as string) || error?.message || t("dispute.refund.error") || "Erreur");
      return;
    }
    toast.success(t("dispute.refund.ok") || "OK");
    onChanged?.();
  };

  // Already refunded → read-only summary
  if (finalRefundAmount && finalRefundAmount > 0) {
    return (
      <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900 rounded-lg p-3 text-xs">
        <div className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-400">
          <Check size={14} /> {t("dispute.refund.applied") || "Remboursement appliqué"}
        </div>
        <p className="text-muted-foreground mt-1">
          {t("dispute.refund.appliedVia", { amount: formatPrice(Number(finalRefundAmount)), method: methodLong(finalRefundMethod) })
            || `${formatPrice(Number(finalRefundAmount))} via ${methodLong(finalRefundMethod)}`}
        </p>
      </div>
    );
  }

  // Pending proposal → client sees accept/reject, vendor sees waiting
  if (proposedStatus === "pending" && proposedAmount && proposedMethod) {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900 rounded-lg p-3 space-y-2">
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
          {t("dispute.refund.proposalPending", { amount: formatPrice(Number(proposedAmount)), method: methodLong(proposedMethod) })
            || `Proposition en attente : ${formatPrice(Number(proposedAmount))} (${methodLong(proposedMethod)})`}
        </p>
        {viewerRole === "client" ? (
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => call("accept")}>
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} className="mr-1" />} {t("dispute.refund.accept") || "Accepter"}
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => call("reject")}>
              <X size={12} className="mr-1" /> {t("dispute.refund.reject") || "Refuser"}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">{t("dispute.refund.waitingClient") || "En attente de la réponse du client."}</p>
        )}
      </div>
    );
  }

  // Vendor or admin can create a proposal / apply
  if (viewerRole === "client") {
    return (
      <p className="text-xs text-muted-foreground italic">
        {t("dispute.refund.none") || "Aucune proposition de remboursement pour le moment."}
      </p>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-3 space-y-3">
      <h4 className="text-sm font-bold text-foreground">
        {viewerRole === "admin"
          ? (t("dispute.refund.title.admin") || "Appliquer un remboursement")
          : (t("dispute.refund.title.vendor") || "Proposer un remboursement")}
      </h4>

      <div>
        <label className="text-[11px] text-muted-foreground">{t("dispute.refund.amountLabel", { max: formatPrice(orderTotal) }) || `Montant (≤ ${formatPrice(orderTotal)})`}</label>
        <div className="flex gap-2 mt-1">
          <input
            type="number"
            min={0}
            max={orderTotal}
            step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className="flex-1 px-3 py-1.5 text-sm border border-border rounded-lg bg-background"
            placeholder="0.00"
          />
        </div>
        <div className="flex gap-1 mt-2">
          {PRESETS.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => setAmount(((orderTotal * p) / 100).toFixed(2))}
              className="px-2 py-1 text-[10px] rounded border border-border hover:bg-muted"
            >
              {p}%
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-[11px] text-muted-foreground">{t("dispute.refund.methodLabel") || "Méthode"}</label>
        <div className="grid grid-cols-3 gap-1 mt-1">
          {([
            { v: "wallet" as Method, label: t("dispute.refund.method.walletShort") || "Portefeuille", icon: Wallet },
            { v: "cash" as Method, label: t("dispute.refund.method.cashShort") || "Espèces", icon: Banknote },
            { v: "original_method" as Method, label: t("dispute.refund.method.originalShort") || "Origine", icon: CreditCard },
          ]).map(({ v, label, icon: Icon }) => (
            <button
              key={v}
              type="button"
              onClick={() => setMethod(v)}
              className={`flex flex-col items-center gap-1 px-2 py-2 rounded border text-[10px] transition ${
                method === v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        {viewerRole === "admin" ? (
          <Button
            size="sm"
            disabled={busy || !amount}
            onClick={() => call("apply", { amount: Number(amount), method })}
            className="w-full"
          >
            {busy ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
            {t("dispute.refund.applyBtn") || "Appliquer"}
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={busy || !amount}
            onClick={() => call("propose", { amount: Number(amount), method })}
            className="w-full"
          >
            {busy ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
            {t("dispute.refund.proposeBtn") || "Proposer au client"}
          </Button>
        )}
      </div>
    </div>
  );
}