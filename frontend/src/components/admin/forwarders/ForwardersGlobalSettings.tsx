import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, Save, AlertTriangle } from "lucide-react";

type FwdConfig = {
  enabled: boolean;
  fallback_mode: "auto_calc" | "platform_default" | "block";
  require_selection: boolean;
};

type TeamSeats = {
  mode: "free" | "paid";
  included_seats: number;
  price_usd_per_seat_monthly: number;
};

const DEFAULT_CFG: FwdConfig = {
  enabled: false,
  fallback_mode: "auto_calc",
  require_selection: true,
};

const DEFAULT_SEATS: TeamSeats = {
  mode: "free",
  included_seats: 3,
  price_usd_per_seat_monthly: 9,
};

export function ForwardersGlobalSettings() {
  const qc = useQueryClient();
  const [cfg, setCfg] = useState<FwdConfig>(DEFAULT_CFG);
  const [seats, setSeats] = useState<TeamSeats>(DEFAULT_SEATS);

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

  const { data: saasData, isLoading: saasLoading } = useQuery({
    queryKey: ["platform-settings", "forwarder_saas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "forwarder_saas")
        .maybeSingle();
      if (error) throw error;
      return (data?.value as any) ?? {};
    },
  });

  useEffect(() => {
    if (data) setCfg({ ...DEFAULT_CFG, ...data });
  }, [data]);

  useEffect(() => {
    if (saasData?.team_seats) {
      setSeats({ ...DEFAULT_SEATS, ...saasData.team_seats });
    }
  }, [saasData]);

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

  const saveSeats = useMutation({
    mutationFn: async (next: TeamSeats) => {
      const merged = {
        ...(saasData || {}),
        team_seats: next,
      };
      const { error } = await (supabase as any)
        .from("platform_settings")
        .upsert({ key: "forwarder_saas", value: merged }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sièges équipe enregistrés");
      qc.invalidateQueries({ queryKey: ["platform-settings", "forwarder_saas"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  if (isLoading || saasLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="animate-spin text-primary" size={20} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Paramètres globaux</CardTitle>
          <CardDescription>
            Active ou désactive la sélection de transitaires lors du checkout. Garde désactivé tant que le système n&apos;est pas validé.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between p-3 border border-border rounded-lg bg-muted/30">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Activer le système de transitaires</Label>
              <p className="text-xs text-muted-foreground">
                Si désactivé, le checkout fonctionne comme aujourd&apos;hui (calcul automatique).
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

      <Card>
        <CardHeader>
          <CardTitle>Sièges équipe (staff)</CardTitle>
          <CardDescription>
            Gratuit ou payant. Les sièges inclus sont gratuits ; au-delà, mode payant signale la facturation (encaissement admin).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm">Mode</Label>
            <Select
              value={seats.mode}
              onValueChange={(v: "free" | "paid") => setSeats({ ...seats, mode: v })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Gratuit (illimité / inclus)</SelectItem>
                <SelectItem value="paid">Payant au-delà des sièges inclus</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Sièges inclus</Label>
              <Input
                type="number"
                min={0}
                value={seats.included_seats}
                onChange={(e) => setSeats({ ...seats, included_seats: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Prix USD / siège / mois</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={seats.price_usd_per_seat_monthly}
                onChange={(e) =>
                  setSeats({ ...seats, price_usd_per_seat_monthly: parseFloat(e.target.value) || 0 })
                }
                disabled={seats.mode === "free"}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => saveSeats.mutate(seats)} disabled={saveSeats.isPending}>
              {saveSeats.isPending ? <Loader2 className="animate-spin mr-2" size={14} /> : <Save className="mr-2" size={14} />}
              Enregistrer sièges
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
