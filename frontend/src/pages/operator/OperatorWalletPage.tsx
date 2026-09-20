/**
 * OperatorWalletPage — Delivery operator wallet + withdrawal requests.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Wallet, ArrowDownToLine } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOperatorContext } from "@/hooks/use-operator-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function OperatorWalletPage() {
  const { operator } = useOperatorContext();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("mobile_money");
  const [payoutRef, setPayoutRef] = useState("");

  const { data: wallet, isLoading } = useQuery({
    queryKey: ["operator-wallet", operator?.id],
    enabled: !!operator?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("operator_wallets")
        .select("*")
        .eq("operator_id", operator!.id)
        .maybeSingle();
      if (error) throw error;
      return data as {
        available_balance: number;
        pending_balance: number;
        total_earned: number;
        total_withdrawn: number;
        min_withdrawal: number;
        currency: string;
      } | null;
    },
  });

  const { data: requests = [] } = useQuery({
    queryKey: ["operator-withdrawals", operator?.id],
    enabled: !!operator?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("operator_withdrawal_requests")
        .select("*")
        .eq("operator_id", operator!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: ledger = [] } = useQuery({
    queryKey: ["operator-wallet-tx", operator?.id],
    enabled: !!operator?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("operator_wallet_transactions")
        .select("id, type, amount, description, created_at, order_id")
        .eq("operator_id", operator!.id)
        .order("created_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      if (!operator?.id || !wallet) throw new Error("Portefeuille indisponible");
      const amt = parseFloat(amount);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Montant invalide");
      if (amt < Number(wallet.min_withdrawal)) {
        throw new Error(`Minimum ${wallet.min_withdrawal} ${wallet.currency}`);
      }
      if (amt > Number(wallet.available_balance)) {
        throw new Error("Solde disponible insuffisant");
      }
      const { data, error } = await (supabase as any).rpc("request_operator_withdrawal", {
        p_operator_id: operator.id,
        p_amount: amt,
        p_method: method,
        p_payout_details: { reference: payoutRef.trim() || null },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Demande de retrait envoyée");
      setAmount("");
      setPayoutRef("");
      qc.invalidateQueries({ queryKey: ["operator-withdrawals", operator?.id] });
      qc.invalidateQueries({ queryKey: ["operator-wallet", operator?.id] });
      qc.invalidateQueries({ queryKey: ["operator-wallet-tx", operator?.id] });
    },
    onError: (e: any) => {
      const msg = String(e?.message || "");
      if (msg.includes("OPERATOR_WITHDRAWAL_INSUFFICIENT") || msg.includes("insufficient")) {
        toast.error("Solde insuffisant");
      } else if (msg.includes("OPERATOR_WITHDRAWAL_BELOW_MIN") || msg.includes("below")) {
        toast.error("Montant sous le minimum");
      } else if (msg.includes("OPERATOR_WALLET_MISSING")) {
        toast.error("Portefeuille non créé — contactez le support");
      } else {
        toast.error(e.message || "Échec");
      }
    },
  });

  if (!operator) return null;

  return (
    <div className="space-y-4 max-w-2xl">
      <header className="flex items-center gap-3">
        <Wallet size={20} className="text-[hsl(var(--operator-primary))]" />
        <div>
          <h1 className="text-xl font-bold">Portefeuille</h1>
          <p className="text-xs text-muted-foreground">
            Commissions nettes et demandes de retrait (opérateur de livraison).
          </p>
        </div>
      </header>

      {isLoading ? (
        <Loader2 className="animate-spin mx-auto" />
      ) : !wallet ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Portefeuille non encore créé. Il est activé lorsque votre compte opérateur est approuvé.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground">Disponible</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {Number(wallet.available_balance ?? 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}{" "}
                <span className="text-sm font-normal">{wallet.currency || "USD"}</span>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground">En attente</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {Number(wallet.pending_balance ?? 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {wallet && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ArrowDownToLine size={14} /> Demander un retrait
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Montant</Label>
                <Input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Méthode</Label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  <option value="mobile_money">Mobile Money</option>
                  <option value="bank">Virement bancaire</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Référence paiement (n° MM / IBAN)</Label>
              <Input value={payoutRef} onChange={(e) => setPayoutRef(e.target.value)} />
            </div>
            <Button size="sm" disabled={withdrawMutation.isPending} onClick={() => withdrawMutation.mutate()}>
              {withdrawMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : "Soumettre"}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Mouvements</h2>
        {ledger.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Aucun mouvement. Les crédits apparaîtront lorsque les commissions seront versées au portefeuille.
          </p>
        ) : (
          ledger.map((t) => (
            <div key={t.id} className="flex justify-between text-sm border border-border rounded-md px-3 py-2">
              <span className="truncate">
                <span className="uppercase text-[10px] text-muted-foreground mr-2">{t.type}</span>
                {t.description || "—"}
              </span>
              <span className="font-medium shrink-0">
                {t.type === "credit" ? "+" : "−"}
                {Number(t.amount).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Demandes de retrait</h2>
        {requests.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucune demande.</p>
        ) : (
          requests.map((r) => (
            <div key={r.id} className="flex justify-between text-sm border border-border rounded-md px-3 py-2">
              <span>
                {Number(r.amount).toLocaleString("fr-FR")} · {r.method}
              </span>
              <span className="text-xs uppercase text-muted-foreground">{r.status}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
