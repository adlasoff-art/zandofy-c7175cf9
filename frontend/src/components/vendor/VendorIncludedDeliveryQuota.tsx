import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package } from "lucide-react";

/** Phase C2 — show Enterprise included last-mile usage for the calendar month */
export function VendorIncludedDeliveryQuota({ storeId }: { storeId: string }) {
  const { data } = useQuery({
    queryKey: ["included-delivery-quota", storeId],
    queryFn: async () => {
      const { data: row, error } = await (supabase as any).rpc("get_included_delivery_quota", {
        p_store_id: storeId,
      });
      if (error || !row || row.ok !== true) return null;
      return row as {
        used: number;
        limit: number;
        remaining: number;
        max_kg_per_included_delivery: number;
        year_month: string;
      };
    },
  });

  if (!data || !data.limit || data.limit <= 0) return null;

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-1">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Package size={16} /> Livraisons last-mile incluses
      </h3>
      <p className="text-xs text-muted-foreground">
        {data.used}/{data.limit} utilisées ce mois ({data.year_month}) — max{" "}
        {data.max_kg_per_included_delivery} kg / commande. Au-delà : tarif opérateur.
      </p>
    </div>
  );
}
