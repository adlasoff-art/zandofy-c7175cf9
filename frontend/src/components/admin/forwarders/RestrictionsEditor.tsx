import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Trash2, Ban, FileWarning, Info, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

const sb = supabase as any;

interface Restriction {
  id?: string;
  profile_id: string;
  restriction_type: "forbidden" | "license_required" | "info";
  label: string;
  icon: string | null;
  sort_order: number;
}

const TYPE_META: Record<string, { icon: React.ReactNode; label: string; cls: string }> = {
  forbidden: { icon: <Ban size={12} />, label: "Interdit", cls: "text-destructive" },
  license_required: { icon: <FileWarning size={12} />, label: "Sous licence", cls: "text-orange-500" },
  info: { icon: <Info size={12} />, label: "Info", cls: "text-primary" },
};

export function RestrictionsEditor({ profileId }: { profileId: string }) {
  const qc = useQueryClient();
  const queryKey = ["restrictions", profileId];

  const { data: items = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await sb
        .from("forwarder_restrictions")
        .select("*")
        .eq("profile_id", profileId)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as Restriction[];
    },
  });

  const create = useMutation({
    mutationFn: async (r: Partial<Restriction>) => {
      const { error } = await sb.from("forwarder_restrictions").insert([{ ...r, profile_id: profileId }]);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("forwarder_restrictions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const [draft, setDraft] = useState<Partial<Restriction>>({ restriction_type: "forbidden", label: "" });

  return (
    <div className="border border-border rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <ShieldAlert size={14} className="text-primary" />
        <h3 className="text-sm font-semibold">Règles & restrictions</h3>
      </div>

      {isLoading ? (
        <Loader2 className="animate-spin text-primary" size={14} />
      ) : (
        <div className="space-y-1">
          {items.map(r => {
            const meta = TYPE_META[r.restriction_type] ?? TYPE_META.info;
            return (
              <div key={r.id} className="flex items-center gap-2 text-xs bg-muted/30 rounded px-2 py-1.5">
                <span className={`flex items-center gap-1 shrink-0 ${meta.cls}`}>
                  {meta.icon}
                  <span className="text-[10px] uppercase tracking-wide">{meta.label}</span>
                </span>
                <span className="flex-1 truncate">{r.label}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove.mutate(r.id!)}>
                  <Trash2 size={12} className="text-destructive" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2 pt-2 border-t border-border">
        <select
          value={draft.restriction_type}
          onChange={e => setDraft({ ...draft, restriction_type: e.target.value as any })}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        >
          <option value="forbidden">Interdit</option>
          <option value="license_required">Sous licence</option>
          <option value="info">Info</option>
        </select>
        <Input
          placeholder="Ex: Armes à feu, Acier inoxydable…"
          value={draft.label ?? ""}
          onChange={e => setDraft({ ...draft, label: e.target.value })}
          className="h-8 flex-1"
        />
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          onClick={() => {
            if (!draft.label?.trim()) return;
            create.mutate(draft);
            setDraft({ restriction_type: "forbidden", label: "" });
          }}
        >
          <Plus size={12} className="mr-1" /> Ajouter
        </Button>
      </div>
    </div>
  );
}