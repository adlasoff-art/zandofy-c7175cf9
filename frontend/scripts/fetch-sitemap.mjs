/**
 * Prefetch segmented sitemaps into public/ before Vite build.
 * Needed because Vercel serves this app as static `dist/` (framework: null):
 * /api/* and external rewrites fall through to the SPA HTML — GSC then sees "sitemap is HTML".
 *
 * Writes:
 *   sitemap.xml                 (sitemapindex)
 *   sitemap-products.xml        (page 1 alias)
 *   sitemap-products-N.xml      (paginated, 1000 URLs each)
 *   sitemap-categories.xml
 *   sitemap-vendors.xml
 *   sitemap-pages.xml
 *   sitemap-blog.xml
 *
 * Cron (ops): redeploy generate-sitemap edge fn, then Vercel rebuild — see SEO playbook.
 */
import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");

const BASE =
  process.env.SITEMAP_FUNCTION_URL?.trim() ||
  `${(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://vpttoqojmiqxgudknyxf.supabase.co").replace(/\/$/, "")}/functions/v1/generate-sitemap`;

const STATIC_PARTS = [
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

const EMPTY_URLSET = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>
`;

function partUrl(part, page) {
  const u = new URL(BASE);
  u.searchParams.set("part", part);
  if (page != null) u.searchParams.set("page", String(page));
  return u.toString();
}

async function fetchPart(part, mustInclude, page) {
  const url = partUrl(part, page);
  console.log("[fetch-sitemap] GET", url);
  const res = await fetch(url, {
    headers: { Accept: "application/xml,text/xml,*/*" },
  });
  const text = await res.text();
  if (!res.ok || !text.includes(mustInclude)) {
    throw new Error(`upstream ${part}${page != null ? ` page=${page}` : ""} failed ${res.status}: ${text.slice(0, 200)}`);
  }
  if (text.includes("/search")) {
    console.warn(`[fetch-sitemap] WARNING: ${part} contains /search — should be excluded`);
  }
  return text;
}

async function writeBody(file, body) {
  const outPath = join(publicDir, file);
  await writeFile(outPath, body, "utf8");
  const locs = (body.match(/<loc>/g) || []).length;
  console.log("[fetch-sitemap] wrote", outPath, "—", locs, "loc entries");
}

function productPagesFromIndex(indexXml) {
  const pages = new Set();
  const re = /sitemap-products-(\d+)\.xml/g;
  let m;
  while ((m = re.exec(indexXml)) !== null) {
    pages.add(Number(m[1]));
  }
  if (pages.size === 0) pages.add(1);
  return [...pages].sort((a, b) => a - b);
}

async function main() {
  await mkdir(publicDir, { recursive: true });
  let usedFallback = false;

  let indexBody;
  try {
    indexBody = await fetchPart("index", "<sitemapindex");
  } catch (err) {
    console.error("[fetch-sitemap]", err.message || err);
    usedFallback = true;
    indexBody = FALLBACK_INDEX;
  }
  await writeBody("sitemap.xml", indexBody);

  const productPages = productPagesFromIndex(indexBody);
  for (const page of productPages) {
    try {
      const body = await fetchPart("products", "<urlset", page);
      await writeBody(`sitemap-products-${page}.xml`, body);
      if (page === 1) {
        await writeBody("sitemap-products.xml", body);
      }
    } catch (err) {
      console.error("[fetch-sitemap]", err.message || err);
      usedFallback = true;
      await writeBody(`sitemap-products-${page}.xml`, EMPTY_URLSET);
      if (page === 1) await writeBody("sitemap-products.xml", EMPTY_URLSET);
    }
  }

  for (const { part, file, mustInclude } of STATIC_PARTS) {
    try {
      const body = await fetchPart(part, mustInclude);
      await writeBody(file, body);
    } catch (err) {
      console.error("[fetch-sitemap]", err.message || err);
      usedFallback = true;
      const body = part === "pages" ? FALLBACK_PAGES : EMPTY_URLSET;
      await writeBody(file, body);
    }
  }

  if (usedFallback) {
    console.warn("[fetch-sitemap] one or more parts used FALLBACK — deploy generate-sitemap edge fn");
  }
}

main().catch((err) => {
  console.error("[fetch-sitemap]", err);
  process.exit(1);
});
