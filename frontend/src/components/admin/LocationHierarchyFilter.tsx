import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CountryCombobox } from "@/components/vendor/CountryCombobox";
import { Label } from "@/components/ui/label";

export interface LocationFilters {
  country?: string;
  province?: string;
  city?: string;
  commune?: string;
  quartier?: string;
}

interface Props {
  value: LocationFilters;
  onChange: (filters: LocationFilters) => void;
  /** Show only certain levels */
  levels?: ("country" | "province" | "city" | "commune" | "quartier")[];
}

interface Option { id: string; name: string }

export function LocationHierarchyFilter({
  value,
  onChange,
  levels = ["country", "province", "city", "commune", "quartier"],
}: Props) {
  const [provinces, setProvinces] = useState<Option[]>([]);
  const [cities, setCities] = useState<Option[]>([]);
  const [communes, setCommunes] = useState<Option[]>([]);
  const [quartiers, setQuartiers] = useState<Option[]>([]);

  // Load provinces when country changes
  useEffect(() => {
    if (!value.country || !levels.includes("province")) { setProvinces([]); return; }
    const fetchProvinces = async () => {
      const { data } = await (supabase as any).from("provinces").select("id, name")
        .eq("country_code", value.country)
        .eq("is_active", true)
        .order("name");
      setProvinces((data || []) as Option[]);
    };
    fetchProvinces();
  }, [value.country]);

  // Load cities when province or country changes
  useEffect(() => {
    if (!value.country || !levels.includes("city")) { setCities([]); return; }
    let q = supabase.from("cities").select("id, name").eq("country_code", value.country).order("name").limit(500);
    if (value.province) q = q.eq("province_id" as any, value.province);
    q.then(({ data }) => setCities((data || []).map((d: any) => ({ id: d.name, name: d.name }))));
  }, [value.country, value.province]);

  // Load communes when city changes
  useEffect(() => {
    if (!value.city || !levels.includes("commune")) { setCommunes([]); return; }
    (supabase as any).from("communes").select("id, name")
      .eq("city", value.city)
      .eq("country_code", value.country || "CD")
      .order("name")
      .then(({ data }: any) => setCommunes((data || []) as Option[]));
  }, [value.city, value.country]);

  // Load quartiers when commune changes
  useEffect(() => {
    if (!value.commune || !levels.includes("quartier")) { setQuartiers([]); return; }
    (supabase as any).from("quartiers").select("id, name")
      .eq("commune_id", value.commune)
      .order("name")
      .then(({ data }: any) => setQuartiers((data || []) as Option[]));
  }, [value.commune]);

  const update = (key: keyof LocationFilters, val: string) => {
    const next = { ...value, [key]: val || undefined };
    // Clear children
    if (key === "country") { delete next.province; delete next.city; delete next.commune; delete next.quartier; }
    if (key === "province") { delete next.city; delete next.commune; delete next.quartier; }
    if (key === "city") { delete next.commune; delete next.quartier; }
    if (key === "commune") { delete next.quartier; }
    onChange(next);
  };

  const selectClass = "w-full px-3 py-2 text-sm border border-input rounded-md bg-background";

  return (
    <div className="flex items-end gap-3 flex-wrap">
      {levels.includes("country") && (
        <div className="w-40">
          <CountryCombobox
            value={value.country || ""}
            onChange={(v) => update("country", v)}
            label="Pays"
            showNone
          />
        </div>
      )}

      {levels.includes("province") && value.country && (
        <div className="w-40">
          <Label className="text-xs text-muted-foreground">Province</Label>
          <select className={selectClass} value={value.province || ""} onChange={(e) => update("province", e.target.value)}>
            <option value="">Toutes</option>
            {provinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}

      {levels.includes("city") && value.country && (
        <div className="w-40">
          <Label className="text-xs text-muted-foreground">Ville</Label>
          <select className={selectClass} value={value.city || ""} onChange={(e) => update("city", e.target.value)}>
            <option value="">Toutes</option>
            {cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      {levels.includes("commune") && value.city && (
        <div className="w-40">
          <Label className="text-xs text-muted-foreground">Commune</Label>
          <select className={selectClass} value={value.commune || ""} onChange={(e) => update("commune", e.target.value)}>
            <option value="">Toutes</option>
            {communes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}

      {levels.includes("quartier") && value.commune && (
        <div className="w-40">
          <Label className="text-xs text-muted-foreground">Quartier</Label>
          <select className={selectClass} value={value.quartier || ""} onChange={(e) => update("quartier", e.target.value)}>
            <option value="">Tous</option>
            {quartiers.map((q) => <option key={q.id} value={q.id}>{q.name}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}
