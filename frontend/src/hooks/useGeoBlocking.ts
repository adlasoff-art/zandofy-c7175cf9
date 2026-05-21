import { useEffect, useState } from "react";
import { useGeoDetection } from "@/hooks/use-geo-detection";
import { useBootstrapSetting } from "@/hooks/use-platform-bootstrap";

/**
 * Geo-blocking hook — checks if the visitor's country is in the admin-configured block list.
 * Reads block list from the shared platform-bootstrap cache (no extra request).
 * Fail-open: if anything fails, the user is NOT blocked.
 */
export function useGeoBlocking() {
  const geo = useGeoDetection();
  const { value, isLoading } = useBootstrapSetting<{ blocked?: string[] }>(
    "geo_blocked_countries"
  );

  // Fail-open while bootstrap loads: empty list until settings arrive (never blank the whole app).
  const blockedCountries = (value?.blocked ?? []).map((c) => c.toUpperCase());
  const loading = geo.loading;
  const blocked =
    !loading &&
    !isLoading &&
    geo.country_code !== "" &&
    blockedCountries.length > 0 &&
    blockedCountries.includes(geo.country_code.toUpperCase());

  return { blocked, loading, countryCode: geo.country_code };
}
