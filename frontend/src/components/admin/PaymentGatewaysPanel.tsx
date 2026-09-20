import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  normalizePaymentGateways,
  PAYMENT_GATEWAYS_DEFAULTS,
  type PaymentGatewaysConfig,
} from "@/lib/payment-gateways";
import { useQueryClient } from "@tanstack/react-query";
import { PAYMENT_GATEWAYS_QUERY_KEY } from "@/hooks/use-payment-gateways";

export function PaymentGatewaysPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [cfg, setCfg] = useState<PaymentGatewaysConfig>({
    ...PAYMENT_GATEWAYS_DEFAULTS,
    by_country: { ...PAYMENT_GATEWAYS_DEFAULTS.by_country },
    pawapay: { ...PAYMENT_GATEWAYS_DEFAULTS.pawapay },
  });
  const [countryMapText, setCountryMapText] = useState("CD=kelpay");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "payment_gateways")
        .maybeSingle();
      const next = normalizePaymentGateways(data?.value);
      setCfg(next);
      setCountryMapText(
        Object.entries(next.by_country)
          .map(([k, v]) => `${k}=${v}`)
          .join(", "),
      );
    })();
  }, []);

  const save = async (next: PaymentGatewaysConfig) => {
    setSaving(true);
    const { error } = await supabase.from("platform_settings").upsert(
      { key: "payment_gateways", value: next as any, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
    setSaving(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    setCfg(next);
    void qc.invalidateQueries({ queryKey: PAYMENT_GATEWAYS_QUERY_KEY });
    toast({ title: "Gateways enregistrés" });
  };

  const parseMap = (text: string): Record<string, "kelpay" | "pawapay"> | null => {
    const out: Record<string, "kelpay" | "pawapay"> = {};
    for (const part of text.split(/[,;\n]+/)) {
      const [k, v] = part.split("=").map((s) => s.trim());
      if (!k || !v) continue;
      if (v === "kelpay" || v === "pawapay") out[k.toUpperCase()] = v;
    }
    if (!Object.keys(out).length) return null;
    return out;
  };

  return (
    <section className="bg-card border border-border rounded-xl p-5">
      <h2 className="text-sm font-semibold text-foreground mb-1">Passerelles MoMo (pays)</h2>
      <p className="text-xs text-muted-foreground mb-3">
        KelPay reste le défaut. PawaPay uniquement si activé + secret PAWAPAY_API_TOKEN déployé.
      </p>
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div>
            <p className="text-sm">Activer PawaPay</p>
            <p className="text-xs text-muted-foreground">Sinon tous les pays utilisent KelPay</p>
          </div>
          <Switch
            checked={cfg.pawapay.enabled}
            disabled={saving}
            onCheckedChange={(v) => void save({ ...cfg, pawapay: { enabled: v } })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Mapping pays (ex. CD=kelpay, ZM=pawapay)</Label>
          <Input
            value={countryMapText}
            disabled={saving}
            onChange={(e) => setCountryMapText(e.target.value)}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={saving}
            onClick={() => {
              const map = parseMap(countryMapText);
              if (!map) {
                toast({
                  title: "Mapping invalide",
                  description: "Indiquez au moins un pays (ex. CD=kelpay).",
                  variant: "destructive",
                });
                return;
              }
              void save({
                ...cfg,
                by_country: map,
              });
            }}
          >
            Enregistrer mapping
          </Button>
        </div>
      </div>
    </section>
  );
}
