import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Trash2, Layers } from "lucide-react";
import { toast } from "sonner";

const sb = supabase as any;

interface Tier {
  id?: string;
  profile_id: string;
  min_cbm: number;
  max_cbm: number | null;
  price_per_cbm: number | null;
  is_quote_only: boolean;
  sort_order: number;
}

export function CbmTiersEditor({ profileId, currency }: { profileId: string; currency: string }) {
  const qc = useQueryClient();
  const queryKey = ["cbm-tiers", profileId];

  const { data: tiers = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await sb
        .from("forwarder_cbm_tiers")
        .select("*")
        .eq("profile_id", profileId)
        .order("sort_order")
        .order("min_cbm");
      if (error) throw error;
      return (data ?? []) as Tier[];
    },
  });

  const create = useMutation({
    mutationFn: async (t: Partial<Tier>) => {
      const { error } = await sb.from("forwarder_cbm_tiers").insert([{ ...t, profile_id: profileId }]);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Tier> }) => {
      const { error } = await sb.from("forwarder_cbm_tiers").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("forwarder_cbm_tiers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const [draft, setDraft] = useState<Partial<Tier>>({ min_cbm: 0, max_cbm: null, price_per_cbm: null, is_quote_only: false });

  return (
    <div className="border border-border rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Layers size={14} className="text-primary" />
        <h3 className="text-sm font-semibold">Paliers CBM</h3>
      </div>

      {isLoading ? (
        <Loader2 className="animate-spin text-primary" size={14} />
      ) : (
        <div className="space-y-1">
          {tiers.map(t => (
            <div key={t.id} className="flex items-center gap-2 text-xs bg-muted/30 rounded px-2 py-1.5">
              <Input
                type="number"
                value={t.min_cbm}
                onChange={e => update.mutate({ id: t.id!, patch: { min_cbm: +e.target.value } })}
                className="h-8 w-16"
                step="0.001"
              />
              <span className="text-muted-foreground">→</span>
              <Input
                type="number"
                value={t.max_cbm ?? ""}
                placeholder="∞"
                onChange={e => update.mutate({ id: t.id!, patch: { max_cbm: e.target.value ? +e.target.value : null } })}
                className="h-8 w-16"
                step="0.001"
              />
              <span className="text-muted-foreground">CBM</span>
              <Input
                type="number"
                value={t.price_per_cbm ?? ""}
                placeholder="prix"
                onChange={e => update.mutate({ id: t.id!, patch: { price_per_cbm: e.target.value ? +e.target.value : null } })}
                className="h-8 w-20"
                disabled={t.is_quote_only}
              />
              <span className="text-muted-foreground">{currency}/CBM</span>
              <div className="flex items-center gap-1 ml-auto">
                <Switch
                  checked={t.is_quote_only}
                  onCheckedChange={v => update.mutate({ id: t.id!, patch: { is_quote_only: v } })}
                />
                <span className="text-[10px] text-muted-foreground">Sur devis</span>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove.mutate(t.id!)}>
                  <Trash2 size={12} className="text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 pt-2 border-t border-border">
        <Input type="number" placeholder="min" value={draft.min_cbm ?? ""} onChange={e => setDraft({ ...draft, min_cbm: +e.target.value })} className="h-8 w-16" step="0.001" />
        <span className="text-xs text-muted-foreground">→</span>
        <Input type="number" placeholder="max" value={draft.max_cbm ?? ""} onChange={e => setDraft({ ...draft, max_cbm: e.target.value ? +e.target.value : null })} className="h-8 w-16" step="0.001" />
        <Input type="number" placeholder={`prix ${currency}`} value={draft.price_per_cbm ?? ""} onChange={e => setDraft({ ...draft, price_per_cbm: e.target.value ? +e.target.value : null })} className="h-8 w-24" />
        <Switch checked={!!draft.is_quote_only} onCheckedChange={v => setDraft({ ...draft, is_quote_only: v })} />
        <span className="text-[10px] text-muted-foreground">Devis</span>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto h-8"
          onClick={() => {
            create.mutate(draft);
            setDraft({ min_cbm: 0, max_cbm: null, price_per_cbm: null, is_quote_only: false });
          }}
        >
          <Plus size={12} className="mr-1" /> Ajouter
        </Button>
      </div>
    </div>
  );
}