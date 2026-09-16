/**
 * ConsigneeCombobox — searchable carnet + quick-add for forwarder TMS.
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type Consignee = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address_line: string | null;
  country_code: string | null;
  city: string | null;
};

type Props = {
  forwarderId: string;
  valueId: string | null;
  onSelect: (c: Consignee | null) => void;
};

export function ConsigneeCombobox({ forwarderId, valueId, onSelect }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    phone: "",
    email: "",
    address_line: "",
    city: "",
  });

  const { data: consignees = [], isLoading } = useQuery({
    queryKey: ["forwarder-consignees", forwarderId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("forwarder_consignees")
        .select("id, name, phone, email, address_line, country_code, city")
        .eq("forwarder_id", forwarderId)
        .order("name")
        .limit(500);
      if (error) throw error;
      return (data || []) as Consignee[];
    },
  });

  const selected = consignees.find((c) => c.id === valueId) || null;

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return consignees;
    return consignees.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        (c.phone || "").includes(s) ||
        (c.city || "").toLowerCase().includes(s),
    );
  }, [consignees, q]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!draft.name.trim()) throw new Error("Nom obligatoire");
      const { data, error } = await (supabase as any)
        .from("forwarder_consignees")
        .insert({
          forwarder_id: forwarderId,
          name: draft.name.trim(),
          phone: draft.phone.trim() || null,
          email: draft.email.trim() || null,
          address_line: draft.address_line.trim() || null,
          city: draft.city.trim() || null,
        })
        .select("id, name, phone, email, address_line, country_code, city")
        .single();
      if (error) throw error;
      return data as Consignee;
    },
    onSuccess: (c) => {
      toast.success("Destinataire ajouté");
      qc.invalidateQueries({ queryKey: ["forwarder-consignees", forwarderId] });
      onSelect(c);
      setAddOpen(false);
      setDraft({ name: "", phone: "", email: "", address_line: "", city: "" });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message || "Échec"),
  });

  return (
    <div className="flex gap-2 items-start">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            className="flex-1 justify-between h-10 font-normal"
          >
            <span className="truncate">
              {selected
                ? `${selected.name}${selected.phone ? ` · ${selected.phone}` : ""}`
                : "Rechercher un destinataire…"}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(100vw-2rem,360px)] p-2" align="start">
          <Input
            placeholder="Nom ou téléphone…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-8 mb-2"
          />
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {isLoading && (
              <div className="flex justify-center py-4">
                <Loader2 className="animate-spin" size={16} />
              </div>
            )}
            <button
              type="button"
              className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted text-muted-foreground"
              onClick={() => {
                onSelect(null);
                setOpen(false);
              }}
            >
              — Saisie manuelle —
            </button>
            {filtered.map((c) => (
              <button
                key={c.id}
                type="button"
                className={cn(
                  "w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted flex items-center gap-2",
                  valueId === c.id && "bg-muted",
                )}
                onClick={() => {
                  onSelect(c);
                  setOpen(false);
                }}
              >
                <Check className={cn("h-3.5 w-3.5", valueId === c.id ? "opacity-100" : "opacity-0")} />
                <span className="truncate">
                  {c.name}
                  {c.phone ? ` · ${c.phone}` : ""}
                </span>
              </button>
            ))}
            {!isLoading && filtered.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-2">Aucun résultat</p>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={() => setAddOpen(true)}>
        <Plus size={16} />
      </Button>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveau destinataire</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Nom *</Label>
              <Input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Téléphone</Label>
              <Input value={draft.phone} onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))} placeholder="+243…" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Email</Label>
              <Input value={draft.email} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Adresse</Label>
              <Input value={draft.address_line} onChange={(e) => setDraft((d) => ({ ...d, address_line: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ville</Label>
              <Input value={draft.city} onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Annuler
            </Button>
            <Button disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? <Loader2 className="animate-spin" size={14} /> : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
