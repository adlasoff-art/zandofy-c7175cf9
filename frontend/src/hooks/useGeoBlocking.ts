import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGeoDetection } from "@/hooks/use-geo-detection";

/**
 * Geo-blocking hook — checks if the visitor's country is in the admin-configured block list.
 * Returns { blocked, loading, countryCode }.
 * IMPORTANT: fail-open — if settings can't be loaded, the user is NOT blocked.
 */
export function useGeoBlocking() {
  const geo = useGeoDetection();
  const [blockedCountries, setBlockedCountries] = useState<string[]>([]);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "geo_blocked_countries")
      .maybeSingle()
      .then(({ data }) => {
        const val = data?.value as any;
        if (val?.blocked && Array.isArray(val.blocked)) {
          setBlockedCountries(val.blocked.map((c: string) => c.toUpperCase()));
        }
      })
      .catch(() => {
        // Fail-open: if we can't read settings, don't block anyone
        console.warn("[GeoBlocking] Failed to load geo settings, failing open");
      })
      .finally(() => {
        setSettingsLoaded(true);
      });
  }, []);

  const loading = geo.loading || !settingsLoaded;
  const blocked =
    !loading &&
    geo.country_code !== "" &&
    blockedCountries.length > 0 &&
    blockedCountries.includes(geo.country_code.toUpperCase());

  return { blocked, loading, countryCode: geo.country_code };
}
