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

    // Skip network call unless geo-detection is explicitly required (e.g. at checkout).
    // This avoids ~1.5s of blocking I/O on the home page for 99% of visitors.
    const needed = sessionStorage.getItem("zandofy_geo_needed") === "1";
    if (!needed) {
      setResult({
        country_code: "CD",
        country_name: "Congo (RDC)",
        city: "",
        loading: false,
      });
      return;
    }

    const controller = new AbortController();
    let timeoutId: any;
    const run = () => {
      timeoutId = setTimeout(() => controller.abort(), 4000);
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
    };

    // Defer geo IP lookup until browser is idle to avoid blocking first paint.
    const w = window as any;
    let idleId: any;
    if (typeof w.requestIdleCallback === "function") {
      idleId = w.requestIdleCallback(run, { timeout: 1500 });
    } else {
      idleId = setTimeout(run, 0);
    }

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
      if (typeof w.cancelIdleCallback === "function") w.cancelIdleCallback(idleId);
      else clearTimeout(idleId);
    };
  }, []);

  return result;
}
