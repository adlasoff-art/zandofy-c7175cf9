import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<Method>("wallet");
  const [busy, setBusy] = useState(false);

  const call = async (action: Action, payload?: { amount?: number; method?: Method }) => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("apply-dispute-refund", {
      body: { dispute_id: disputeId, action, ...payload },
    });
    setBusy(false);
    if (error || (data as any)?.error) {
      toast.error(((data as any)?.error as string) || error?.message || "Erreur");
      return;
    }
    toast.success("OK");
    onChanged?.();
  };

  // Already refunded → read-only summary
  if (finalRefundAmount && finalRefundAmount > 0) {
    return (
      <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900 rounded-lg p-3 text-xs">
        <div className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-400">
          <Check size={14} /> Remboursement appliqué
        </div>
        <p className="text-muted-foreground mt-1">
          {finalRefundAmount} via{" "}
          {finalRefundMethod === "wallet" ? "portefeuille" :
           finalRefundMethod === "cash" ? "espèces" : "moyen original"}
        </p>
      </div>
    );
  }

  // Pending proposal → client sees accept/reject, vendor sees waiting
  if (proposedStatus === "pending" && proposedAmount && proposedMethod) {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900 rounded-lg p-3 space-y-2">
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
          Proposition en attente : {proposedAmount} ({proposedMethod})
        </p>
        {viewerRole === "client" ? (
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => call("accept")}>
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} className="mr-1" />} Accepter
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => call("reject")}>
              <X size={12} className="mr-1" /> Refuser
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">En attente de la réponse du client.</p>
        )}
      </div>
    );
  }

  // Vendor or admin can create a proposal / apply
  if (viewerRole === "client") {
    return (
      <p className="text-xs text-muted-foreground italic">
        Aucune proposition de remboursement pour le moment.
      </p>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-3 space-y-3">
      <h4 className="text-sm font-bold text-foreground">
        {viewerRole === "admin" ? "Appliquer un remboursement" : "Proposer un remboursement"}
      </h4>

      <div>
        <label className="text-[11px] text-muted-foreground">Montant (≤ {orderTotal})</label>
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
        <label className="text-[11px] text-muted-foreground">Méthode</label>
        <div className="grid grid-cols-3 gap-1 mt-1">
          {([
            { v: "wallet" as Method, label: "Portefeuille", icon: Wallet },
            { v: "cash" as Method, label: "Espèces", icon: Banknote },
            { v: "original_method" as Method, label: "Origine", icon: CreditCard },
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
            Appliquer
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={busy || !amount}
            onClick={() => call("propose", { amount: Number(amount), method })}
            className="w-full"
          >
            {busy ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
            Proposer au client
          </Button>
        )}
      </div>
    </div>
  );
}