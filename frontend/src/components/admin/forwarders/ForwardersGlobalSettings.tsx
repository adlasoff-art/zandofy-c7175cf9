import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Save, AlertTriangle } from "lucide-react";

type FwdConfig = {
  enabled: boolean;
  fallback_mode: "auto_calc" | "platform_default" | "block";
  require_selection: boolean;
};

const DEFAULT_CFG: FwdConfig = {
  enabled: false,
  fallback_mode: "auto_calc",
  require_selection: true,
};

export function ForwardersGlobalSettings() {
  const qc = useQueryClient();
  const [cfg, setCfg] = useState<FwdConfig>(DEFAULT_CFG);

  const { data, isLoading } = useQuery({
    queryKey: ["platform-settings", "forwarders_config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "forwarders_config")
        .maybeSingle();
      if (error) throw error;
      return (data?.value as FwdConfig) ?? DEFAULT_CFG;
    },
  });

  useEffect(() => {
    if (data) setCfg({ ...DEFAULT_CFG, ...data });
  }, [data]);

  const save = useMutation({
    mutationFn: async (next: FwdConfig) => {
      const { error } = await (supabase as any)
        .from("platform_settings")
        .upsert({ key: "forwarders_config", value: next as any }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configuration enregistrée");
      qc.invalidateQueries({ queryKey: ["platform-settings", "forwarders_config"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur lors de l'enregistrement"),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="animate-spin text-primary" size={20} />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Paramètres globaux</CardTitle>
        <CardDescription>
          Active ou désactive la sélection de transitaires lors du checkout. Garde désactivé tant que le système n'est pas validé.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between p-3 border border-border rounded-lg bg-muted/30">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Activer le système de transitaires</Label>
            <p className="text-xs text-muted-foreground">
              Si désactivé, le checkout fonctionne comme aujourd'hui (calcul automatique).
            </p>
          </div>
          <Switch
            checked={cfg.enabled}
            onCheckedChange={(v) => setCfg({ ...cfg, enabled: v })}
          />
        </div>

        {!cfg.enabled && (
          <div className="flex items-start gap-2 p-3 border border-destructive/30 rounded-lg bg-destructive/5 text-xs text-destructive">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>Système inactif — aucun impact sur le checkout en production.</span>
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-sm">Mode de repli (aucun transitaire éligible)</Label>
          <Select
            value={cfg.fallback_mode}
            onValueChange={(v: any) => setCfg({ ...cfg, fallback_mode: v })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto_calc">Calcul automatique (Shipping Engine)</SelectItem>
              <SelectItem value="platform_default">Tarif plateforme par défaut</SelectItem>
              <SelectItem value="block">Bloquer le checkout</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between p-3 border border-border rounded-lg">
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">Sélection obligatoire</Label>
            <p className="text-xs text-muted-foreground">
              Le client doit choisir un transitaire avant de payer (si système activé).
            </p>
          </div>
          <Switch
            checked={cfg.require_selection}
            onCheckedChange={(v) => setCfg({ ...cfg, require_selection: v })}
          />
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={() => save.mutate(cfg)} disabled={save.isPending}>
            {save.isPending ? <Loader2 className="animate-spin mr-2" size={14} /> : <Save className="mr-2" size={14} />}
            Enregistrer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}