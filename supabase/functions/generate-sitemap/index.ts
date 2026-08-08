import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Segmented sitemap index for Zandofy.
 * Canonical host MUST match live redirect (www → apex).
 *
 * Query: ?part=index|products|categories|vendors|pages|blog
 * Default: index (sitemapindex listing child files on the site origin).
 *
 * Redeploy trigger: 2026-08-08 — segmented sitemaps, exclude /search.
 */
const SITE_URL = (Deno.env.get("SITE_URL") || "https://zandofy.com").replace(/\/$/, "");

/** Match frontend `slugify()` for category URLs. */
function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

function xmlHeader(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n`;
}

function urlEntry(
  loc: string,
  opts: { lastmod?: string; changefreq?: string; priority?: string } = {},
): string {
  const lastmod = opts.lastmod ? `<lastmod>${opts.lastmod}</lastmod>` : "";
  const changefreq = opts.changefreq ? `<changefreq>${opts.changefreq}</changefreq>` : "";
  const priority = opts.priority ? `<priority>${opts.priority}</priority>` : "";
  return `  <url><loc>${loc}</loc>${lastmod}${changefreq}${priority}</url>\n`;
}

function wrapUrlset(body: string): string {
  return (
    xmlHeader() +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    body +
    `</urlset>`
  );
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

/** Hub pages only — never /search (noindex) or transactional paths. */
const HUB_PAGES: { loc: string; changefreq: string; priority: string }[] = [
  { loc: "/", changefreq: "daily", priority: "1.0" },
  { loc: "/stores", changefreq: "daily", priority: "0.9" },
  { loc: "/popular", changefreq: "daily", priority: "0.9" },
  { loc: "/trends", changefreq: "daily", priority: "0.9" },
  { loc: "/blog", changefreq: "weekly", priority: "0.8" },
  { loc: "/help-center", changefreq: "weekly", priority: "0.8" },
  { loc: "/become-vendor", changefreq: "monthly", priority: "0.8" },
  { loc: "/affiliate-program", changefreq: "monthly", priority: "0.7" },
  { loc: "/loyalty-program", changefreq: "monthly", priority: "0.6" },
  { loc: "/about", changefreq: "monthly", priority: "0.7" },
  { loc: "/faq", changefreq: "monthly", priority: "0.7" },
  { loc: "/pricing", changefreq: "monthly", priority: "0.6" },
  { loc: "/careers", changefreq: "monthly", priority: "0.5" },
  { loc: "/social-responsibility", changefreq: "monthly", priority: "0.5" },
  { loc: "/terms", changefreq: "yearly", priority: "0.3" },
  { loc: "/privacy", changefreq: "yearly", priority: "0.3" },
];

const CHILD_SITEMAPS = [
  "sitemap-products.xml",
  "sitemap-categories.xml",
  "sitemap-vendors.xml",
  "sitemap-pages.xml",
  "sitemap-blog.xml",
] as const;

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const part = (url.searchParams.get("part") || "index").toLowerCase();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (part === "index") {
      const lastmod = today();
      let xml = xmlHeader();
      xml += `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
      for (const file of CHILD_SITEMAPS) {
        xml += `  <sitemap><loc>${SITE_URL}/${file}</loc><lastmod>${lastmod}</lastmod></sitemap>\n`;
      }
      xml += `</sitemapindex>`;
      return xmlResponse(xml);
    }

    if (part === "pages") {
      let body = "";
      for (const page of HUB_PAGES) {
        body += urlEntry(`${SITE_URL}${page.loc}`, {
          changefreq: page.changefreq,
          priority: page.priority,
        });
      }
      return xmlResponse(wrapUrlset(body));
    }

    if (part === "products") {
      const { data: products } = await supabase
        .from("products")
        .select("id, slug, updated_at")
        .eq("publish_status", "published")
        .order("updated_at", { ascending: false })
        .limit(5000);
      let body = "";
      for (const p of products || []) {
        const lastmod = p.updated_at ? String(p.updated_at).split("T")[0] : "";
        const productPath = p.slug || p.id;
        body += urlEntry(`${SITE_URL}/product/${productPath}`, {
          lastmod,
          changefreq: "weekly",
          priority: "0.8",
        });
      }
      return xmlResponse(wrapUrlset(body));
    }

    if (part === "categories") {
      const { data: categories } = await supabase
        .from("categories")
        .select("name, name_fr, created_at")
        .order("name");
      const seenCat = new Set<string>();
      let body = "";
      for (const c of categories || []) {
        for (const raw of [c.name_fr, c.name]) {
          const catSlug = slugify(raw || "");
          if (!catSlug || seenCat.has(catSlug)) continue;
          seenCat.add(catSlug);
          const lastmod = (c.created_at || "").toString().split("T")[0];
          body += urlEntry(`${SITE_URL}/category/${catSlug}`, {
            lastmod: lastmod || undefined,
            changefreq: "weekly",
            priority: "0.7",
          });
        }
      }
      return xmlResponse(wrapUrlset(body));
    }

    if (part === "vendors") {
      // Same active filters as meta-injector (stores_public for anon; service role here).
      // Keep is_banned/is_suspended false so sitemap never lists 410/404 store URLs.
      const { data: stores } = await supabase
        .from("stores")
        .select("id, slug, name, created_at")
        .eq("is_banned", false)
        .eq("is_suspended", false)
        .limit(1000);
      let body = "";
      for (const s of stores || []) {
        const storePath = s.slug || s.id;
        const lastmod = (s.created_at || "").toString().split("T")[0];
        body += urlEntry(`${SITE_URL}/store/${storePath}`, {
          lastmod: lastmod || undefined,
          changefreq: "weekly",
          priority: "0.6",
        });
      }
      return xmlResponse(wrapUrlset(body));
    }

    if (part === "blog") {
      const { data: blogPosts } = await supabase
        .from("blog_posts")
        .select("slug, updated_at, published_at")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(500);
      let body = "";
      for (const b of blogPosts || []) {
        if (!b.slug) continue;
        const lastmod = (b.updated_at || b.published_at || "").toString().split("T")[0];
        body += urlEntry(`${SITE_URL}/blog/${b.slug}`, {
          lastmod: lastmod || undefined,
          changefreq: "weekly",
          priority: "0.6",
        });
      }
      return xmlResponse(wrapUrlset(body));
    }

    return new Response(`Unknown part=${part}. Use index|products|categories|vendors|pages|blog`, {
      status: 400,
    });
  } catch (error) {
    return new Response(`Error generating sitemap: ${error}`, { status: 500 });
  }
});

function xmlResponse(xml: string): Response {
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
