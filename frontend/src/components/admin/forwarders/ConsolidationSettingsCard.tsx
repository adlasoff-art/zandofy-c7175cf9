import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Package } from "lucide-react";
import { toast } from "sonner";

const sb = supabase as any;

interface Props {
  profileId: string;
  forwarderId: string;
  currency: string;
  consolidation_enabled: boolean;
  consolidation_fee_flat: number | null;
  consolidation_fee_per_kg: number | null;
  consolidation_min_packages: number;
}

export function ConsolidationSettingsCard({
  profileId,
  forwarderId,
  currency,
  consolidation_enabled,
  consolidation_fee_flat,
  consolidation_fee_per_kg,
  consolidation_min_packages,
}: Props) {
  const qc = useQueryClient();

  const update = useMutation({
    mutationFn: async (patch: Partial<Props>) => {
      const { error } = await sb.from("forwarder_pricing_profiles").update(patch).eq("id", profileId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["forwarder-profiles", forwarderId] }),
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  return (
    <div className="border border-border rounded-lg p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Package size={14} className="text-primary" />
        <h3 className="text-sm font-semibold">Service de groupage</h3>
        <div className="ml-auto flex items-center gap-2">
          <Switch
            checked={consolidation_enabled}
            onCheckedChange={v => update.mutate({ consolidation_enabled: v })}
          />
          <span className="text-xs text-muted-foreground">
            {consolidation_enabled ? "Activé" : "Désactivé"}
          </span>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Permet au client de regrouper plusieurs colis de fournisseurs différents en une seule expédition.
        Sans groupage, chaque sous-colis est facturé séparément (chacun paie son propre arrondi au kg).
      </p>

      {consolidation_enabled && (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-[11px]">Frais fixes ({currency})</Label>
            <Input
              type="number"
              value={consolidation_fee_flat ?? ""}
              placeholder="ex : 5"
              onChange={e =>
                update.mutate({ consolidation_fee_flat: e.target.value ? +e.target.value : null })
              }
              className="h-8"
            />
          </div>
          <div>
            <Label className="text-[11px]">Frais / kg ({currency})</Label>
            <Input
              type="number"
              value={consolidation_fee_per_kg ?? ""}
              placeholder="ex : 1"
              onChange={e =>
                update.mutate({ consolidation_fee_per_kg: e.target.value ? +e.target.value : null })
              }
              className="h-8"
            />
          </div>
          <div>
            <Label className="text-[11px]">Mini colis</Label>
            <Input
              type="number"
              value={consolidation_min_packages}
              min={2}
              onChange={e => update.mutate({ consolidation_min_packages: +e.target.value || 2 })}
              className="h-8"
            />
          </div>
        </div>
      )}
    </div>
  );
}