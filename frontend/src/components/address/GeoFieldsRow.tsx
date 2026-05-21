/**
 * GeoFieldsRow — Composant standardisé pour les champs géographiques compacts.
 *
 * Règle plateforme (Phase 10.3) : tout formulaire qui demande Pays / Province /
 * Ville / Commune / Quartier DOIT utiliser des comboboxes connectés aux Zones
 * Géographiques admin (`countries`, `provinces`, `cities`, `communes`,
 * `quartiers`). La saisie libre est interdite — sauf le texte d'adresse manuel
 * géré par CascadingAddressFields.
 *
 * Ce wrapper est destiné aux formulaires courts (plafonds, tarifs, zones d'expédition)
 * où on veut une seule ligne de champs configurables.
 */
import { useEffect, useMemo, useState } from "react";
import { CountryCombobox } from "@/components/vendor/CountryCombobox";
import { GeoCombobox } from "./GeoCombobox";
import { useGeoData } from "@/hooks/useGeoData";
import { useActiveGeo } from "@/hooks/useActiveGeo";
import { AlertTriangle } from "lucide-react";

export type GeoLevel = "country" | "province" | "city" | "commune" | "quartier";

export interface GeoFieldsValue {
  country?: string;        // ISO code (ex: "CD")
  province?: string;       // province name (display / persisted as text)
  province_id?: string;    // UUID for cascade
  city?: string;           // city name (persisted as text)
  commune?: string;        // commune name
  quartier?: string;       // quartier name
}

interface GeoFieldsRowProps {
  value: GeoFieldsValue;
  onChange: (patch: Partial<GeoFieldsValue>) => void;
  levels?: GeoLevel[];
  /** Affichage en grille horizontale (default) ou empilée. */
  layout?: "grid" | "stack";
  /** Restreint le combobox pays au sous-ensemble fourni (ex: ["CN","TR","AE","CD"]). */
  allowedCountries?: string[];
  /** Désactive entièrement le composant. */
  disabled?: boolean;
  /** Ajoute "*" sur le label des niveaux passés. */
  required?: GeoLevel[];
  /** Override des labels. */
  labels?: Partial<Record<GeoLevel, string>>;
}

const DEFAULT_LABELS: Record<GeoLevel, string> = {
  country: "Pays",
  province: "Province",
  city: "Ville",
  commune: "Commune",
  quartier: "Quartier",
};

export function GeoFieldsRow({
  value,
  onChange,
  levels = ["country", "city"],
  layout = "grid",
  allowedCountries,
  disabled,
  required = [],
  labels,
}: GeoFieldsRowProps) {
  const { activeCountryCodes } = useActiveGeo();
  const [communeUuid, setCommuneUuid] = useState("");

  const { provinces, cities, communes, quartiers } = useGeoData(
    value.country || "",
    value.province_id || "",
    value.city || "",
    communeUuid
  );

  // Resolve commune UUID when commune name is set externally
  useEffect(() => {
    if (value.commune && communes.length > 0) {
      const match = communes.find((c) => c.label === value.commune || c.value === value.commune);
      if (match?.id && match.id !== communeUuid) setCommuneUuid(match.id);
    } else if (!value.commune && communeUuid) {
      setCommuneUuid("");
    }
  }, [value.commune, communes]);

  const allowed = useMemo(() => {
    if (!allowedCountries) return activeCountryCodes;
    return activeCountryCodes.filter((c) => allowedCountries.includes(c));
  }, [allowedCountries, activeCountryCodes]);

  const lbl = (k: GeoLevel) => {
    const base = labels?.[k] ?? DEFAULT_LABELS[k];
    return required.includes(k) ? `${base} *` : base;
  };

  const handleCountry = (v: string) => {
    onChange({ country: v, province: "", province_id: "", city: "", commune: "", quartier: "" });
    setCommuneUuid("");
  };
  const handleProvince = (v: string) => {
    const prov = provinces.find((p) => p.value === v);
    onChange({ province_id: v, province: prov?.label || "", city: "", commune: "", quartier: "" });
    setCommuneUuid("");
  };
  const handleCity = (v: string) => {
    onChange({ city: v, commune: "", quartier: "" });
    setCommuneUuid("");
  };
  const handleCommune = (v: string) => {
    const match = communes.find((c) => c.value === v);
    setCommuneUuid(match?.id || "");
    onChange({ commune: v, quartier: "" });
  };

  // Warn if a country is selected but no province/city configured
  const showCountryEmptyHint =
    !!value.country &&
    levels.includes("city") &&
    cities.length === 0 &&
    (!levels.includes("province") || provinces.length === 0);

  const cols = Math.min(levels.length, 4);
  const wrapClass =
    layout === "stack"
      ? "space-y-3"
      : `grid gap-3 grid-cols-1 sm:grid-cols-2 ${cols >= 3 ? "md:grid-cols-3" : ""} ${cols >= 4 ? "lg:grid-cols-4" : ""}`;

  return (
    <div className="space-y-2">
      <div className={wrapClass}>
        {levels.includes("country") && (
          <CountryCombobox
            value={value.country || ""}
            onChange={handleCountry}
            label={lbl("country")}
            placeholder="Sélectionner un pays..."
            showNone={false}
            allowedCodes={allowed}
          />
        )}

        {levels.includes("province") && (
          <GeoCombobox
            options={provinces}
            value={value.province_id || ""}
            onChange={handleProvince}
            label={lbl("province")}
            placeholder="Province..."
            disabled={disabled || !value.country || provinces.length === 0}
          />
        )}

        {levels.includes("city") && (
          <GeoCombobox
            options={cities}
            value={value.city || ""}
            onChange={handleCity}
            label={lbl("city")}
            placeholder="Ville..."
            disabled={disabled || !value.country || cities.length === 0}
          />
        )}

        {levels.includes("commune") && (
          <GeoCombobox
            options={communes}
            value={value.commune || ""}
            onChange={handleCommune}
            label={lbl("commune")}
            placeholder="Commune..."
            disabled={disabled || !value.city || communes.length === 0}
          />
        )}

        {levels.includes("quartier") && (
          <GeoCombobox
            options={quartiers}
            value={value.quartier || ""}
            onChange={(v) => onChange({ quartier: v })}
            label={lbl("quartier")}
            placeholder="Quartier..."
            disabled={disabled || !communeUuid || quartiers.length === 0}
          />
        )}
      </div>

      {showCountryEmptyHint && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          Aucune ville configurée pour ce pays. Demandez à un admin d'ajouter des villes via{" "}
          <span className="font-medium">Zones Géographiques</span>.
        </p>
      )}
    </div>
  );
}