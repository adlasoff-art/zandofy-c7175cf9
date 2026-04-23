import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Trash2, Package } from "lucide-react";
import { toast } from "sonner";

const sb = supabase as any;

interface Tier {
  id?: string;
  profile_id: string;
  category_id: string | null;
  custom_label: string | null;
  pricing_unit: "piece" | "cbm";
  price: number;
  min_quantity: number;
  includes_customs: boolean;
  sort_order: number;
}

export function PieceTiersEditor({ profileId, currency }: { profileId: string; currency: string }) {
  const qc = useQueryClient();
  const queryKey = ["piece-tiers", profileId];

  const { data: tiers = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await sb
        .from("forwarder_piece_tiers")
        .select("*")
        .eq("profile_id", profileId)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Tier[];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories-for-piece-tiers"],
    queryFn: async () => {
      const { data } = await sb.from("categories").select("id,name_fr").order("name_fr");
      return (data ?? []) as { id: string; name_fr: string }[];
    },
  });

  const create = useMutation({
    mutationFn: async (t: Partial<Tier>) => {
      const { error } = await sb.from("forwarder_piece_tiers").insert([{ ...t, profile_id: profileId }]);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Tier> }) => {
      const { error } = await sb.from("forwarder_piece_tiers").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("forwarder_piece_tiers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const [draft, setDraft] = useState<Partial<Tier>>({
    category_id: null,
    custom_label: "",
    pricing_unit: "piece",
    price: 0,
    min_quantity: 1,
    includes_customs: false,
  });

  return (
    <div className="border border-border rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Package size={14} className="text-primary" />
        <h3 className="text-sm font-semibold">Tarifs par pièce / catégorie</h3>
      </div>

      {isLoading ? (
        <Loader2 className="animate-spin text-primary" size={14} />
      ) : (
        <div className="space-y-1">
          {tiers.map(t => {
            const catName = categories.find(c => c.id === t.category_id)?.name_fr;
            return (
              <div key={t.id} className="flex items-center gap-2 text-xs bg-muted/30 rounded px-2 py-1.5">
                <span className="font-medium min-w-[80px] truncate">{catName ?? t.custom_label ?? "?"}</span>
                <Input
                  type="number"
                  value={t.price}
                  onChange={e => update.mutate({ id: t.id!, patch: { price: +e.target.value } })}
                  className="h-8 w-20"
                />
                <select
                  value={t.pricing_unit}
                  onChange={e => update.mutate({ id: t.id!, patch: { pricing_unit: e.target.value as any } })}
                  className="h-8 rounded-md border border-input bg-background px-1 text-xs"
                >
                  <option value="piece">{currency}/pc</option>
                  <option value="cbm">{currency}/CBM</option>
                </select>
                <span className="text-muted-foreground">min</span>
                <Input
                  type="number"
                  value={t.min_quantity}
                  onChange={e => update.mutate({ id: t.id!, patch: { min_quantity: +e.target.value } })}
                  className="h-8 w-12"
                />
                <div className="flex items-center gap-1 ml-auto">
                  <Switch
                    checked={t.includes_customs}
                    onCheckedChange={v => update.mutate({ id: t.id!, patch: { includes_customs: v } })}
                  />
                  <span className="text-[10px] text-muted-foreground">Dédouané</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove.mutate(t.id!)}>
                    <Trash2 size={12} className="text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-12 gap-2 pt-2 border-t border-border items-center">
        <select
          value={draft.category_id ?? ""}
          onChange={e => setDraft({ ...draft, category_id: e.target.value || null })}
          className="col-span-3 h-8 rounded-md border border-input bg-background px-2 text-xs"
        >
          <option value="">— Catégorie —</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name_fr}</option>)}
        </select>
        <Input
          placeholder="ou libellé"
          value={draft.custom_label ?? ""}
          onChange={e => setDraft({ ...draft, custom_label: e.target.value })}
          className="col-span-3 h-8"
        />
        <Input
          type="number"
          placeholder="prix"
          value={draft.price ?? ""}
          onChange={e => setDraft({ ...draft, price: +e.target.value })}
          className="col-span-2 h-8"
        />
        <select
          value={draft.pricing_unit}
          onChange={e => setDraft({ ...draft, pricing_unit: e.target.value as any })}
          className="col-span-2 h-8 rounded-md border border-input bg-background px-1 text-xs"
        >
          <option value="piece">{currency}/pc</option>
          <option value="cbm">{currency}/CBM</option>
        </select>
        <Input
          type="number"
          placeholder="min"
          value={draft.min_quantity ?? 1}
          onChange={e => setDraft({ ...draft, min_quantity: +e.target.value })}
          className="col-span-1 h-8"
        />
        <Button
          size="sm"
          variant="outline"
          className="col-span-1 h-8 px-2"
          onClick={() => {
            create.mutate(draft);
            setDraft({ category_id: null, custom_label: "", pricing_unit: "piece", price: 0, min_quantity: 1, includes_customs: false });
          }}
        >
          <Plus size={12} />
        </Button>
      </div>
    </div>
  );
}