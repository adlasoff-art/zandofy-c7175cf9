import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Calculator, Loader2 } from "lucide-react";
import { toast } from "sonner";

export interface VendorFeaturesConfig {
  freight_simulator_enabled?: boolean;
}

export function FreightSimulatorToggle() {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["vendor-features-config"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "vendor_features_config")
        .maybeSingle();
      return (data?.value as VendorFeaturesConfig) || { freight_simulator_enabled: false };
    },
  });

  const toggle = useMutation({
    mutationFn: async (next: boolean) => {
      const newValue = { ...(config || {}), freight_simulator_enabled: next };
      const { error } = await supabase
        .from("platform_settings")
        .upsert(
          { key: "vendor_features_config", value: newValue as any, updated_at: new Date().toISOString() },
          { onConflict: "key" },
        );
      if (error) throw error;
    },
    onSuccess: (_d, next) => {
      queryClient.invalidateQueries({ queryKey: ["vendor-features-config"] });
      toast.success(next ? "Simulateur fret activé pour les vendeurs" : "Simulateur fret désactivé");
    },
    onError: (e: any) => toast.error(e.message || "Erreur"),
  });

  const enabled = !!config?.freight_simulator_enabled;

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Calculator size={16} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Simulateur de devis fret (vendeurs)</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Active un onglet « Simulateur fret » côté vendeur. Lecture seule sur les profils transitaires que vous gérez.
                Les vendeurs peuvent calculer un devis et le copier pour partage WhatsApp, sans modifier les tarifs.
              </p>
            </div>
            {isLoading ? (
              <Loader2 size={16} className="animate-spin text-muted-foreground" />
            ) : (
              <Switch
                checked={enabled}
                onCheckedChange={(v) => toggle.mutate(v)}
                disabled={toggle.isPending}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}