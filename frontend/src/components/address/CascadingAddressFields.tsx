/**
 * Cascading address fields that pull from admin-managed geographic data.
 * Order: Pays → Province → Ville → Commune → Quartier → Adresse manuelle
 */
import { useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { CountryCombobox } from "@/components/vendor/CountryCombobox";
import { GeoCombobox } from "./GeoCombobox";
import { useGeoData } from "@/hooks/useGeoData";

interface AddressData {
  country: string;
  province: string;    // province name (stored as text)
  province_id: string; // province UUID for cascading
  city: string;
  commune: string;
  quartier: string;
  address: string;     // manual: N° parcelle, appartement, Avenue/Rue
  postal_code: string;
}

interface CascadingAddressFieldsProps {
  data: AddressData;
  onChange: (field: keyof AddressData, value: string) => void;
  showPostalCode?: boolean;
}

export function CascadingAddressFields({ data, onChange, showPostalCode = true }: CascadingAddressFieldsProps) {
  const { provinces, cities, communes, quartiers } = useGeoData(
    data.country,
    data.province_id,
    data.city,
    data.commune
  );

  // Reset dependent fields when parent changes
  useEffect(() => {
    // When country changes, reset province and below
  }, [data.country]);

  const handleCountryChange = (v: string) => {
    onChange("country", v);
    onChange("province", "");
    onChange("province_id", "");
    onChange("city", "");
    onChange("commune", "");
    onChange("quartier", "");
  };

  const handleProvinceChange = (v: string) => {
    onChange("province_id", v);
    const prov = provinces.find(p => p.value === v);
    onChange("province", prov?.label || "");
    onChange("city", "");
    onChange("commune", "");
    onChange("quartier", "");
  };

  const handleCityChange = (v: string) => {
    onChange("city", v);
    onChange("commune", "");
    onChange("quartier", "");
  };

  const handleCommuneChange = (v: string) => {
    onChange("commune", v);
    onChange("quartier", "");
  };

  return (
    <div className="space-y-3">
      {/* 1. Country */}
      <CountryCombobox
        value={data.country}
        onChange={handleCountryChange}
        label="Pays *"
        placeholder="Sélectionner un pays..."
        showNone={false}
      />

      {/* 2. Province + City */}
      <div className="grid grid-cols-2 gap-3">
        <GeoCombobox
          options={provinces}
          value={data.province_id}
          onChange={handleProvinceChange}
          label="Province / État"
          placeholder="Province..."
          disabled={!data.country || provinces.length === 0}
        />
        <GeoCombobox
          options={cities}
          value={data.city}
          onChange={handleCityChange}
          label="Ville *"
          placeholder="Ville..."
          disabled={!data.country || cities.length === 0}
        />
      </div>

      {/* 3. Commune + Quartier */}
      <div className="grid grid-cols-2 gap-3">
        <GeoCombobox
          options={communes}
          value={data.commune}
          onChange={handleCommuneChange}
          label="Commune / Département"
          placeholder="Commune..."
          disabled={!data.city || communes.length === 0}
        />
        <GeoCombobox
          options={quartiers}
          value={data.quartier}
          onChange={(v) => onChange("quartier", v)}
          label="Quartier / Bloc"
          placeholder="Quartier..."
          disabled={!data.commune || quartiers.length === 0}
        />
      </div>

      {/* 4. Manual address */}
      <div>
        <Label className="text-xs">Adresse *</Label>
        <Input
          className="mt-1"
          value={data.address}
          onChange={(e) => onChange("address", e.target.value)}
          placeholder="N° parcelle, N° appartement, Avenue/Rue"
        />
      </div>

      {showPostalCode && (
        <div className="max-w-[200px]">
          <Label className="text-xs">Code postal</Label>
          <Input
            className="mt-1"
            value={data.postal_code}
            onChange={(e) => onChange("postal_code", e.target.value)}
          />
        </div>
      )}
    </div>
  );
}

export type { AddressData };
