import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Loader2, Plus, Trash2, MapPin, Ship, Plane, Truck as TruckIcon, Train } from "lucide-react";
import { toast } from "sonner";
import { CbmTiersEditor } from "./CbmTiersEditor";
import { PieceTiersEditor } from "./PieceTiersEditor";
import { RestrictionsEditor } from "./RestrictionsEditor";
import { TransporterUserPicker } from "./TransporterUserPicker";
import { KgTiersEditor } from "./KgTiersEditor";
import { ConsolidationSettingsCard } from "./ConsolidationSettingsCard";

const sb = supabase as any;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  forwarderId: string | null;
  forwarderName?: string;
}

interface Profile {
  id?: string;
  forwarder_id: string;
  mode: "sea" | "air" | "road" | "rail";
  service_class: "express" | "standard" | "economy" | "vip";
  country_code: string;
  city_id: string | null;
  currency: string;
  transit_min_days: number | null;
  transit_max_days: number | null;
  deposit_pct: number;
  deposit_threshold_cbm: number | null;
  volumetric_divisor: number | null;
  linked_transporter_user_id: string | null;
  notes: string | null;
  is_active: boolean;
  consolidation_enabled?: boolean;
  consolidation_fee_flat?: number | null;
  consolidation_fee_per_kg?: number | null;
  consolidation_min_packages?: number;
}

const SERVICE_LABEL: Record<string, string> = {
  express: "Express",
  standard: "Standard",
  economy: "Économique",
  vip: "VIP",
};

const MODE_ICON: Record<string, React.ReactNode> = {
  sea: <Ship size={12} />,
  air: <Plane size={12} />,
  road: <TruckIcon size={12} />,
  rail: <Train size={12} />,
};

const MODE_LABEL: Record<string, string> = {
  sea: "Maritime",
  air: "Aérien",
  road: "Routier",
  rail: "Ferroviaire",
};

export function ForwarderPricingProfilesDialog({ open, onOpenChange, forwarderId, forwarderName }: Props) {
  const qc = useQueryClient();

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ["forwarder-profiles", forwarderId],
    enabled: !!forwarderId && open,
    queryFn: async () => {
      const { data, error } = await sb
        .from("forwarder_pricing_profiles")
        .select("*")
        .eq("forwarder_id", forwarderId)
        .order("country_code")
        .order("mode");
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const { data: cities = [] } = useQuery({
    queryKey: ["cities-for-profiles"],
    enabled: open,
    queryFn: async () => {
      const { data } = await sb.from("cities").select("id,name,country_code").eq("is_active", true).order("name");
      return (data ?? []) as { id: string; name: string; country_code: string }[];
    },
  });

  const create = useMutation({
    mutationFn: async (p: Partial<Profile>) => {
      const { error } = await sb.from("forwarder_pricing_profiles").insert([{ ...p, forwarder_id: forwarderId }]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profil créé");
      qc.invalidateQueries({ queryKey: ["forwarder-profiles", forwarderId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Profile> }) => {
      const { error } = await sb.from("forwarder_pricing_profiles").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["forwarder-profiles", forwarderId] }),
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("forwarder_pricing_profiles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profil supprimé");
      qc.invalidateQueries({ queryKey: ["forwarder-profiles", forwarderId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const [newOpen, setNewOpen] = useState(false);
  const [draft, setDraft] = useState<Partial<Profile>>({
    mode: "sea",
    service_class: "standard",
    country_code: "CD",
    city_id: null,
    currency: "USD",
    deposit_pct: 0,
    volumetric_divisor: null,
    linked_transporter_user_id: null,
    is_active: true,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tarifs — {forwarderName ?? "Transitaire"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" variant={newOpen ? "secondary" : "default"} onClick={() => setNewOpen(v => !v)}>
              <Plus size={14} className="mr-1" /> {newOpen ? "Fermer" : "Nouveau profil"}
            </Button>
          </div>

          {newOpen && (
            <div className="border border-border rounded-lg p-3 space-y-2 bg-muted/30">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Mode</Label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                    value={draft.mode}
                    onChange={e => setDraft({ ...draft, mode: e.target.value as any })}
                  >
                    <option value="sea">Maritime</option>
                    <option value="air">Aérien</option>
                    <option value="road">Routier</option>
                    <option value="rail">Ferroviaire</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Classe de service</Label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                    value={draft.service_class ?? "standard"}
                    onChange={e => setDraft({ ...draft, service_class: e.target.value as any })}
                  >
                    <option value="express">Express</option>
                    <option value="standard">Standard</option>
                    <option value="economy">Économique</option>
                    <option value="vip">VIP</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Pays (code ISO)</Label>
                  <Input
                    value={draft.country_code ?? ""}
                    maxLength={2}
                    onChange={e => setDraft({ ...draft, country_code: e.target.value.toUpperCase() })}
                    placeholder="CD"
                  />
                </div>
                <div>
                  <Label className="text-xs">Ville (optionnel)</Label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                    value={draft.city_id ?? ""}
                    onChange={e => setDraft({ ...draft, city_id: e.target.value || null })}
                  >
                    <option value="">— Tout le pays —</option>
                    {cities
                      .filter(c => !draft.country_code || c.country_code === draft.country_code)
                      .map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Devise</Label>
                  <Input value={draft.currency ?? "USD"} onChange={e => setDraft({ ...draft, currency: e.target.value.toUpperCase() })} />
                </div>
                <div>
                  <Label className="text-xs">Délai min (j)</Label>
                  <Input type="number" value={draft.transit_min_days ?? ""} onChange={e => setDraft({ ...draft, transit_min_days: e.target.value ? +e.target.value : null })} />
                </div>
                <div>
                  <Label className="text-xs">Délai max (j)</Label>
                  <Input type="number" value={draft.transit_max_days ?? ""} onChange={e => setDraft({ ...draft, transit_max_days: e.target.value ? +e.target.value : null })} />
                </div>
                <div>
                  <Label className="text-xs">Acompte %</Label>
                  <Input type="number" value={draft.deposit_pct ?? 0} onChange={e => setDraft({ ...draft, deposit_pct: +e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Seuil acompte (CBM)</Label>
                  <Input type="number" value={draft.deposit_threshold_cbm ?? ""} onChange={e => setDraft({ ...draft, deposit_threshold_cbm: e.target.value ? +e.target.value : null })} placeholder="ex: 10" />
                </div>
                <div>
                  <Label className="text-xs">Diviseur volumétrique</Label>
                  <Input
                    type="number"
                    value={draft.volumetric_divisor ?? ""}
                    onChange={e => setDraft({ ...draft, volumetric_divisor: e.target.value ? +e.target.value : null })}
                    placeholder={draft.mode === "air" ? "6000" : draft.mode === "road" ? "5000" : "—"}
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Compte transporteur (override pour ce profil)</Label>
                  <TransporterUserPicker
                    value={draft.linked_transporter_user_id ?? null}
                    onChange={(uid) => setDraft({ ...draft, linked_transporter_user_id: uid })}
                    placeholder="Hériter du transitaire"
                  />
                </div>
              </div>
              <Button
                size="sm"
                className="w-full"
                onClick={() => {
                  create.mutate(draft);
                  setNewOpen(false);
                  setDraft({
                    mode: "sea",
                    service_class: "standard",
                    country_code: "CD",
                    city_id: null,
                    currency: "USD",
                    deposit_pct: 0,
                    volumetric_divisor: null,
                    linked_transporter_user_id: null,
                    is_active: true,
                  });
                }}
              >
                Créer le profil
              </Button>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>
          ) : profiles.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              Aucun profil tarifaire. Créez-en un pour démarrer.
            </p>
          ) : (
            <Accordion type="multiple" className="w-full">
              {profiles.map(p => {
                const cityName = cities.find(c => c.id === p.city_id)?.name;
                return (
                  <AccordionItem key={p.id} value={p.id!}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2 flex-1 text-left">
                        <Badge variant="outline" className="gap-1 text-[10px]">
                          {MODE_ICON[p.mode]} {MODE_LABEL[p.mode]}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {SERVICE_LABEL[p.service_class] ?? p.service_class}
                        </Badge>
                        <span className="text-sm font-medium">
                          🌍 {p.country_code}{cityName ? ` · ${cityName}` : ""}
                        </span>
                        {p.transit_min_days && p.transit_max_days && (
                          <span className="text-xs text-muted-foreground">
                            · {p.transit_min_days}–{p.transit_max_days}j
                          </span>
                        )}
                        {!p.is_active && <Badge variant="secondary" className="text-[10px]">Inactif</Badge>}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 pt-2">
                        <div className="flex items-center justify-between gap-2 px-1">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={p.is_active}
                              onCheckedChange={v => update.mutate({ id: p.id!, patch: { is_active: v } })}
                            />
                            <span className="text-xs text-muted-foreground">Profil actif</span>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => {
                              if (confirm("Supprimer ce profil et tous ses paliers ?")) remove.mutate(p.id!);
                            }}
                          >
                            <Trash2 size={14} className="mr-1" /> Supprimer profil
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-3 px-1">
                          <div>
                            <Label className="text-xs">Classe de service</Label>
                            <select
                              className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                              value={p.service_class ?? "standard"}
                              onChange={e => update.mutate({ id: p.id!, patch: { service_class: e.target.value as any } })}
                            >
                              <option value="express">Express</option>
                              <option value="standard">Standard</option>
                              <option value="economy">Économique</option>
                              <option value="vip">VIP</option>
                            </select>
                          </div>
                          <div>
                            <Label className="text-xs">Diviseur volumétrique</Label>
                            <Input
                              type="number"
                              value={p.volumetric_divisor ?? ""}
                              placeholder={p.mode === "air" ? "6000" : p.mode === "road" ? "5000" : "—"}
                              onChange={e =>
                                update.mutate({
                                  id: p.id!,
                                  patch: { volumetric_divisor: e.target.value ? +e.target.value : null },
                                })
                              }
                            />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Compte transporteur (override)</Label>
                            <TransporterUserPicker
                              value={p.linked_transporter_user_id ?? null}
                              onChange={(uid) =>
                                update.mutate({ id: p.id!, patch: { linked_transporter_user_id: uid } })
                              }
                              placeholder="Hériter du transitaire"
                            />
                          </div>
                        </div>

                        {/* Tarification adaptée au mode :
                            - air : KG mis en avant
                            - sea : CBM mis en avant
                            - road / rail : les deux */}
                        {(p.mode === "air" || p.mode === "road" || p.mode === "rail") && (
                          <KgTiersEditor profileId={p.id!} currency={p.currency} />
                        )}
                        {(p.mode === "sea" || p.mode === "road" || p.mode === "rail") && (
                          <CbmTiersEditor profileId={p.id!} currency={p.currency} />
                        )}
                        <PieceTiersEditor profileId={p.id!} currency={p.currency} />
                        <ConsolidationSettingsCard
                          profileId={p.id!}
                          forwarderId={forwarderId!}
                          currency={p.currency}
                          consolidation_enabled={!!p.consolidation_enabled}
                          consolidation_fee_flat={p.consolidation_fee_flat ?? null}
                          consolidation_fee_per_kg={p.consolidation_fee_per_kg ?? null}
                          consolidation_min_packages={p.consolidation_min_packages ?? 2}
                        />
                        <RestrictionsEditor profileId={p.id!} />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}