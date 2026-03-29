import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Wallet, ArrowDownCircle, ArrowUpCircle, Clock, Loader2, Banknote, AlertCircle, Download } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Props {
  storeId: string;
}

const METHOD_LABELS: Record<string, string> = {
  mobile_money: "Mobile Money",
  bank_transfer: "Virement bancaire",
  visa: "Carte Visa",
};

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  pending: { label: "En attente", class: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  approved: { label: "Approuvé", class: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  rejected: { label: "Refusé", class: "bg-destructive/10 text-destructive" },
  paid: { label: "Payé", class: "bg-primary/10 text-primary" },
};

export function VendorWalletTab({ storeId }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMethod, setWithdrawMethod] = useState("mobile_money");

  // Release pending funds on load
  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ["vendor-wallet", storeId],
    queryFn: async () => {
      // First release any pending funds past retention
      await (supabase as any).rpc("release_pending_wallet_funds", { p_store_id: storeId });
      // Then fetch wallet
      const { data } = await supabase
        .from("vendor_wallets")
        .select("*")
        .eq("store_id", storeId)
        .maybeSingle();
      return data;
    },
  });

  // Fetch transactions
  const { data: transactions = [] } = useQuery({
    queryKey: ["vendor-transactions", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("vendor_transactions")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  // Fetch withdrawal requests
  const { data: withdrawals = [] } = useQuery({
    queryKey: ["vendor-withdrawals", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("withdrawal_requests")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(withdrawAmount);
      if (!amount || amount <= 0) throw new Error("Montant invalide");
      if (!wallet) throw new Error("Portefeuille introuvable");
      if (amount > Number(wallet.available_balance)) throw new Error("Solde insuffisant");
      if (amount < Number(wallet.min_withdrawal)) throw new Error(`Minimum de retrait : $${wallet.min_withdrawal}`);

      const { error } = await supabase.from("withdrawal_requests").insert({
        store_id: storeId,
        amount,
        method: withdrawMethod,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-withdrawals", storeId] });
      toast.success("Demande de retrait soumise");
      setWithdrawOpen(false);
      setWithdrawAmount("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (walletLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  if (!wallet) {
    return (
      <div className="text-center py-12 space-y-2">
        <Wallet size={40} className="mx-auto text-muted-foreground/20" />
        <p className="text-sm font-medium text-foreground">Portefeuille non activé</p>
        <p className="text-xs text-muted-foreground">Votre portefeuille sera créé automatiquement après votre première commande livrée.</p>
      </div>
    );
  }

  const availableBalance = Number(wallet.available_balance);
  const pendingBalance = Number(wallet.pending_balance);
  const totalEarned = Number(wallet.total_earned);
  const canWithdraw = availableBalance >= Number(wallet.min_withdrawal);
  const hasPendingWithdrawal = withdrawals.some((w: any) => w.status === "pending");

  return (
    <div className="space-y-6">
      {/* Balance cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Wallet size={16} className="text-emerald-500" />
            <span className="text-xs text-muted-foreground">Disponible</span>
          </div>
          <p className="text-xl font-bold text-foreground">${availableBalance.toFixed(2)}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={16} className="text-amber-500" />
            <span className="text-xs text-muted-foreground">En attente</span>
          </div>
          <p className="text-xl font-bold text-foreground">${pendingBalance.toFixed(2)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Rétention : {wallet.retention_days}j</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <ArrowDownCircle size={16} className="text-primary" />
            <span className="text-xs text-muted-foreground">Total gagné</span>
          </div>
          <p className="text-xl font-bold text-foreground">${totalEarned.toFixed(2)}</p>
        </div>
      </div>

      {/* Withdraw button */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogTrigger asChild>
          <Button
            disabled={!canWithdraw || hasPendingWithdrawal}
            className="w-full"
          >
            <Banknote size={16} className="mr-2" />
            {hasPendingWithdrawal
              ? "Retrait en cours de traitement"
              : !canWithdraw
              ? `Minimum de retrait : $${wallet.min_withdrawal}`
              : "Demander un retrait"}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Demander un retrait</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Montant ($)</label>
              <Input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder={`Min. $${wallet.min_withdrawal}`}
                max={availableBalance}
                min={Number(wallet.min_withdrawal)}
                step="0.01"
              />
              <p className="text-xs text-muted-foreground mt-1">Solde disponible : ${availableBalance.toFixed(2)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Méthode</label>
              <select
                value={withdrawMethod}
                onChange={(e) => setWithdrawMethod(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md"
              >
                <option value="mobile_money">Mobile Money</option>
                <option value="bank_transfer">Virement bancaire</option>
                <option value="visa">Carte Visa</option>
              </select>
            </div>
            <Button
              onClick={() => withdrawMutation.mutate()}
              disabled={withdrawMutation.isPending}
              className="w-full"
            >
              {withdrawMutation.isPending ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
              Confirmer le retrait
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pending withdrawals */}
      {withdrawals.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-foreground">Demandes de retrait</h3>
          {withdrawals.map((w: any) => {
            const st = STATUS_LABELS[w.status] || STATUS_LABELS.pending;
            return (
              <div key={w.id} className="bg-card border border-border rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">${Number(w.amount).toFixed(2)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {METHOD_LABELS[w.method] || w.method} · {new Date(w.created_at).toLocaleDateString("fr-FR")}
                  </p>
                  {w.admin_notes && (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <AlertCircle size={10} /> {w.admin_notes}
                    </p>
                  )}
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${st.class}`}>
                  {st.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Transaction history */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">Historique des transactions</h3>
          {transactions.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => {
              const header = "Date,Type,Montant,Description\n";
              const rows = transactions.map((tx: any) => {
                const date = format(new Date(tx.created_at), "yyyy-MM-dd HH:mm");
                const desc = (tx.description || "").replace(/"/g, '""');
                return `"${date}","${tx.type}","${Number(tx.amount).toFixed(2)}","${desc}"`;
              }).join("\n");
              const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `vendor-transactions-${format(new Date(), "yyyy-MM-dd")}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}>
              <Download size={14} className="mr-1" /> CSV
            </Button>
          )}
        </div>
        {transactions.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Aucune transaction</p>
        ) : (
          transactions.map((tx: any) => (
            <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div className="flex items-center gap-2">
                {tx.type === "credit" || tx.type === "release" ? (
                  <ArrowDownCircle size={14} className="text-emerald-500" />
                ) : (
                  <ArrowUpCircle size={14} className="text-destructive" />
                )}
                <div>
                  <p className="text-xs font-medium text-foreground">{tx.description || tx.type}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(tx.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                </div>
              </div>
              <span className={`text-sm font-bold ${tx.type === "debit" ? "text-destructive" : "text-emerald-600"}`}>
                {tx.type === "debit" ? "-" : "+"}${Math.abs(Number(tx.amount)).toFixed(2)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
