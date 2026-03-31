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

interface UseGeoDataReturn {
  provinces: GeoOption[];
  cities: GeoOption[];
  communes: GeoOption[];
  quartiers: GeoOption[];
  loading: boolean;
}

export function useGeoData(
  countryCode: string,
  provinceId: string,
  cityName: string,
  communeName: string
): UseGeoDataReturn {
  const [provinces, setProvinces] = useState<GeoOption[]>([]);
  const [cities, setCities] = useState<GeoOption[]>([]);
  const [communes, setCommunes] = useState<GeoOption[]>([]);
  const [quartiers, setQuartiers] = useState<GeoOption[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch provinces for selected country
  useEffect(() => {
    if (!countryCode) { setProvinces([]); return; }
    setLoading(true);
    supabase
      .from("provinces")
      .select("id, name")
      .eq("country_code", countryCode)
      .order("name")
      .then(({ data }) => {
        setProvinces((data || []).map((p: any) => ({ value: p.id, label: p.name })));
        setLoading(false);
      });
  }, [countryCode]);

  // Fetch cities for selected province (or country if no province)
  useEffect(() => {
    if (!countryCode) { setCities([]); return; }
    let q = supabase.from("cities").select("id, name").eq("country_code", countryCode).order("name").limit(500);
    if (provinceId) {
      q = q.eq("province_id", provinceId);
    }
    q.then(({ data }) => {
      setCities((data || []).map((c: any) => ({ value: c.name, label: c.name })));
    });
  }, [countryCode, provinceId]);

  // Fetch communes for selected city
  useEffect(() => {
    if (!cityName || !countryCode) { setCommunes([]); return; }
    supabase
      .from("communes")
      .select("id, name")
      .eq("city", cityName)
      .eq("country_code", countryCode)
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => {
        setCommunes((data || []).map((c: any) => ({ value: c.name, label: c.name })));
      });
  }, [cityName, countryCode]);

  // Fetch quartiers for selected commune+city
  useEffect(() => {
    if (!communeName || !cityName) { setQuartiers([]); return; }
    (supabase as any)
      .from("quartiers")
      .select("id, name, is_restricted")
      .eq("commune", communeName)
      .eq("city", cityName)
      .eq("is_active", true)
      .order("name")
      .then(({ data }: any) => {
        setQuartiers(
          (data || [])
            .filter((q: any) => !q.is_restricted)
            .map((q: any) => ({ value: q.name, label: q.name }))
        );
      });
  }, [communeName, cityName]);

  return { provinces, cities, communes, quartiers, loading };
}
