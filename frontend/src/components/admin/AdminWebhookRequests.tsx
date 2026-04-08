import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Webhook, CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import { useState } from "react";

export function AdminWebhookRequests() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [actionId, setActionId] = useState<string | null>(null);

  const { data: requests, isLoading } = useQuery({
    queryKey: ["admin-webhook-requests"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("webhook_api_requests")
        .select("*, stores:store_id(name)")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  const handleAction = useMutation({
    mutationFn: async ({ requestId, status, storeId, url }: { requestId: string; status: "approved" | "rejected"; storeId: string; url: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      // Update request status
      const { error } = await (supabase as any)
        .from("webhook_api_requests")
        .update({
          status,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);
      if (error) throw error;

      // If approved, set the webhook URL on vendor_pricing_overrides
      if (status === "approved") {
        const { error: overrideErr } = await (supabase as any)
          .from("vendor_pricing_overrides")
          .update({
            vendor_webhook_url: url,
            webhook_approved: true,
            updated_at: new Date().toISOString(),
          })
          .eq("store_id", storeId);
        if (overrideErr) throw overrideErr;
      }
    },
    onSuccess: (_, vars) => {
      toast({
        title: vars.status === "approved" ? "Webhook approuvé" : "Webhook rejeté",
        description: vars.status === "approved"
          ? "L'URL webhook a été activée pour la boutique."
          : "La demande a été rejetée.",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-webhook-requests"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stores-pricing"] });
      setActionId(null);
    },
    onError: (err: any) => {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
      setActionId(null);
    },
  });

  const pendingRequests = requests?.filter((r: any) => r.status === "pending") || [];

  if (isLoading) return null;
  if (pendingRequests.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Webhook size={16} className="text-primary" />
        <h3 className="text-sm font-semibold text-foreground">
          Demandes Webhook API ({pendingRequests.length})
        </h3>
      </div>
      <div className="space-y-2">
        {pendingRequests.map((req: any) => (
          <div key={req.id} className="flex items-center justify-between p-3 bg-muted/20 rounded-lg border border-border/50 gap-3">
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2">
                <Clock size={12} className="text-yellow-500 shrink-0" />
                <span className="text-xs font-semibold text-foreground truncate">
                  {req.stores?.name || "Boutique"}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground break-all">{req.requested_url}</p>
              <p className="text-[10px] text-muted-foreground">
                {new Date(req.created_at).toLocaleDateString("fr-FR")}
              </p>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button
                onClick={() => {
                  setActionId(req.id);
                  handleAction.mutate({ requestId: req.id, status: "approved", storeId: req.store_id, url: req.requested_url });
                }}
                disabled={handleAction.isPending}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {actionId === req.id && handleAction.isPending ? <Loader2 size={10} className="animate-spin" /> : <CheckCircle2 size={10} />}
                Approuver
              </button>
              <button
                onClick={() => {
                  setActionId(req.id);
                  handleAction.mutate({ requestId: req.id, status: "rejected", storeId: req.store_id, url: req.requested_url });
                }}
                disabled={handleAction.isPending}
                className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50 transition-colors"
              >
                <XCircle size={10} />
                Rejeter
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
