import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
const sb = supabase as any;
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, MapPin, Check, ChevronsUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface Coverage {
  id: string;
  forwarder_id: string;
  country_code: string;
  city_id: string | null;
  city_name?: string | null;
  is_active: boolean;
  created_at: string;
}

interface City {
  id: string;
  name: string;
  country_code: string;
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
  const [cityId, setCityId] = useState<string | null>(null);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["forwarder-coverage", forwarderId],
    queryFn: async () => {
      if (!forwarderId) return [];
      const { data, error } = await sb
        .from("forwarder_coverage")
        .select("*, cities:city_id(name)")
        .eq("forwarder_id", forwarderId)
        .order("country_code", { ascending: true })
        .order("city_id", { ascending: true, nullsFirst: true });
      if (error) throw error;
      return (data as any[]).map((r) => ({
        ...r,
        city_name: r.cities?.name ?? null,
      })) as Coverage[];
    },
    enabled: !!forwarderId && open,
  });

  // Cities for the selected country (only when a 2-letter ISO is typed)
  const { data: cities = [] } = useQuery({
    queryKey: ["cities-by-country", country.toUpperCase()],
    queryFn: async () => {
      const cc = country.trim().toUpperCase();
      if (cc.length !== 2) return [];
      const { data, error } = await sb
        .from("cities")
        .select("id,name,country_code")
        .eq("country_code", cc)
        .eq("is_active", true)
        .order("name", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as City[];
    },
    enabled: country.trim().length === 2,
  });

  const selectedCity = useMemo(
    () => cities.find((c) => c.id === cityId) ?? null,
    [cities, cityId],
  );

  const add = useMutation({
    mutationFn: async () => {
      if (!forwarderId) return;
      const cc = country.trim().toUpperCase();
      if (cc.length !== 2) throw new Error("Code pays ISO 2 lettres requis (ex: CD, CM, FR)");
      const { error } = await sb.from("forwarder_coverage").insert({
        forwarder_id: forwarderId,
        country_code: cc,
        city_id: cityId,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Couverture ajoutée");
      setCountry(""); setCityId(null);
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
                onChange={(e) => { setCountry(e.target.value.toUpperCase()); setCityId(null); }}
                placeholder="CD"
                maxLength={2}
              />
            </div>
            <div>
              <Label className="text-xs">Ville (optionnel)</Label>
              <Popover open={cityPickerOpen} onOpenChange={setCityPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    disabled={country.trim().length !== 2}
                    className="w-full justify-between font-normal"
                  >
                    <span className="truncate">
                      {selectedCity ? selectedCity.name : "Vide = tout le pays"}
                    </span>
                    <ChevronsUpDown size={14} className="opacity-50 shrink-0" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[280px]" align="start">
                  <Command>
                    <CommandInput placeholder="Rechercher une ville..." />
                    <CommandList>
                      <CommandEmpty>Aucune ville trouvée.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value=""
                          onSelect={() => { setCityId(null); setCityPickerOpen(false); }}
                        >
                          <Check size={14} className={cn("mr-2", !cityId ? "opacity-100" : "opacity-0")} />
                          <em className="text-muted-foreground">Tout le pays</em>
                        </CommandItem>
                        {cities.map((c) => (
                          <CommandItem
                            key={c.id}
                            value={c.name}
                            onSelect={() => { setCityId(c.id); setCityPickerOpen(false); }}
                          >
                            <Check size={14} className={cn("mr-2", cityId === c.id ? "opacity-100" : "opacity-0")} />
                            {c.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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
                      <span className="text-sm">
                        {r.city_name ?? <em className="text-muted-foreground">Tout le pays</em>}
                      </span>
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