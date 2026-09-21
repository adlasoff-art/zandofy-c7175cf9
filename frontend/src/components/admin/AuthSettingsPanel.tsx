import { useCallback, useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  AUTH_SETTINGS_DEFAULTS,
  AUTH_SETTINGS_QUERY_KEY,
  DISCOVERY_MIX_DEFAULTS,
  discoveryMixSum,
  normalizeDiscoveryMix,
  type AuthSettings,
  type DiscoveryMixConfig,
} from "@/hooks/use-auth-settings";

export function AuthSettingsPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<AuthSettings>({
    ...AUTH_SETTINGS_DEFAULTS,
    discovery_mix: { ...DISCOVERY_MIX_DEFAULTS },
  });
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
        const raw = data.value as Partial<AuthSettings>;
        setConfig({
          ...AUTH_SETTINGS_DEFAULTS,
          ...raw,
          discovery_onboarding_steps: {
            ...AUTH_SETTINGS_DEFAULTS.discovery_onboarding_steps,
            ...(raw.discovery_onboarding_steps || {}),
          },
          discovery_mix: normalizeDiscoveryMix(raw.discovery_mix),
          discovery_popup_delay_sec:
            typeof raw.discovery_popup_delay_sec === "number"
              ? raw.discovery_popup_delay_sec
              : AUTH_SETTINGS_DEFAULTS.discovery_popup_delay_sec,
          magic_link_enabled: raw.magic_link_enabled === true,
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

  const patchMix = (patch: Partial<DiscoveryMixConfig>) => {
    const discovery_mix = normalizeDiscoveryMix({ ...config.discovery_mix, ...patch });
    void save({ ...config, discovery_mix });
  };

  if (loading) return null;

  const mixSum = discoveryMixSum(config.discovery_mix);
  const mixOk = Math.abs(mixSum - 100) <= 2;

  return (
    <section className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Shield size={18} className="text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Authentification clients</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Mode fluide = session immédiate après inscription (désactiver « Confirm email » dans Supabase Auth).
        Mode strict = toast de vérification e-mail. Voir docs/AUTH_SETTINGS.md et docs/DISCOVERY_ENGINE.md.
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
            <p className="text-xs text-muted-foreground">
              Accepte téléphone comme identifiant (email technique) — champ unifié Auth
            </p>
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
            <p className="text-sm font-medium">Connexion rapide email (lien OTP)</p>
            <p className="text-xs text-muted-foreground">Désactivé par défaut — Google + mot de passe recommandés</p>
          </div>
          <Switch
            checked={config.magic_link_enabled === true}
            disabled={saving}
            onCheckedChange={(checked) =>
              save({ ...config, magic_link_enabled: checked })
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

        <div className="p-3 bg-muted/40 rounded-lg space-y-3">
          <div>
            <p className="text-sm font-medium">Mix discovery (feed %)</p>
            <p className="text-xs text-muted-foreground">
              Cœur + exploration + neutre ≈ 100. Ville + pays (scope ville) ≈ cœur.
            </p>
          </div>
          {!mixOk && (
            <p className="text-xs text-destructive">
              Somme actuelle {mixSum}% (attendu ~100). Ajustez avant de valider en prod.
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {(
              [
                ["core_pct", "Cœur %"],
                ["explore_pct", "Exploration %"],
                ["neutral_pct", "Neutre %"],
                ["city_pct", "Ville % (total)"],
                ["country_within_core_pct", "Pays % (total)"],
                ["intl_cap_pct", "Plafond intl % (ville/pays)"],
                ["rotation_hours", "Rotation (h)"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs text-muted-foreground">{label}</Label>
                <Input
                  type="number"
                  min={0}
                  max={
                    key === "rotation_hours" ? 168 : key === "intl_cap_pct" ? 25 : 100
                  }
                  disabled={saving}
                  value={config.discovery_mix[key]}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setConfig((c) => ({
                      ...c,
                      discovery_mix: { ...c.discovery_mix, [key]: n },
                    }));
                  }}
                  onBlur={() => patchMix({ [key]: config.discovery_mix[key] })}
                />
              </div>
            ))}
          </div>
          <div className="space-y-1 max-w-[140px]">
            <Label className="text-xs text-muted-foreground">Délai popup CMS (s)</Label>
            <Input
              type="number"
              min={0}
              max={120}
              disabled={saving}
              value={config.discovery_popup_delay_sec}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  discovery_popup_delay_sec: Number(e.target.value),
                }))
              }
              onBlur={() =>
                save({
                  ...config,
                  discovery_popup_delay_sec: Math.min(
                    120,
                    Math.max(0, Number(config.discovery_popup_delay_sec) || 0),
                  ),
                })
              }
            />
          </div>
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
