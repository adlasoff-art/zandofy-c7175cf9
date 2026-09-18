/**
 * Admin MapPin — edits forwarders.coverage_routes (same as forwarder Coverage page).
 * Does NOT use orphan forwarder_coverage table.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { CoverageRoutesEditor } from "@/components/forwarder/CoverageRoutesEditor";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  forwarderId: string | null;
  forwarderName?: string;
}

export function ForwarderCoverageDialog({ open, onOpenChange, forwarderId, forwarderName }: Props) {
  const qc = useQueryClient();

  const { data: forwarder, isLoading } = useQuery({
    queryKey: ["forwarder-for-coverage-dialog", forwarderId],
    enabled: !!forwarderId && open,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("forwarders")
        .select("id, coverage_routes")
        .eq("id", forwarderId)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; coverage_routes: unknown } | null;
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Couverture — {forwarderName ?? "Transitaire"}</DialogTitle>
        </DialogHeader>
        {isLoading || !forwarderId ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin" size={20} />
          </div>
        ) : (
          <CoverageRoutesEditor
            forwarderId={forwarderId}
            initialRoutes={(forwarder?.coverage_routes as any) || []}
            compact
            onSaved={() => {
              qc.invalidateQueries({ queryKey: ["forwarder-for-coverage-dialog", forwarderId] });
              qc.invalidateQueries({ queryKey: ["admin-forwarders"] });
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
