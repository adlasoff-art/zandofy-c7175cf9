import { useState, useEffect } from "react";

interface GeoResult {
  country_code: string;
  country_name: string;
  city: string;
  loading: boolean;
}

/**
 * Geo detection: prefer /api/geo (CF-IPCountry / Vercel).
 * Do not invent RDC for analytics; CD default only when geo is explicitly needed (checkout).
 */
export function useGeoDetection(): GeoResult {
  const [result, setResult] = useState<GeoResult>({
    country_code: "",
    country_name: "",
    city: "",
    loading: true,
  });

  useEffect(() => {
    const cached = sessionStorage.getItem("zandofy_geo");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.country_code || parsed.country_name) {
          setResult({
            country_code: parsed.country_code || "",
            country_name: parsed.country_name || parsed.country || "",
            city: parsed.city || "",
            loading: false,
          });
          return;
        }
      } catch {
        /* ignore */
      }
    }

    const needed = sessionStorage.getItem("zandofy_geo_needed") === "1";
    const controller = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const run = () => {
      timeoutId = setTimeout(() => controller.abort(), 4000);
      fetch("/api/geo", { signal: controller.signal, credentials: "same-origin" })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => {
          if (data.country_code) {
            const geo = {
              country_code: data.country_code,
              country_name: data.country_name || data.country || data.country_code,
              city: data.city || "",
              source: data.source || "cf",
            };
            sessionStorage.setItem("zandofy_geo", JSON.stringify(geo));
            setResult({
              country_code: geo.country_code,
              country_name: geo.country_name,
              city: geo.city,
              loading: false,
            });
            return;
          }
          throw new Error("no country");
        })
        .catch(() => {
          if (needed) {
            setResult({
              country_code: "CD",
              country_name: "Congo (RDC)",
              city: "",
              loading: false,
            });
          } else {
            setResult({
              country_code: "",
              country_name: "",
              city: "",
              loading: false,
            });
          }
        })
        .finally(() => {
          if (timeoutId) clearTimeout(timeoutId);
        });
    };

    const w = window as any;
    let idleId: any;
    if (typeof w.requestIdleCallback === "function") {
      idleId = w.requestIdleCallback(run, { timeout: 1500 });
    } else {
      idleId = setTimeout(run, 0);
    }

    return () => {
      controller.abort();
      if (timeoutId) clearTimeout(timeoutId);
      if (typeof w.cancelIdleCallback === "function") w.cancelIdleCallback(idleId);
      else clearTimeout(idleId);
    };
  }, []);

  return result;
}
