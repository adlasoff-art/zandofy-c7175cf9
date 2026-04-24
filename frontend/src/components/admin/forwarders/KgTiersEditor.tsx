import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Trash2, Weight } from "lucide-react";
import { toast } from "sonner";

const sb = supabase as any;

interface KgTier {
  id?: string;
  profile_id: string;
  min_kg: number;
  max_kg: number | null;
  price_per_kg: number | null;
  flat_price: number | null;
  round_up_to_kg: boolean;
  is_quote_only: boolean;
  sort_order: number;
}

export function KgTiersEditor({ profileId, currency }: { profileId: string; currency: string }) {
  const qc = useQueryClient();
  const queryKey = ["kg-tiers", profileId];

  const { data: tiers = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await sb
        .from("forwarder_kg_tiers")
        .select("*")
        .eq("profile_id", profileId)
        .order("sort_order")
        .order("min_kg");
      if (error) throw error;
      return (data ?? []) as KgTier[];
    },
  });

  const create = useMutation({
    mutationFn: async (t: Partial<KgTier>) => {
      const { error } = await sb.from("forwarder_kg_tiers").insert([{ ...t, profile_id: profileId }]);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<KgTier> }) => {
      const { error } = await sb.from("forwarder_kg_tiers").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("forwarder_kg_tiers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const [draft, setDraft] = useState<Partial<KgTier>>({
    min_kg: 0,
    max_kg: null,
    price_per_kg: null,
    flat_price: null,
    round_up_to_kg: true,
    is_quote_only: false,
  });
  const [draftMode, setDraftMode] = useState<"per_kg" | "flat">("per_kg");

  return (
    <div className="border border-border rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Weight size={14} className="text-primary" />
        <h3 className="text-sm font-semibold">Paliers KG (aérien)</h3>
        <span className="text-[10px] text-muted-foreground ml-auto">
          Arrondi : 800 g → 1 kg facturé
        </span>
      </div>

      {isLoading ? (
        <Loader2 className="animate-spin text-primary" size={14} />
      ) : (
        <div className="space-y-1">
          {tiers.map(t => {
            const usingFlat = t.flat_price !== null;
            return (
              <div key={t.id} className="flex items-center gap-2 text-xs bg-muted/30 rounded px-2 py-1.5 flex-wrap">
                <Input
                  type="number"
                  value={t.min_kg}
                  onChange={e => update.mutate({ id: t.id!, patch: { min_kg: +e.target.value } })}
                  className="h-8 w-16"
                  step="0.1"
                />
                <span className="text-muted-foreground">→</span>
                <Input
                  type="number"
                  value={t.max_kg ?? ""}
                  placeholder="∞"
                  onChange={e => update.mutate({ id: t.id!, patch: { max_kg: e.target.value ? +e.target.value : null } })}
                  className="h-8 w-16"
                  step="0.1"
                />
                <span className="text-muted-foreground">kg</span>

                {usingFlat ? (
                  <Input
                    type="number"
                    value={t.flat_price ?? ""}
                    placeholder="forfait"
                    onChange={e =>
                      update.mutate({
                        id: t.id!,
                        patch: { flat_price: e.target.value ? +e.target.value : null, price_per_kg: null },
                      })
                    }
                    className="h-8 w-20"
                    disabled={t.is_quote_only}
                  />
                ) : (
                  <Input
                    type="number"
                    value={t.price_per_kg ?? ""}
                    placeholder="prix/kg"
                    onChange={e =>
                      update.mutate({
                        id: t.id!,
                        patch: { price_per_kg: e.target.value ? +e.target.value : null, flat_price: null },
                      })
                    }
                    className="h-8 w-20"
                    disabled={t.is_quote_only}
                  />
                )}
                <span className="text-muted-foreground">{currency}{usingFlat ? " (forfait)" : "/kg"}</span>

                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[10px]"
                  onClick={() =>
                    update.mutate({
                      id: t.id!,
                      patch: usingFlat
                        ? { flat_price: null, price_per_kg: t.flat_price }
                        : { price_per_kg: null, flat_price: t.price_per_kg },
                    })
                  }
                >
                  ↔ {usingFlat ? "Prix/kg" : "Forfait"}
                </Button>

                <div className="flex items-center gap-1 ml-auto">
                  <Switch
                    checked={t.round_up_to_kg}
                    onCheckedChange={v => update.mutate({ id: t.id!, patch: { round_up_to_kg: v } })}
                  />
                  <span className="text-[10px] text-muted-foreground">Arrondi</span>
                  <Switch
                    checked={t.is_quote_only}
                    onCheckedChange={v => update.mutate({ id: t.id!, patch: { is_quote_only: v } })}
                  />
                  <span className="text-[10px] text-muted-foreground">Devis</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove.mutate(t.id!)}>
                    <Trash2 size={12} className="text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2 pt-2 border-t border-border flex-wrap">
        <Input
          type="number"
          placeholder="min kg"
          value={draft.min_kg ?? ""}
          onChange={e => setDraft({ ...draft, min_kg: +e.target.value })}
          className="h-8 w-16"
          step="0.1"
        />
        <span className="text-xs text-muted-foreground">→</span>
        <Input
          type="number"
          placeholder="max kg"
          value={draft.max_kg ?? ""}
          onChange={e => setDraft({ ...draft, max_kg: e.target.value ? +e.target.value : null })}
          className="h-8 w-16"
          step="0.1"
        />
        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          value={draftMode}
          onChange={e => setDraftMode(e.target.value as "per_kg" | "flat")}
        >
          <option value="per_kg">Prix/kg</option>
          <option value="flat">Forfait</option>
        </select>
        <Input
          type="number"
          placeholder={draftMode === "flat" ? `forfait ${currency}` : `prix ${currency}/kg`}
          value={draftMode === "flat" ? (draft.flat_price ?? "") : (draft.price_per_kg ?? "")}
          onChange={e => {
            const v = e.target.value ? +e.target.value : null;
            if (draftMode === "flat") setDraft({ ...draft, flat_price: v, price_per_kg: null });
            else setDraft({ ...draft, price_per_kg: v, flat_price: null });
          }}
          className="h-8 w-24"
        />
        <div className="flex items-center gap-1">
          <Switch
            checked={!!draft.round_up_to_kg}
            onCheckedChange={v => setDraft({ ...draft, round_up_to_kg: v })}
          />
          <span className="text-[10px] text-muted-foreground">Arrondi</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto h-8"
          onClick={() => {
            create.mutate(draft);
            setDraft({
              min_kg: 0,
              max_kg: null,
              price_per_kg: null,
              flat_price: null,
              round_up_to_kg: true,
              is_quote_only: false,
            });
          }}
        >
          <Plus size={12} className="mr-1" /> Ajouter
        </Button>
      </div>
    </div>
  );
}