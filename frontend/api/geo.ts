/**
 * Lightweight geo hint from Cloudflare / Vercel edge headers.
 * Prefer CF-IPCountry over client ipapi for analytics country codes.
 */
export const config = { runtime: "edge" };

const COUNTRY_NAMES: Record<string, string> = {
  CD: "RD Congo",
  CG: "Congo",
  FR: "France",
  BE: "Belgique",
  CA: "Canada",
  US: "États-Unis",
  CN: "Chine",
  AE: "Émirats arabes unis",
  SN: "Sénégal",
  CI: "Côte d'Ivoire",
  CM: "Cameroun",
  GA: "Gabon",
  RW: "Rwanda",
  BI: "Burundi",
  UG: "Ouganda",
  KE: "Kenya",
  TZ: "Tanzanie",
  ZA: "Afrique du Sud",
  GB: "Royaume-Uni",
  DE: "Allemagne",
};

export default async function handler(req: Request): Promise<Response> {
  const cf = req.headers.get("cf-ipcountry") || req.headers.get("CF-IPCountry");
  const vercel = req.headers.get("x-vercel-ip-country");
  const code = (cf || vercel || "").toUpperCase().trim();
  // Cloudflare uses XX for unknown, T1 for Tor
  const valid = code && code !== "XX" && code !== "T1";
  const country_code = valid ? code : "";
  const country_name = country_code ? COUNTRY_NAMES[country_code] || country_code : "";

  return new Response(
    JSON.stringify({
      country_code,
      country: country_name,
      country_name,
      city: "",
      source: cf ? "cf" : vercel ? "vercel" : "none",
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=1800",
      },
    },
  );
}
