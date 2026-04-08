import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Webhook, Save, Loader2, Package, ShieldCheck, ExternalLink } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface Props {
  storeId: string;
}

export function VendorAutonomousTab({ storeId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: override, isLoading } = useQuery({
    queryKey: ["vendor-autonomous", storeId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("vendor_pricing_overrides")
        .select("vendor_webhook_url, vendor_mode, vendor_mobile_money_enabled, vendor_card_enabled, vendor_cod_enabled, vendor_off_platform_enabled, vendor_custom_payment_numbers_enabled")
        .eq("store_id", storeId)
        .single();
      return data;
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
  const [initialized, setInitialized] = useState(false);

  if (override && !initialized) {
    setWebhookUrl(override.vendor_webhook_url || "");
    setInitialized(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("vendor_pricing_overrides")
        .update({ vendor_webhook_url: webhookUrl || null, updated_at: new Date().toISOString() })
        .eq("store_id", storeId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Enregistré", description: "URL webhook mise à jour." });
      queryClient.invalidateQueries({ queryKey: ["vendor-autonomous", storeId] });
    },
    onError: (err: any) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    },
  });

  const testWebhook = useMutation({
    mutationFn: async () => {
      if (!recentOrders?.length) throw new Error("Aucune commande à tester");
      const { data, error } = await supabase.functions.invoke("vendor-order-webhook", {
        body: { order_id: recentOrders[0].id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast({
        title: "Webhook envoyé",
        description: `Statut: ${data?.webhook_status || "OK"}`,
      });
    },
    onError: (err: any) => {
      toast({ title: "Erreur webhook", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isAutonomous = override?.vendor_mode === "local_only" || override?.vendor_off_platform_enabled;
  const paymentConfig = {
    mobile_money: override?.vendor_mobile_money_enabled !== false,
    card: override?.vendor_card_enabled !== false,
    cod: !!override?.vendor_cod_enabled,
    off_platform: !!override?.vendor_off_platform_enabled,
    custom_numbers: !!override?.vendor_custom_payment_numbers_enabled,
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
            ? "Vous gérez vos propres paiements et logistique. Les commandes sont relayées via webhook vers votre système."
            : "Contactez l'administrateur pour activer le mode vendeur autonome sur votre boutique."}
        </p>
      </div>

      {/* Payment config summary */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-primary" />
          <h4 className="text-sm font-semibold text-foreground">Configuration paiements</h4>
        </div>
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

      {/* Webhook configuration */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Webhook size={16} className="text-primary" />
          <h4 className="text-sm font-semibold text-foreground">Webhook API</h4>
        </div>
        <p className="text-xs text-muted-foreground">
          Recevez automatiquement les détails de chaque commande sur votre système (ERP, logistique, etc.)
        </p>
        <div className="flex gap-2">
          <input
            type="url"
            placeholder="https://votre-systeme.com/api/orders"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            className="flex-1 px-3 py-2 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saveMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Sauvegarder
          </button>
        </div>
        {webhookUrl && (
          <button
            onClick={() => testWebhook.mutate()}
            disabled={testWebhook.isPending || !recentOrders?.length}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-accent text-accent-foreground rounded-lg hover:bg-accent/80 disabled:opacity-50 transition-colors"
          >
            {testWebhook.isPending ? <Loader2 size={12} className="animate-spin" /> : <ExternalLink size={12} />}
            Tester avec la dernière commande
          </button>
        )}
      </div>

      {/* Recent orders (no platform payment metrics) */}
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
