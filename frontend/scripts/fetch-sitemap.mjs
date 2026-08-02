/**
 * Prefetch generate-sitemap into public/sitemap.xml before Vite build.
 * Needed because Vercel serves this app as static `dist/` (framework: null):
 * /api/* and external rewrites fall through to the SPA HTML — GSC then sees "sitemap is HTML".
 */
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, "..", "public", "sitemap.xml");

const SITEMAP_URL =
  process.env.SITEMAP_FUNCTION_URL?.trim() ||
  `${(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://vpttoqojmiqxgudknyxf.supabase.co").replace(/\/$/, "")}/functions/v1/generate-sitemap`;

const FALLBACK = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://zandofy.com/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>
  <url><loc>https://zandofy.com/stores</loc><changefreq>daily</changefreq><priority>0.9</priority></url>
  <url><loc>https://zandofy.com/about</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://zandofy.com/help-center</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>
</urlset>
`;

async function main() {
  console.log("[fetch-sitemap] GET", SITEMAP_URL);
  let body = FALLBACK;
  try {
    const res = await fetch(SITEMAP_URL, {
      headers: { Accept: "application/xml,text/xml,*/*" },
    });
    const text = await res.text();
    if (res.ok && text.includes("<urlset")) {
      body = text;
    } else {
      console.error("[fetch-sitemap] upstream failed", res.status, text.slice(0, 300));
      console.warn("[fetch-sitemap] using FALLBACK hubs-only sitemap");
    }
  } catch (err) {
    console.error("[fetch-sitemap] fetch error", err);
    console.warn("[fetch-sitemap] using FALLBACK hubs-only sitemap");
  }

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, body, "utf8");
  const urls = (body.match(/<loc>/g) || []).length;
  console.log("[fetch-sitemap] wrote", outPath, "—", urls, "URLs");
}

main().catch((err) => {
  console.error("[fetch-sitemap]", err);
  process.exit(1);
});
