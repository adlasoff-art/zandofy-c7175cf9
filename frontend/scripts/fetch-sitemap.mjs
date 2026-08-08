/**
 * Prefetch segmented sitemaps into public/ before Vite build.
 * Needed because Vercel serves this app as static `dist/` (framework: null):
 * /api/* and external rewrites fall through to the SPA HTML — GSC then sees "sitemap is HTML".
 *
 * Writes:
 *   sitemap.xml              (sitemapindex)
 *   sitemap-products.xml
 *   sitemap-categories.xml
 *   sitemap-vendors.xml
 *   sitemap-pages.xml
 *   sitemap-blog.xml
 *
 * Cron (ops): hit generate-sitemap daily, then trigger Vercel rebuild — see SEO playbook.
 */
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");

const BASE =
  process.env.SITEMAP_FUNCTION_URL?.trim() ||
  `${(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://vpttoqojmiqxgudknyxf.supabase.co").replace(/\/$/, "")}/functions/v1/generate-sitemap`;

const PARTS = [
  { part: "index", file: "sitemap.xml", mustInclude: "<sitemapindex" },
  { part: "products", file: "sitemap-products.xml", mustInclude: "<urlset" },
  { part: "categories", file: "sitemap-categories.xml", mustInclude: "<urlset" },
  { part: "vendors", file: "sitemap-vendors.xml", mustInclude: "<urlset" },
  { part: "pages", file: "sitemap-pages.xml", mustInclude: "<urlset" },
  { part: "blog", file: "sitemap-blog.xml", mustInclude: "<urlset" },
];

const FALLBACK_INDEX = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://zandofy.com/sitemap-pages.xml</loc></sitemap>
</sitemapindex>
`;

const FALLBACK_PAGES = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://zandofy.com/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>
  <url><loc>https://zandofy.com/stores</loc><changefreq>daily</changefreq><priority>0.9</priority></url>
  <url><loc>https://zandofy.com/about</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>
  <url><loc>https://zandofy.com/help-center</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>
</urlset>
`;

function partUrl(part) {
  const u = new URL(BASE);
  u.searchParams.set("part", part);
  return u.toString();
}

async function fetchPart(part, mustInclude) {
  const url = partUrl(part);
  console.log("[fetch-sitemap] GET", url);
  const res = await fetch(url, {
    headers: { Accept: "application/xml,text/xml,*/*" },
  });
  const text = await res.text();
  if (!res.ok || !text.includes(mustInclude)) {
    throw new Error(`upstream ${part} failed ${res.status}: ${text.slice(0, 200)}`);
  }
  if (text.includes("/search")) {
    console.warn(`[fetch-sitemap] WARNING: ${part} contains /search — should be excluded`);
  }
  return text;
}

async function main() {
  await mkdir(publicDir, { recursive: true });
  let usedFallback = false;

  for (const { part, file, mustInclude } of PARTS) {
    const outPath = join(publicDir, file);
    let body;
    try {
      body = await fetchPart(part, mustInclude);
    } catch (err) {
      console.error("[fetch-sitemap]", err.message || err);
      usedFallback = true;
      if (part === "index") body = FALLBACK_INDEX;
      else if (part === "pages") body = FALLBACK_PAGES;
      else {
        body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>\n`;
      }
    }
    await writeFile(outPath, body, "utf8");
    const locs = (body.match(/<loc>/g) || []).length;
    console.log("[fetch-sitemap] wrote", outPath, "—", locs, "loc entries");
  }

  if (usedFallback) {
    console.warn("[fetch-sitemap] one or more parts used FALLBACK — deploy generate-sitemap edge fn");
  }
}

main().catch((err) => {
  console.error("[fetch-sitemap]", err);
  process.exit(1);
});
