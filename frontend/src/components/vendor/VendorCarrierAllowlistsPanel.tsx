import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Truck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * Phase C4 — Vendor selects allowed operators (empty = all coverage-eligible).
 */
export function VendorCarrierAllowlistsPanel({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();

  const { data: operators = [], isLoading: loadingOps } = useQuery({
    queryKey: ["active-operators-for-allowlist"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("delivery_operators")
        .select("id, company_name, is_active")
        .eq("is_active", true)
        .order("company_name")
        .limit(100);
      return (data || []) as Array<{ id: string; company_name: string }>;
    },
  });

  const { data: allowlist = [], isLoading: loadingAllow } = useQuery({
    queryKey: ["store-carrier-allowlists", storeId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("store_carrier_allowlists")
        .select("id, carrier_id, carrier_type, enabled, lanes")
        .eq("store_id", storeId)
        .eq("carrier_type", "operator");
      return (data || []) as Array<{
        id: string;
        carrier_id: string;
        enabled: boolean;
      }>;
    },
  });

  const enabledSet = new Set(
    allowlist.filter((a) => a.enabled).map((a) => a.carrier_id),
  );
  const hasAny = allowlist.some((a) => a.enabled);

  const toggle = useMutation({
    mutationFn: async ({ carrierId, enable }: { carrierId: string; enable: boolean }) => {
      if (enable) {
        const { error } = await (supabase as any).from("store_carrier_allowlists").upsert(
          {
            store_id: storeId,
            carrier_type: "operator",
            carrier_id: carrierId,
            enabled: true,
            lanes: ["last_mile", "domestic"],
            updated_at: new Date().toISOString(),
          },
          { onConflict: "store_id,carrier_type,carrier_id" },
        );
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("store_carrier_allowlists")
          .update({ enabled: false, updated_at: new Date().toISOString() })
          .eq("store_id", storeId)
          .eq("carrier_type", "operator")
          .eq("carrier_id", carrierId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-carrier-allowlists", storeId] });
      toast.success("Transporteurs mis à jour");
    },
    onError: (e: Error) => toast.error(e.message || "Erreur"),
  });

  const clearAll = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("store_carrier_allowlists")
        .update({ enabled: false })
        .eq("store_id", storeId)
        .eq("carrier_type", "operator");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["store-carrier-allowlists", storeId] });
      toast.success("Aucun filtre — tous les opérateurs couvrant votre zone");
    },
  });

  if (loadingOps || loadingAllow) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Loader2 className="animate-spin" size={16} /> Chargement transporteurs…
      </div>
    );
  }

  return (
    <div className="space-y-3 border border-border rounded-lg p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Truck size={16} /> Opérateurs last-mile autorisés
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Aucune sélection = tous les opérateurs qui couvrent la destination (comportement
            par défaut). Sinon, intersection avec la couverture.
          </p>
        </div>
        {hasAny && (
          <button
            type="button"
            className="text-xs text-primary underline"
            onClick={() => clearAll.mutate()}
          >
            Tout effacer
          </button>
        )}
      </div>
      <div className="space-y-2 max-h-56 overflow-y-auto">
        {operators.map((op) => (
          <label key={op.id} className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={enabledSet.has(op.id)}
              onCheckedChange={(v) =>
                toggle.mutate({ carrierId: op.id, enable: v === true })
              }
            />
            <span>{op.company_name}</span>
          </label>
        ))}
        {operators.length === 0 && (
          <p className="text-xs text-muted-foreground">Aucun opérateur actif pour le moment.</p>
        )}
      </div>
    </div>
  );
}
