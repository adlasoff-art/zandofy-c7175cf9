/**
 * OperatorCoveragePage — Lot 11B Phase B2
 *
 * CRUD des villes desservies (delivery_operator_cities).
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOperatorContext } from "@/hooks/use-operator-context";
import { fromTable } from "@/lib/supabase-helpers";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MapPin, Plus, Loader2, Trash2 } from "lucide-react";

export default function OperatorCoveragePage() {
  const { operator } = useOperatorContext();
  const queryClient = useQueryClient();
  const [country, setCountry] = useState("CD");
  const [city, setCity] = useState("");
  const [adding, setAdding] = useState(false);

  const { data: cities = [], isLoading } = useQuery({
    queryKey: ["operator-cities", operator?.id],
    enabled: !!operator?.id,
    queryFn: async () => {
      const { data } = await fromTable("delivery_operator_cities")
        .select("id, country_code, city, is_active, created_at")
        .eq("operator_id", operator!.id)
        .order("country_code, city");
      return (data ?? []) as any[];
    },
  });

  const addCity = async () => {
    if (!operator || !city.trim()) return;
    setAdding(true);
    const { error } = await fromTable("delivery_operator_cities").insert({
      operator_id: operator.id,
      country_code: country.toUpperCase(),
      city: city.trim(),
      is_active: true,
    });
    setAdding(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Ville ajoutée");
      setCity("");
      queryClient.invalidateQueries({ queryKey: ["operator-cities"] });
    }
  };

  const toggle = async (id: string, current: boolean) => {
    const { error } = await fromTable("delivery_operator_cities").update({ is_active: !current }).eq("id", id);
    if (error) toast.error(error.message);
    else queryClient.invalidateQueries({ queryKey: ["operator-cities"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Supprimer cette zone de couverture ?")) return;
    const { error } = await fromTable("delivery_operator_cities").delete().eq("id", id);
    if (error) toast.error(error.message);
    else queryClient.invalidateQueries({ queryKey: ["operator-cities"] });
  };

  if (!operator) return null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Couverture géographique</h1>
        <p className="text-sm text-muted-foreground">Villes où votre entreprise opère.</p>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-3">
              <Label htmlFor="cc">Pays</Label>
              <Input id="cc" value={country} maxLength={3}
                onChange={(e) => setCountry(e.target.value.toUpperCase())} placeholder="CD" />
            </div>
            <div className="col-span-7">
              <Label htmlFor="ci">Ville</Label>
              <Input id="ci" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Lubumbashi" />
            </div>
            <div className="col-span-2">
              <Button onClick={addCity} disabled={adding || !city.trim()} className="w-full">
                {adding ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading && <Loader2 className="animate-spin mx-auto my-8" size={24} />}

      <div className="space-y-2">
        {cities.map((c) => (
          <Card key={c.id}>
            <CardContent className="pt-3 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MapPin size={14} className="text-[hsl(var(--operator-primary))]" />
                <span className="font-medium">{c.city}</span>
                <span className="text-xs text-muted-foreground">({c.country_code})</span>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant={c.is_active ? "default" : "outline"} onClick={() => toggle(c.id, c.is_active)}>
                  {c.is_active ? "Actif" : "Inactif"}
                </Button>
                <Button size="icon" variant="ghost" onClick={() => remove(c.id)}>
                  <Trash2 size={14} className="text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}