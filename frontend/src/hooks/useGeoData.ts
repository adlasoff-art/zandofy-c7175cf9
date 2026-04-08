/**
 * Hook to fetch admin-managed geographic data from Supabase
 * with cascading filters: Country → Province → City → Commune → Quartier
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface GeoOption {
  value: string;
  label: string;
}

interface GeoOptionWithId extends GeoOption {
  id?: string; // underlying UUID when value is a name
}

interface UseGeoDataReturn {
  provinces: GeoOption[];
  cities: GeoOption[];
  communes: GeoOptionWithId[];
  quartiers: GeoOption[];
  loading: boolean;
}

const db = supabase as any;

export function useGeoData(
  countryCode: string,
  provinceId: string,
  cityName: string,
  communeId: string
): UseGeoDataReturn {
  const [provinces, setProvinces] = useState<GeoOption[]>([]);
  const [cities, setCities] = useState<GeoOption[]>([]);
  const [communes, setCommunes] = useState<GeoOptionWithId[]>([]);
  const [quartiers, setQuartiers] = useState<GeoOption[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch provinces for selected country
  useEffect(() => {
    if (!countryCode) { setProvinces([]); return; }
    setLoading(true);
    db.from("provinces")
      .select("id, name")
      .eq("country_code", countryCode)
      .order("name")
      .then(({ data }: any) => {
        setProvinces((data || []).map((p: any) => ({ value: p.id, label: p.name })));
        setLoading(false);
      });
  }, [countryCode]);

  // Fetch cities for selected province (or country if no province) — only active cities
  useEffect(() => {
    if (!countryCode) { setCities([]); return; }
    let q = db.from("cities").select("id, name").eq("country_code", countryCode).eq("is_active", true).order("name").limit(500);
    if (provinceId) {
      q = q.eq("province_id", provinceId);
    }
    q.then(({ data }: any) => {
      setCities((data || []).map((c: any) => ({ value: c.name, label: c.name })));
    });
  }, [countryCode, provinceId]);

  // Fetch communes for selected city
  useEffect(() => {
    if (!cityName || !countryCode) { setCommunes([]); return; }
    db.from("communes")
      .select("id, name")
      .eq("city", cityName)
      .eq("country_code", countryCode)
      .eq("is_active", true)
      .order("name")
      .then(({ data }: any) => {
        setCommunes((data || []).map((c: any) => ({ value: c.name, label: c.name, id: c.id })));
      });
  }, [cityName, countryCode]);

  // Fetch quartiers for selected commune (by commune UUID)
  useEffect(() => {
    if (!communeId) { setQuartiers([]); return; }
    db.from("quartiers")
      .select("id, name, is_restricted")
      .eq("commune_id", communeId)
      .eq("is_active", true)
      .order("name")
      .then(({ data }: any) => {
        setQuartiers(
          (data || [])
            .filter((q: any) => !q.is_restricted)
            .map((q: any) => ({ value: q.name, label: q.name }))
        );
      });
  }, [communeId]);

  return { provinces, cities, communes, quartiers, loading };
}
