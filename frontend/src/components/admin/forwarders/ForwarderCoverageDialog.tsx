import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
const sb = supabase as any;
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Coverage {
  id: string;
  forwarder_id: string;
  country_code: string;
  city: string | null;
  is_active: boolean;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  forwarderId: string | null;
  forwarderName?: string;
}

export function ForwarderCoverageDialog({ open, onOpenChange, forwarderId, forwarderName }: Props) {
  const qc = useQueryClient();
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["forwarder-coverage", forwarderId],
    queryFn: async () => {
      if (!forwarderId) return [];
      const { data, error } = await sb
        .from("forwarder_coverage")
        .select("*")
        .eq("forwarder_id", forwarderId)
        .order("country_code", { ascending: true })
        .order("city", { ascending: true, nullsFirst: true });
      if (error) throw error;
      return data as Coverage[];
    },
    enabled: !!forwarderId && open,
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!forwarderId) return;
      const cc = country.trim().toUpperCase();
      if (cc.length !== 2) throw new Error("Code pays ISO 2 lettres requis (ex: CD, CM, FR)");
      const { error } = await sb.from("forwarder_coverage").insert({
        forwarder_id: forwarderId,
        country_code: cc,
        city: city.trim() || null,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Couverture ajoutée");
      setCountry(""); setCity("");
      qc.invalidateQueries({ queryKey: ["forwarder-coverage", forwarderId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await sb.from("forwarder_coverage").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["forwarder-coverage", forwarderId] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await sb.from("forwarder_coverage").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Supprimé");
      qc.invalidateQueries({ queryKey: ["forwarder-coverage", forwarderId] });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin size={16} /> Couverture — {forwarderName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-[110px_1fr_auto] gap-2 items-end">
            <div>
              <Label className="text-xs">Code pays *</Label>
              <Input
                value={country}
                onChange={(e) => setCountry(e.target.value.toUpperCase())}
                placeholder="CD"
                maxLength={2}
              />
            </div>
            <div>
              <Label className="text-xs">Ville (optionnel)</Label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Vide = tout le pays"
              />
            </div>
            <Button onClick={() => add.mutate()} disabled={add.isPending || !country}>
              {add.isPending ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
            </Button>
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-primary" size={18} />
              </div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucune zone de couverture définie.</p>
            ) : (
              <div className="divide-y divide-border">
                {rows.map((r) => (
                  <div key={r.id} className="flex items-center justify-between px-3 py-2">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{r.country_code}</Badge>
                      <span className="text-sm">{r.city ?? <em className="text-muted-foreground">Tout le pays</em>}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={r.is_active}
                        onCheckedChange={(v) => toggle.mutate({ id: r.id, is_active: v })}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => remove.mutate(r.id)}
                      >
                        <Trash2 size={14} className="text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}