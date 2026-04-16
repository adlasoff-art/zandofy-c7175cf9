import { useState, useEffect } from "react";

interface GeoResult {
  country_code: string;
  country_name: string;
  city: string;
  loading: boolean;
}

/**
 * IP-based geo-detection hook using free ipapi.co service.
 * Falls back to "CD" (RDC) if detection fails.
 */
export function useGeoDetection(): GeoResult {
  const [result, setResult] = useState<GeoResult>({
    country_code: "",
    country_name: "",
    city: "",
    loading: true,
  });

  useEffect(() => {
    // Check shared cache key (may have been set by use-analytics.ts)
    const cached = sessionStorage.getItem("zandofy_geo");
    if (cached) {
      try {
        setResult({ ...JSON.parse(cached), loading: false });
        return;
      } catch { /* ignore */ }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    fetch("https://ipapi.co/json/", { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const geo = {
          country_code: data.country_code || "CD",
          country_name: data.country_name || "Congo (RDC)",
          city: data.city || "",
        };
        sessionStorage.setItem("zandofy_geo", JSON.stringify(geo));
        setResult({ ...geo, loading: false });
      })
      .catch(() => {
        setResult({
          country_code: "CD",
          country_name: "Congo (RDC)",
          city: "",
          loading: false,
        });
      })
      .finally(() => clearTimeout(timeoutId));

    return () => controller.abort();
  }, []);

  return result;
}
