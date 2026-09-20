import { useCallback, useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  AUTH_SETTINGS_DEFAULTS,
  AUTH_SETTINGS_QUERY_KEY,
  type AuthSettings,
} from "@/hooks/use-auth-settings";

export function AuthSettingsPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<AuthSettings>(AUTH_SETTINGS_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "auth_settings")
        .maybeSingle();
      if (cancelled) return;
      if (data?.value && typeof data.value === "object") {
        setConfig({
          ...AUTH_SETTINGS_DEFAULTS,
          ...(data.value as Partial<AuthSettings>),
          discovery_onboarding_steps: {
            ...AUTH_SETTINGS_DEFAULTS.discovery_onboarding_steps,
            ...((data.value as any).discovery_onboarding_steps || {}),
          },
        });
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(
    async (next: AuthSettings) => {
      setSaving(true);
      const { error } = await supabase.from("platform_settings").upsert(
        { key: "auth_settings", value: next as any, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
      setSaving(false);
      if (error) {
        toast({ title: "Erreur", description: error.message, variant: "destructive" });
        return;
      }
      setConfig(next);
      queryClient.invalidateQueries({ queryKey: AUTH_SETTINGS_QUERY_KEY });
      toast({ title: "Auth settings enregistrés" });
    },
    [queryClient, toast],
  );

  if (loading) return null;

  return (
    <section className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Shield size={18} className="text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Authentification clients</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Mode fluide = session immédiate après inscription (désactiver « Confirm email » dans Supabase Auth).
        Mode strict = toast de vérification e-mail. Voir docs/AUTH_SETTINGS.md.
      </p>
      <div className="space-y-3">
        <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
          <div>
            <p className="text-sm font-medium">Mode fluide</p>
            <p className="text-xs text-muted-foreground">Compte créé → connecté sans attendre le mail</p>
          </div>
          <Switch
            checked={config.mode === "fluid"}
            disabled={saving}
            onCheckedChange={(checked) =>
              save({ ...config, mode: checked ? "fluid" : "strict" })
            }
          />
        </div>
        <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
          <div>
            <p className="text-sm font-medium">Téléphone à l&apos;inscription</p>
            <p className="text-xs text-muted-foreground">Champ optionnel → profiles.phone</p>
          </div>
          <Switch
            checked={config.collect_phone_on_signup}
            disabled={saving}
            onCheckedChange={(checked) =>
              save({ ...config, collect_phone_on_signup: checked })
            }
          />
        </div>
        <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
          <div>
            <p className="text-sm font-medium">Onboarding adresse</p>
            <p className="text-xs text-muted-foreground">Popup panier / favori si aucune adresse</p>
          </div>
          <Switch
            checked={config.address_onboarding_enabled}
            disabled={saving}
            onCheckedChange={(checked) =>
              save({ ...config, address_onboarding_enabled: checked })
            }
          />
        </div>
        <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
          <div>
            <p className="text-sm font-medium">Onboarding découverte</p>
            <p className="text-xs text-muted-foreground">
              Préférences catalogue (audience, intérêts, portée) — soft sheet Accueil
            </p>
          </div>
          <Switch
            checked={config.discovery_onboarding_enabled}
            disabled={saving}
            onCheckedChange={(checked) =>
              save({ ...config, discovery_onboarding_enabled: checked })
            }
          />
        </div>
        <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
          <div>
            <p className="text-sm font-medium">Étape paiement (onboarding)</p>
            <p className="text-xs text-muted-foreground">Afficher le choix Mobile Money / carte</p>
          </div>
          <Switch
            checked={config.discovery_onboarding_steps.payment}
            disabled={saving || !config.discovery_onboarding_enabled}
            onCheckedChange={(checked) =>
              save({
                ...config,
                discovery_onboarding_steps: {
                  ...config.discovery_onboarding_steps,
                  payment: checked,
                },
              })
            }
          />
        </div>
        <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
          <div>
            <p className="text-sm font-medium">Étape réception (onboarding)</p>
            <p className="text-xs text-muted-foreground">
              Afficher livraison / retrait si « ma ville » ou « mon pays »
            </p>
          </div>
          <Switch
            checked={config.discovery_onboarding_steps.receipt}
            disabled={saving || !config.discovery_onboarding_enabled}
            onCheckedChange={(checked) =>
              save({
                ...config,
                discovery_onboarding_steps: {
                  ...config.discovery_onboarding_steps,
                  receipt: checked,
                },
              })
            }
          />
        </div>
        <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
          <div>
            <p className="text-sm font-medium">Checkout : e-mail confirmé requis</p>
            <p className="text-xs text-muted-foreground">Uniquement utile en mode strict</p>
          </div>
          <Switch
            checked={config.gate_checkout_on_email_confirm}
            disabled={saving}
            onCheckedChange={(checked) =>
              save({ ...config, gate_checkout_on_email_confirm: checked })
            }
          />
        </div>
      </div>
    </section>
  );
}
