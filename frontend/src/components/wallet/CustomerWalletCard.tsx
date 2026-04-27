import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Wallet, ArrowDownCircle, ArrowUpCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

/**
 * Carte affichant le solde du portefeuille client + 5 dernières transactions.
 * Crédit alimenté principalement par les remboursements de litiges (Lot 13).
 */
export function CustomerWalletCard() {
  const { user } = useAuth();

  const { data: wallet, isLoading } = useQuery({
    queryKey: ["customer-wallet", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("customer_wallets")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: tx = [] } = useQuery({
    queryKey: ["customer-wallet-tx", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("customer_wallet_transactions")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  if (isLoading) {
    return <div className="flex justify-center py-6"><Loader2 className="animate-spin text-primary" size={18} /></div>;
  }

  const balance = wallet?.balance ?? 0;
  const currency = wallet?.currency ?? "USD";

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Wallet size={12} /> Portefeuille de crédit
        </div>
        <div className="mt-2 text-2xl font-bold text-foreground">
          {Number(balance).toFixed(2)} <span className="text-sm font-normal text-muted-foreground">{currency}</span>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          Utilisable à votre prochaine commande.
        </p>
      </div>
      <div className="p-3">
        <h4 className="text-xs font-semibold text-foreground mb-2">Dernières opérations</h4>
        {tx.length === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center py-2">Aucune opération.</p>
        ) : (
          <ul className="space-y-1.5">
            {tx.map(t => {
              const isCredit = Number(t.amount) > 0;
              return (
                <li key={t.id} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2">
                    {isCredit
                      ? <ArrowDownCircle size={12} className="text-emerald-600" />
                      : <ArrowUpCircle size={12} className="text-orange-600" />}
                    <span className="text-foreground">{t.description || t.type}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={isCredit ? "text-emerald-600 font-medium" : "text-orange-600 font-medium"}>
                      {isCredit ? "+" : ""}{Number(t.amount).toFixed(2)}
                    </span>
                    <span className="text-muted-foreground">
                      {format(new Date(t.created_at), "dd MMM", { locale: fr })}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}