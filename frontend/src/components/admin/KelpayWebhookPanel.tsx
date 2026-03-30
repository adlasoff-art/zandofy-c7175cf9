import { useState, useEffect } from "react";
import { Webhook, ExternalLink, CheckCircle2, Clock, XCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CopyableField } from "@/components/ui/CopyableField";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface CallbackEntry {
  id: string;
  reference: string;
  status: string;
  amount: number;
  currency: string;
  created_at: string;
  updated_at: string;
  callback_payload: any;
}

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || "uogkklwfvwoxkifpkzpu";

const WEBHOOK_URLS = {
  staging: `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/kelpay-webhook`,
  production: `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/kelpay-webhook`,
};

export function KelpayWebhookPanel() {
  const [callbacks, setCallbacks] = useState<CallbackEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastReceived, setLastReceived] = useState<string | null>(null);

  const fetchCallbacks = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("payment_transactions")
      .select("id, reference, status, amount, currency, created_at, updated_at, callback_payload")
      .not("callback_payload", "is", null)
      .order("updated_at", { ascending: false })
      .limit(10);

    if (!error && data) {
      setCallbacks(data as CallbackEntry[]);
      if (data.length > 0) {
        setLastReceived(data[0].updated_at);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCallbacks();
  }, []);

  const statusIcon = (status: string) => {
    if (status === "success") return <CheckCircle2 size={14} className="text-green-500" />;
    if (status === "failed") return <XCircle size={14} className="text-destructive" />;
    return <Clock size={14} className="text-yellow-500" />;
  };

  const statusLabel = (status: string) => {
    if (status === "success") return "Succès";
    if (status === "failed") return "Échoué";
    return "En attente";
  };

  const isConnected = lastReceived && (Date.now() - new Date(lastReceived).getTime()) < 7 * 24 * 60 * 60 * 1000;

  return (
    <section className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Webhook size={18} className="text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Webhook KelPay</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
            isConnected
              ? "bg-green-500/10 text-green-600"
              : "bg-yellow-500/10 text-yellow-600"
          }`}>
            <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-yellow-500"}`} />
            {isConnected ? "Connecté" : "En attente"}
          </span>
          <button
            onClick={fetchCallbacks}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors"
            title="Rafraîchir"
          >
            <RefreshCw size={14} className={`text-muted-foreground ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Communiquez ces URLs à KelPay pour recevoir les confirmations de paiement automatiques.
      </p>

      {/* Webhook URLs */}
      <div className="space-y-3 mb-5">
        <div className="p-3 bg-muted/50 rounded-lg">
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Staging (studio.zandofy.com)
          </label>
          <CopyableField
            value={WEBHOOK_URLS.staging}
            className="text-xs break-all"
          />
        </div>
        <div className="p-3 bg-muted/50 rounded-lg">
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Production (zandofy.com)
          </label>
          <CopyableField
            value={WEBHOOK_URLS.production}
            className="text-xs break-all"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            ⚠️ L'URL de production sera mise à jour lors du passage en production.
          </p>
        </div>
      </div>

      {/* Last received */}
      {lastReceived && (
        <p className="text-xs text-muted-foreground mb-3">
          Dernier callback reçu : <span className="font-medium text-foreground">
            {formatDistanceToNow(new Date(lastReceived), { addSuffix: true, locale: fr })}
          </span>
        </p>
      )}

      {/* Recent callbacks table */}
      <div>
        <h3 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
          <ExternalLink size={12} />
          Derniers callbacks ({callbacks.length})
        </h3>

        {loading ? (
          <div className="flex items-center justify-center py-6">
            <RefreshCw size={16} className="animate-spin text-muted-foreground" />
          </div>
        ) : callbacks.length === 0 ? (
          <div className="text-center py-6 text-xs text-muted-foreground">
            Aucun callback reçu pour l'instant.
            <br />
            <span className="text-[10px]">Les callbacks apparaîtront ici dès que KelPay enverra une notification.</span>
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Référence</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Statut</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Montant</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody>
                {callbacks.map((cb) => (
                  <tr key={cb.id} className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2 font-mono text-[11px] text-foreground max-w-[180px] truncate">
                      {cb.reference}
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1">
                        {statusIcon(cb.status)}
                        <span className="text-foreground">{statusLabel(cb.status)}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-foreground font-medium">
                      ${cb.amount?.toFixed(2)} {cb.currency}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {formatDistanceToNow(new Date(cb.updated_at), { addSuffix: true, locale: fr })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
