import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Webhook, Loader2, Package, ShieldCheck, Send, Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

interface Props {
  storeId: string;
}

export function VendorAutonomousTab({ storeId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch store info (is_platform_owned)
  const { data: storeInfo } = useQuery({
    queryKey: ["vendor-store-info", storeId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("stores")
        .select("is_platform_owned")
        .eq("id", storeId)
        .single();
      return data;
    },
  });

  // Fetch vendor overrides
  const { data: override, isLoading } = useQuery({
    queryKey: ["vendor-autonomous", storeId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("vendor_pricing_overrides")
        .select("vendor_webhook_url, vendor_mode, vendor_mobile_money_enabled, vendor_card_enabled, vendor_cod_enabled, vendor_off_platform_enabled, vendor_custom_payment_numbers_enabled, webhook_approved")
        .eq("store_id", storeId)
        .single();
      return data;
    },
  });

  // Fetch webhook requests
  const { data: webhookRequests } = useQuery({
    queryKey: ["webhook-requests", storeId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("webhook_api_requests")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  const { data: recentOrders } = useQuery({
    queryKey: ["vendor-autonomous-orders", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, order_ref, status, total, shipping_first_name, shipping_last_name, shipping_city, created_at, payment_method")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  const [webhookUrl, setWebhookUrl] = useState("");

  // Submit webhook request
  const submitRequest = useMutation({
    mutationFn: async () => {
      if (!webhookUrl.trim()) throw new Error("Veuillez renseigner une URL");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");
      const { error } = await (supabase as any)
        .from("webhook_api_requests")
        .insert({
          store_id: storeId,
          requested_by: user.id,
          requested_url: webhookUrl.trim(),
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Demande envoyée", description: "Votre demande d'activation Webhook sera examinée par l'administrateur." });
      setWebhookUrl("");
      queryClient.invalidateQueries({ queryKey: ["webhook-requests", storeId] });
    },
    onError: (err: any) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Platform-owned stores cannot use autonomous mode
  const isPlatformOwned = storeInfo?.is_platform_owned === true;

  if (isPlatformOwned) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border p-6 bg-muted/30 border-border text-center">
          <AlertTriangle size={32} className="mx-auto text-muted-foreground mb-3" />
          <h3 className="text-sm font-bold text-foreground mb-2">Mode non disponible</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Cette boutique appartient à la plateforme. Le mode Vendeur Autonome n'est pas disponible pour les boutiques de la plateforme.
            Contactez l'administrateur si vous souhaitez que votre boutique devienne indépendante.
          </p>
        </div>
      </div>
    );
  }

  const isAutonomous = override?.vendor_mode === "local_only" || override?.vendor_off_platform_enabled;
  const webhookApproved = override?.webhook_approved === true;
  const activeWebhook = webhookApproved ? override?.vendor_webhook_url : null;
  const paymentConfig = {
    mobile_money: override?.vendor_mobile_money_enabled === true,
    card: override?.vendor_card_enabled === true,
    cod: override?.vendor_cod_enabled === true,
    off_platform: override?.vendor_off_platform_enabled === true,
    custom_numbers: override?.vendor_custom_payment_numbers_enabled === true,
  };

  const latestPendingRequest = webhookRequests?.find((r: any) => r.status === "pending");
  const latestRejected = webhookRequests?.find((r: any) => r.status === "rejected");

  const statusIcon = (status: string) => {
    switch (status) {
      case "pending": return <Clock size={12} className="text-yellow-500" />;
      case "approved": return <CheckCircle2 size={12} className="text-green-500" />;
      case "rejected": return <XCircle size={12} className="text-destructive" />;
      default: return null;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "pending": return "En attente";
      case "approved": return "Approuvée";
      case "rejected": return "Rejetée";
      default: return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* Status banner */}
      <div className={`rounded-xl border p-4 ${isAutonomous ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-border"}`}>
        <div className="flex items-center gap-2 mb-2">
          <Package size={18} className={isAutonomous ? "text-primary" : "text-muted-foreground"} />
          <h3 className="text-sm font-bold text-foreground">
            {isAutonomous ? "Mode Vendeur Autonome actif" : "Mode Standard"}
          </h3>
        </div>
        <p className="text-xs text-muted-foreground">
          {isAutonomous
            ? "Vous gérez vos propres paiements et logistique. Seul le paiement hors plateforme avec vos numéros personnalisés est actif."
            : "Contactez l'administrateur pour activer le mode vendeur autonome sur votre boutique."}
        </p>
      </div>

      {/* Payment config summary (read-only) */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-primary" />
          <h4 className="text-sm font-semibold text-foreground">Configuration paiements</h4>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Ces options sont gérées par l'administrateur selon votre package.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[
            { label: "Mobile Money", active: paymentConfig.mobile_money },
            { label: "Carte bancaire", active: paymentConfig.card },
            { label: "Paiement livraison", active: paymentConfig.cod },
            { label: "Hors plateforme", active: paymentConfig.off_platform },
            { label: "N° personnalisés", active: paymentConfig.custom_numbers },
          ].map((pm) => (
            <div key={pm.label} className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
              <div className={`w-2 h-2 rounded-full ${pm.active ? "bg-green-500" : "bg-muted-foreground/30"}`} />
              <span className="text-xs text-foreground">{pm.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Webhook API — Request-based */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Webhook size={16} className="text-primary" />
          <h4 className="text-sm font-semibold text-foreground">Webhook API</h4>
        </div>

        {webhookApproved && activeWebhook ? (
          <>
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <CheckCircle2 size={14} className="text-green-600 dark:text-green-400 shrink-0" />
              <div>
                <p className="text-xs font-medium text-green-700 dark:text-green-300">Webhook actif</p>
                <p className="text-[10px] text-green-600 dark:text-green-400 break-all">{activeWebhook}</p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Pour modifier l'URL, veuillez soumettre une nouvelle demande ci-dessous.
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            Recevez automatiquement les détails de chaque commande sur votre système (ERP, logistique, etc.). 
            Soumettez une demande pour activer cette fonctionnalité.
          </p>
        )}

        {/* Show pending request if any */}
        {latestPendingRequest && (
          <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <Clock size={14} className="text-yellow-600 dark:text-yellow-400 shrink-0" />
            <div>
              <p className="text-xs font-medium text-yellow-700 dark:text-yellow-300">Demande en cours d'examen</p>
              <p className="text-[10px] text-yellow-600 dark:text-yellow-400 break-all">{latestPendingRequest.requested_url}</p>
            </div>
          </div>
        )}

        {/* Show rejection if latest was rejected */}
        {!latestPendingRequest && latestRejected && (
          <div className="flex items-start gap-2 p-3 bg-destructive/5 rounded-lg border border-destructive/20">
            <XCircle size={14} className="text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-destructive">Dernière demande rejetée</p>
              {latestRejected.admin_notes && (
                <p className="text-[10px] text-muted-foreground mt-0.5">{latestRejected.admin_notes}</p>
              )}
            </div>
          </div>
        )}

        {/* New request form (only if no pending request) */}
        {!latestPendingRequest && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">URL de votre API</label>
            <div className="flex gap-2">
              <input
                type="url"
                placeholder="https://votre-systeme.com/api/orders"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="flex-1 px-3 py-2 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <button
                onClick={() => submitRequest.mutate()}
                disabled={submitRequest.isPending || !webhookUrl.trim()}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {submitRequest.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                Soumettre
              </button>
            </div>
          </div>
        )}

        {/* Request history */}
        {webhookRequests && webhookRequests.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-border">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Historique des demandes</p>
            {webhookRequests.map((req: any) => (
              <div key={req.id} className="flex items-center justify-between p-2 bg-muted/20 rounded-lg">
                <div className="flex items-center gap-2 min-w-0">
                  {statusIcon(req.status)}
                  <span className="text-[10px] text-foreground truncate">{req.requested_url}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-muted-foreground">{statusLabel(req.status)}</span>
                  <span className="text-[10px] text-muted-foreground">{new Date(req.created_at).toLocaleDateString("fr-FR")}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent orders */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h4 className="text-sm font-semibold text-foreground">Commandes récentes</h4>
        {!recentOrders?.length ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Aucune commande</p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {recentOrders.map((order) => (
              <div key={order.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border/50">
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-foreground">{order.order_ref}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {order.shipping_first_name} {order.shipping_last_name} • {order.shipping_city}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(order.created_at).toLocaleDateString("fr-FR")} • {order.payment_method || "N/A"}
                  </p>
                </div>
                <div className="text-right space-y-0.5">
                  <p className="text-xs font-bold text-foreground">${order.total}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    order.status === "delivered" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : order.status === "cancelled" ? "bg-destructive/10 text-destructive"
                    : "bg-accent text-accent-foreground"
                  }`}>
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
