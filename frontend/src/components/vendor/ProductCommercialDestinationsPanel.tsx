/**
 * Product CUSTOM commercial destinations (incl. except_cities).
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CountryCombobox } from "@/components/vendor/CountryCombobox";
import { GeoCombobox } from "@/components/address/GeoCombobox";
import { useGeoData } from "@/hooks/useGeoData";
import { useActiveGeo } from "@/hooks/useActiveGeo";

type DestMode = "whole_country" | "selected_cities" | "except_cities";

type Destination = {
  id: string;
  country_code: string;
  mode: DestMode;
  active: boolean;
};

export function ProductCommercialDestinationsPanel({ productId }: { productId: string }) {
  const qc = useQueryClient();
  const { activeCountryCodes } = useActiveGeo();
  const [saving, setSaving] = useState(false);
  const [addCountry, setAddCountry] = useState("");
  const [addMode, setAddMode] = useState<DestMode>("whole_country");
  const [addCity, setAddCity] = useState("");
  const { cities } = useGeoData(addCountry, "", "", "");

  const { data: destinations = [], isLoading } = useQuery({
    queryKey: ["product-shipping-destinations", productId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("product_shipping_destinations")
        .select("id, country_code, mode, active")
        .eq("product_id", productId)
        .order("country_code");
      if (error) throw error;
      return (data || []) as Destination[];
    },
  });

  const { data: cityRows = [] } = useQuery({
    queryKey: ["product-shipping-destination-cities", productId, destinations.map((d) => d.id).join(",")],
    enabled: destinations.length > 0,
    queryFn: async () => {
      const ids = destinations.map((d) => d.id);
      const { data, error } = await (supabase as any)
        .from("product_shipping_destination_cities")
        .select("destination_id, city_id, cities(name)")
        .in("destination_id", ids);
      if (error) throw error;
      return data || [];
    },
  });

  const resolveCityId = () => {
    const cityOpt = cities.find((c) => c.label === addCity || c.value === addCity);
    const cityId = cityOpt?.id || cityOpt?.value;
    return cityId && String(cityId).includes("-") ? String(cityId) : null;
  };

  const addDestination = async () => {
    if (!addCountry || addCountry.length !== 2) {
      toast.error("Sélectionnez un pays");
      return;
    }
    if ((addMode === "selected_cities" || addMode === "except_cities") && !addCity) {
      toast.error(addMode === "except_cities" ? "Ville à exclure requise" : "Ville requise");
      return;
    }
    setSaving(true);
    const { data, error } = await (supabase as any)
      .from("product_shipping_destinations")
      .upsert(
        {
          product_id: productId,
          country_code: addCountry.toUpperCase(),
          mode: addMode,
          active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "product_id,country_code" },
      )
      .select("id")
      .single();
    if (error) {
      setSaving(false);
      toast.error(error.message);
      return;
    }
    if ((addMode === "selected_cities" || addMode === "except_cities") && data?.id) {
      const cityId = resolveCityId();
      if (cityId) {
        await (supabase as any).from("product_shipping_destination_cities").upsert(
          { destination_id: data.id, city_id: cityId },
          { onConflict: "destination_id,city_id" },
        );
      }
    }
    setSaving(false);
    setAddCity("");
    toast.success("Destination produit enregistrée");
    qc.invalidateQueries({ queryKey: ["product-shipping-destinations", productId] });
  };

  const removeDestination = async (id: string) => {
    const { error } = await (supabase as any).from("product_shipping_destinations").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Destination retirée");
      qc.invalidateQueries({ queryKey: ["product-shipping-destinations", productId] });
    }
  };

  const removeCity = async (destinationId: string, cityId: string) => {
    const { error } = await (supabase as any)
      .from("product_shipping_destination_cities")
      .delete()
      .eq("destination_id", destinationId)
      .eq("city_id", cityId);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ["product-shipping-destinations", productId] });
  };

  const citiesFor = (destId: string) => cityRows.filter((r: any) => r.destination_id === destId);

  return (
    <div className="space-y-3 border border-dashed border-border rounded-lg p-3 bg-muted/20">
      <p className="text-xs font-medium text-foreground">Zones personnalisées de ce produit</p>
      {isLoading ? (
        <Loader2 className="animate-spin text-muted-foreground" size={16} />
      ) : (
        <ul className="space-y-2">
          {destinations.map((d) => {
            const list = citiesFor(d.id);
            return (
              <li key={d.id} className="flex items-start justify-between gap-2 text-sm border border-border rounded-md p-2 bg-card">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{d.country_code}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {d.mode === "whole_country"
                      ? "Tout le pays"
                      : d.mode === "except_cities"
                        ? `Sauf : ${list.map((c: any) => c.cities?.name || c.city_id).join(", ") || "—"}`
                        : `Villes : ${list.map((c: any) => c.cities?.name || c.city_id).join(", ") || "—"}`}
                  </p>
                  {d.mode !== "whole_country" && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {list.map((c: any) => (
                        <button
                          key={c.city_id}
                          type="button"
                          className="text-[10px] px-1.5 py-0.5 rounded border border-border"
                          onClick={() => removeCity(d.id, c.city_id)}
                        >
                          {(c.cities?.name || c.city_id) + " ×"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeDestination(d.id)}>
                  <Trash2 size={14} />
                </Button>
              </li>
            );
          })}
          {destinations.length === 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Ajoutez au moins un pays. « Tout le pays sauf… » convient aux zones nationales avec villes inaccessibles.
            </p>
          )}
        </ul>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Pays</Label>
          <CountryCombobox
            value={addCountry}
            onChange={setAddCountry}
            label=""
            showNone={false}
            allowedCodes={activeCountryCodes.length ? activeCountryCodes : undefined}
          />
        </div>
        <div>
          <Label className="text-xs">Mode</Label>
          <select
            className="w-full mt-1 px-3 py-2 text-sm bg-card border border-border rounded-md"
            value={addMode}
            onChange={(e) => setAddMode(e.target.value as DestMode)}
          >
            <option value="whole_country">Tout le pays</option>
            <option value="selected_cities">Certaines villes seulement</option>
            <option value="except_cities">Tout le pays sauf…</option>
          </select>
        </div>
      </div>
      {(addMode === "selected_cities" || addMode === "except_cities") && addCountry && (
        <GeoCombobox
          options={cities.map((c) => ({
            value: c.label || c.value,
            label: c.label || c.value,
            id: c.id,
          }))}
          value={addCity}
          onChange={setAddCity}
          label={addMode === "except_cities" ? "Ville à exclure" : "Ville"}
          placeholder="Sélectionner…"
        />
      )}
      <Button type="button" size="sm" onClick={addDestination} disabled={saving || !addCountry}>
        {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : <Plus size={14} className="mr-1" />}
        Ajouter
      </Button>
    </div>
  );
}
