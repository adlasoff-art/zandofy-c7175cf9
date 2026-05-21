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
import { GeoFieldsRow } from "@/components/address/GeoFieldsRow";
import { toast } from "sonner";
import { MapPin, Plus, Loader2, Trash2, AlertCircle } from "lucide-react";

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

      {!isLoading && cities.length === 0 && (
        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-md">
          <AlertCircle size={14} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 dark:text-amber-200">
            Aucune ville couverte pour l'instant. Ajoutez au moins une ville pour pouvoir y définir des tarifs et apparaître au checkout.
          </p>
        </div>
      )}

      <Card>
        <CardContent className="pt-4">
          <div className="space-y-3">
            <GeoFieldsRow
              value={{ country, city }}
              onChange={(patch) => {
                if (patch.country !== undefined) { setCountry(patch.country); setCity(""); }
                if (patch.city !== undefined) setCity(patch.city);
              }}
              levels={["country", "city"]}
              required={["country", "city"]}
            />
            <Button onClick={addCity} disabled={adding || !city.trim() || !country} className="gap-1">
              {adding ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />}
              Ajouter la ville
            </Button>
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