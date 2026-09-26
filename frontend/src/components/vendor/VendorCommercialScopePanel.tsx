/**
 * Vendor UI: default commercial scope + destinations (incl. except_cities).
 */
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, MapPin, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CountryCombobox } from "@/components/vendor/CountryCombobox";
import { GeoCombobox } from "@/components/address/GeoCombobox";
import { useGeoData } from "@/hooks/useGeoData";
import { useActiveGeo } from "@/hooks/useActiveGeo";

type Scope = "city" | "country" | "international";
type DestMode = "whole_country" | "selected_cities" | "except_cities";

type Destination = {
  id: string;
  country_code: string;
  mode: DestMode;
  active: boolean;
};

type Props = {
  storeId: string;
  initialScope?: string | null;
  /** ISO2 store country — used to prefill national exclusions */
  storeCountryCode?: string | null;
};

function modeLabel(mode: DestMode, cities: string[]): string {
  if (mode === "whole_country") return "Tout le pays";
  if (mode === "except_cities") {
    return cities.length
      ? `Tout le pays sauf : ${cities.join(", ")}`
      : "Tout le pays sauf… (aucune ville exclue encore)";
  }
  return cities.length ? `Villes : ${cities.join(", ")}` : "Certaines villes (liste vide)";
}

export function VendorCommercialScopePanel({ storeId, initialScope, storeCountryCode }: Props) {
  const qc = useQueryClient();
  const { activeCountryCodes } = useActiveGeo();
  const [scope, setScope] = useState<Scope>(
    (initialScope === "city" || initialScope === "country" || initialScope === "international"
      ? initialScope
      : "country") as Scope,
  );
  const [saving, setSaving] = useState(false);
  const [addCountry, setAddCountry] = useState("");
  const [addMode, setAddMode] = useState<DestMode>("whole_country");
  const [addCity, setAddCity] = useState("");
  const { cities } = useGeoData(addCountry, "", "", "");

  const showDestinations = scope === "country" || scope === "international";
  const homeCountry = (storeCountryCode || "").toUpperCase().slice(0, 2);

  const { data: destinations = [], isLoading } = useQuery({
    queryKey: ["store-shipping-destinations", storeId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("store_shipping_destinations")
        .select("id, country_code, mode, active")
        .eq("store_id", storeId)
        .order("country_code");
      if (error) throw error;
      return (data || []) as Destination[];
    },
  });

  const { data: cityRows = [] } = useQuery({
    queryKey: ["store-shipping-destination-cities", storeId, destinations.map((d) => d.id).join(",")],
    enabled: destinations.length > 0,
    queryFn: async () => {
      const ids = destinations.map((d) => d.id);
      const { data, error } = await (supabase as any)
        .from("store_shipping_destination_cities")
        .select("destination_id, city_id, cities(name)")
        .in("destination_id", ids);
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (initialScope === "city" || initialScope === "country" || initialScope === "international") {
      setScope(initialScope);
    }
  }, [initialScope]);

  useEffect(() => {
    if (scope === "country" && homeCountry.length === 2 && !addCountry) {
      setAddCountry(homeCountry);
    }
  }, [scope, homeCountry, addCountry]);

  const saveScope = async (next: Scope) => {
    setSaving(true);
    setScope(next);
    const { error } = await (supabase as any)
      .from("stores")
      .update({ default_commercial_scope: next })
      .eq("id", storeId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Portée commerciale enregistrée");
    qc.invalidateQueries({ queryKey: ["vendor-stores"] });
  };

  const resolveCityId = () => {
    const cityOpt = cities.find((c) => c.label === addCity || c.value === addCity);
    const cityId = cityOpt?.id || cityOpt?.value;
    return cityId && String(cityId).includes("-") ? String(cityId) : null;
  };

  const addDestination = async () => {
    const country =
      scope === "country" && homeCountry.length === 2
        ? homeCountry
        : addCountry.toUpperCase();
    if (!country || country.length !== 2) {
      toast.error("Sélectionnez un pays");
      return;
    }
    if ((addMode === "selected_cities" || addMode === "except_cities") && !addCity) {
      toast.error(
        addMode === "except_cities"
          ? "Choisissez au moins une ville à exclure"
          : "Choisissez au moins une ville",
      );
      return;
    }
    setSaving(true);
    const { data, error } = await (supabase as any)
      .from("store_shipping_destinations")
      .upsert(
        {
          store_id: storeId,
          country_code: country,
          mode: addMode,
          active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "store_id,country_code" },
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
        const { error: cityErr } = await (supabase as any)
          .from("store_shipping_destination_cities")
          .upsert({ destination_id: data.id, city_id: cityId }, { onConflict: "destination_id,city_id" });
        if (cityErr) {
          setSaving(false);
          toast.error(cityErr.message);
          return;
        }
      }
    }
    setSaving(false);
    setAddCity("");
    toast.success(
      addMode === "except_cities" ? "Exclusion de ville enregistrée" : "Destination ajoutée",
    );
    qc.invalidateQueries({ queryKey: ["store-shipping-destinations", storeId] });
  };

  const addCityToDestination = async (dest: Destination) => {
    if (!addCity || dest.mode === "whole_country") return;
    if (addCountry && addCountry.toUpperCase() !== dest.country_code) {
      toast.error("Sélectionnez le même pays que la destination");
      return;
    }
    const cityId = resolveCityId();
    if (!cityId) {
      toast.error("Ville invalide");
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any)
      .from("store_shipping_destination_cities")
      .upsert({ destination_id: dest.id, city_id: cityId }, { onConflict: "destination_id,city_id" });
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      setAddCity("");
      toast.success(dest.mode === "except_cities" ? "Ville exclue ajoutée" : "Ville ajoutée");
      qc.invalidateQueries({ queryKey: ["store-shipping-destinations", storeId] });
    }
  };

  const removeDestination = async (id: string) => {
    const { error } = await (supabase as any).from("store_shipping_destinations").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Destination retirée");
      qc.invalidateQueries({ queryKey: ["store-shipping-destinations", storeId] });
    }
  };

  const removeCity = async (destinationId: string, cityId: string) => {
    const { error } = await (supabase as any)
      .from("store_shipping_destination_cities")
      .delete()
      .eq("destination_id", destinationId)
      .eq("city_id", cityId);
    if (error) toast.error(error.message);
    else {
      toast.success("Ville retirée");
      qc.invalidateQueries({ queryKey: ["store-shipping-destinations", storeId] });
    }
  };

  const citiesFor = (destId: string) => cityRows.filter((r: any) => r.destination_id === destId);

  return (
    <div className="space-y-4 border border-border rounded-xl p-4 bg-card">
      <div className="flex items-center gap-2">
        <MapPin size={16} className="text-primary" />
        <h3 className="text-sm font-bold text-foreground">Où souhaitez-vous vendre ?</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Portée commerciale par défaut (distincte du type boutique local/international). Pour un pays
        entier avec zones inaccessibles, utilisez « Tout le pays sauf… ».
      </p>
      <div className="space-y-2">
        {(
          [
            { key: "city" as const, label: "Dans ma ville uniquement" },
            { key: "country" as const, label: "Dans mon pays" },
            { key: "international" as const, label: "À l’international" },
          ] as const
        ).map((opt) => (
          <label
            key={opt.key}
            className="flex items-center gap-3 p-3 rounded-lg border border-border cursor-pointer hover:border-primary/40"
          >
            <input
              type="radio"
              name="commercial_scope"
              checked={scope === opt.key}
              onChange={() => saveScope(opt.key)}
              disabled={saving}
            />
            <span className="text-sm text-foreground">{opt.label}</span>
          </label>
        ))}
      </div>

      {showDestinations && (
        <div className="space-y-3 pt-2 border-t border-border">
          <p className="text-xs font-medium text-foreground">
            {scope === "country"
              ? "Zones dans mon pays (exclusions / villes)"
              : "Destinations d’expédition"}
          </p>
          {scope === "country" && (
            <p className="text-[11px] text-muted-foreground">
              Ex. RDC entière sauf villes non desservies — plus simple que de cocher toutes les villes
              accessibles.
            </p>
          )}
          {homeCountry.length !== 2 && scope === "country" && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Renseignez d’abord le pays ISO de la boutique (réglages géo) pour configurer les
              exclusions nationales.
            </p>
          )}
          {isLoading ? (
            <Loader2 className="animate-spin text-muted-foreground" size={16} />
          ) : (
            <ul className="space-y-2">
              {destinations.map((d) => {
                const list = citiesFor(d.id);
                const names = list.map((c: any) => c.cities?.name || c.city_id);
                return (
                  <li
                    key={d.id}
                    className="flex items-start justify-between gap-2 text-sm border border-border rounded-md p-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">{d.country_code}</p>
                      <p className="text-[11px] text-muted-foreground">{modeLabel(d.mode, names)}</p>
                      {d.mode !== "whole_country" && list.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {list.map((c: any) => (
                            <button
                              key={c.city_id}
                              type="button"
                              className="text-[10px] px-1.5 py-0.5 rounded border border-border hover:border-destructive text-muted-foreground"
                              onClick={() => removeCity(d.id, c.city_id)}
                              title="Retirer"
                            >
                              {(c.cities?.name || c.city_id) + " ×"}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0"
                      onClick={() => removeDestination(d.id)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </li>
                );
              })}
              {destinations.length === 0 && scope === "international" && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Sans destination, l’éligibilité (flag on) se limite au pays de la boutique.
                </p>
              )}
            </ul>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            {scope === "international" && (
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
            )}
            <div className={scope === "country" ? "sm:col-span-2" : ""}>
              <Label className="text-xs">Mode</Label>
              <select
                className="w-full mt-1 px-3 py-2 text-sm bg-card border border-border rounded-md"
                value={addMode}
                onChange={(e) => setAddMode(e.target.value as DestMode)}
              >
                <option value="whole_country">Tout le pays</option>
                <option value="selected_cities">Certaines villes seulement</option>
                <option value="except_cities">Tout le pays sauf… (exclusions)</option>
              </select>
            </div>
          </div>
          {(addMode === "selected_cities" || addMode === "except_cities") &&
            (scope === "international" ? addCountry : homeCountry).length === 2 && (
              <GeoCombobox
                options={cities.map((c) => ({
                  value: c.label || c.value,
                  label: c.label || c.value,
                  id: c.id,
                }))}
                value={addCity}
                onChange={setAddCity}
                label={addMode === "except_cities" ? "Ville à exclure" : "Ville à inclure"}
                placeholder="Sélectionner…"
              />
            )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={addDestination}
              disabled={
                saving ||
                (scope === "international" && !addCountry) ||
                (scope === "country" && homeCountry.length !== 2)
              }
            >
              {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : <Plus size={14} className="mr-1" />}
              {addMode === "except_cities" ? "Enregistrer exclusion" : "Ajouter / mettre à jour"}
            </Button>
            {addCity &&
              destinations.some(
                (d) =>
                  d.mode !== "whole_country" &&
                  d.country_code ===
                    (scope === "country" ? homeCountry : addCountry.toUpperCase()),
              ) && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={saving}
                  onClick={() => {
                    const dest = destinations.find(
                      (d) =>
                        d.country_code ===
                        (scope === "country" ? homeCountry : addCountry.toUpperCase()),
                    );
                    if (dest) void addCityToDestination(dest);
                  }}
                >
                  Ajouter la ville à la liste existante
                </Button>
              )}
          </div>
        </div>
      )}
    </div>
  );
}
