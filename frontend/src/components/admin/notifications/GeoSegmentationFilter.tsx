import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MapPin } from "lucide-react";

interface GeoFilter {
  country: string;
  province: string;
  city: string;
  commune: string;
  quartier: string;
}

interface GeoSegmentationFilterProps {
  value: GeoFilter;
  onChange: (filter: GeoFilter) => void;
}

const db = supabase as any;

export function GeoSegmentationFilter({ value, onChange }: GeoSegmentationFilterProps) {
  const [provinces, setProvinces] = useState<{ value: string; label: string }[]>([]);
  const [cities, setCities] = useState<{ value: string; label: string }[]>([]);
  const [communes, setCommunes] = useState<{ value: string; label: string }[]>([]);
  const [quartiers, setQuartiers] = useState<{ value: string; label: string }[]>([]);

  const countries = [
    { value: "CD", label: "🇨🇩 RD Congo" },
    { value: "CG", label: "🇨🇬 Congo-Brazzaville" },
    { value: "CM", label: "🇨🇲 Cameroun" },
    { value: "CI", label: "🇨🇮 Côte d'Ivoire" },
    { value: "SN", label: "🇸🇳 Sénégal" },
  ];

  useEffect(() => {
    if (!value.country) { setProvinces([]); return; }
    db.from("provinces").select("id, name").eq("country_code", value.country).order("name")
      .then(({ data }: any) => setProvinces((data || []).map((p: any) => ({ value: p.id, label: p.name }))));
  }, [value.country]);

  useEffect(() => {
    if (!value.country) { setCities([]); return; }
    let q = db.from("cities").select("id, name").eq("country_code", value.country).order("name").limit(500);
    if (value.province) q = q.eq("province_id", value.province);
    q.then(({ data }: any) => setCities((data || []).map((c: any) => ({ value: c.name, label: c.name }))));
  }, [value.country, value.province]);

  useEffect(() => {
    if (!value.city || !value.country) { setCommunes([]); return; }
    db.from("communes").select("id, name").eq("city", value.city).eq("country_code", value.country).eq("is_active", true).order("name")
      .then(({ data }: any) => setCommunes((data || []).map((c: any) => ({ value: c.name, label: c.name }))));
  }, [value.city, value.country]);

  useEffect(() => {
    if (!value.commune) { setQuartiers([]); return; }
    const communeObj = communes.find(c => c.value === value.commune);
    if (!communeObj) return;
    // Find commune ID from communes table
    db.from("communes").select("id").eq("name", value.commune).eq("country_code", value.country).limit(1)
      .then(({ data }: any) => {
        if (data?.[0]) {
          db.from("quartiers").select("id, name").eq("commune_id", data[0].id).eq("is_active", true).order("name")
            .then(({ data: qData }: any) => setQuartiers((qData || []).map((q: any) => ({ value: q.name, label: q.name }))));
        }
      });
  }, [value.commune, value.country, communes]);

  const set = (key: keyof GeoFilter, val: string) => {
    const next = { ...value, [key]: val };
    // Reset dependent fields
    if (key === "country") { next.province = ""; next.city = ""; next.commune = ""; next.quartier = ""; }
    if (key === "province") { next.city = ""; next.commune = ""; next.quartier = ""; }
    if (key === "city") { next.commune = ""; next.quartier = ""; }
    if (key === "commune") { next.quartier = ""; }
    onChange(next);
  };

  const selectClass = "w-full px-2.5 py-1.5 bg-muted border border-border rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-primary/30";

  const hasAnyGeo = value.country || value.province || value.city || value.commune || value.quartier;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <MapPin size={12} />
        <span>Segmentation géographique</span>
        {hasAnyGeo && (
          <button
            type="button"
            onClick={() => onChange({ country: "", province: "", city: "", commune: "", quartier: "" })}
            className="text-[10px] text-primary hover:underline ml-auto"
          >
            Réinitialiser
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <select value={value.country} onChange={(e) => set("country", e.target.value)} className={selectClass}>
          <option value="">Tous les pays</option>
          {countries.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>

        <select value={value.province} onChange={(e) => set("province", e.target.value)} className={selectClass} disabled={!value.country}>
          <option value="">Toutes provinces</option>
          {provinces.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>

        <select value={value.city} onChange={(e) => set("city", e.target.value)} className={selectClass} disabled={!value.country}>
          <option value="">Toutes villes</option>
          {cities.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>

        <select value={value.commune} onChange={(e) => set("commune", e.target.value)} className={selectClass} disabled={!value.city}>
          <option value="">Toutes communes</option>
          {communes.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>

        <select value={value.quartier} onChange={(e) => set("quartier", e.target.value)} className={selectClass} disabled={!value.commune}>
          <option value="">Tous quartiers</option>
          {quartiers.map((q) => <option key={q.value} value={q.value}>{q.label}</option>)}
        </select>
      </div>
    </div>
  );
}

export type { GeoFilter };
