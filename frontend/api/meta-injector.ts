/**
 * Vercel Edge Function — SEO meta injector for crawlers.
 *
 * Triggered ONLY for known bots (User-Agent allowlist) hitting:
 *   /product/:slug, /store/:slug, /category/:slug, /blog/:slug
 *
 * Strategy:
 *   1. Detect bot via User-Agent.
 *   2. Fetch the static index.html from the same deployment.
 *   3. Fetch metadata from Supabase REST (anon key, public data only).
 *   4. Inject <title>, meta description, canonical, OG/Twitter, JSON-LD into <head>.
 *   5. Stream the rewritten HTML to the bot.
 *
 * Humans are never routed here (Vercel rewrite uses `has` UA condition).
 * On any error we fall back to the original index.html so users always get a page.
 */

export const config = { runtime: "edge" };

const SITE_URL = "https://zandofy.com";
const SUPABASE_URL = "https://vpttoqojmiqxgudknyxf.supabase.co";
// Public anon key — safe in client-side / edge code.
const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdHRvcW9qbWlxeGd1ZGtueXhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxNjE0MzcsImV4cCI6MjA2NTczNzQzN30.ZqJUUN6DqXrXJ7CcjmmMRrcVtDkQ4zYM4nhP8mC4_zE";

const BOT_REGEX =
  /(googlebot|bingbot|yandex|duckduckbot|baiduspider|slurp|facebookexternalhit|facebot|twitterbot|linkedinbot|whatsapp|telegrambot|discordbot|applebot|pinterest|skypeuripreview|embedly|quora link preview|outbrain|vkshare|w3c_validator|redditbot|tumblr|bitlybot|nuzzel|qwantify|pinterestbot|petalbot|seznambot|ahrefsbot|semrushbot|mj12bot|dotbot)/i;

function isBot(ua: string | null): boolean {
  if (!ua) return false;
  return BOT_REGEX.test(ua);
}

function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeJsonLd(s: string): string {
  // JSON-LD strings still need backslashes/quotes escaped via JSON.stringify when building objects.
  return s.replace(/</g, "\\u003c");
}

function truncate(s: string, max = 160): string {
  if (!s) return "";
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length <= max ? clean : clean.slice(0, max - 1).trimEnd() + "…";
}

async function sbFetch(path: string): Promise<any[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
      Accept: "application/json",
    },
    // Cache aggressively at the edge — content rarely changes per request.
    cf: { cacheTtl: 300 } as any,
  });
  if (!res.ok) return [];
  return (await res.json()) as any[];
}

type MetaPayload = {
  title: string;
  description: string;
  canonical: string;
  image?: string;
  ogType?: "website" | "article" | "product";
  jsonLd?: Record<string, unknown>;
  keywords?: string;
  robots?: string;
};

// ─── Global SEO config (admin-controlled via platform_settings.seo_config) ───
type SeoConfig = {
  site_title?: string;
  site_description?: string;
  default_keywords?: string[];
  default_og_image?: string;
  brand_name?: string;
  tagline?: string;
};

let _seoCache: { value: SeoConfig | null; expiresAt: number } = { value: null, expiresAt: 0 };

async function getSeoConfig(forcePurge = false): Promise<SeoConfig> {
  const now = Date.now();
  if (!forcePurge && _seoCache.value && _seoCache.expiresAt > now) {
    return _seoCache.value;
  }
  try {
    const rows = await sbFetch(
      `platform_settings?key=eq.seo_config&select=value&limit=1`,
    );
    const value = (rows[0]?.value as SeoConfig) || {};
    _seoCache = { value, expiresAt: now + 60_000 }; // 60s in-memory edge cache
    return value;
  } catch {
    return _seoCache.value || {};
  }
}

// Routes treated as "global" pages — title/description/og come from seo_config.
const GLOBAL_ROUTES = new Set([
  "/", "/faq", "/stores", "/blog", "/about", "/contact",
  "/careers", "/help", "/pricing", "/privacy", "/terms",
  "/popular", "/trends", "/search",
  // Private pages — included so the override (noindex,nofollow) is honored
  "/auth", "/reset-password", "/onboarding", "/impersonate",
]);

// ─── Per-page SEO overrides (admin-managed via `seo_page_overrides`) ───
type SeoOverride = {
  path: string;
  title: string | null;
  og_title: string | null;
  description: string | null;
  og_image: string | null;
  keywords: string[] | null;
  robots: string | null;
  jsonld_extra: Record<string, unknown> | null;
};

let _overridesCache: { value: Record<string, SeoOverride> | null; expiresAt: number } = {
  value: null,
  expiresAt: 0,
};

async function getOverride(pathname: string, forcePurge = false): Promise<SeoOverride | null> {
  const now = Date.now();
  if (forcePurge || !_overridesCache.value || _overridesCache.expiresAt <= now) {
    try {
      const rows = await sbFetch(
        `seo_page_overrides?select=path,title,og_title,description,og_image,keywords,robots,jsonld_extra`,
      );
      const map: Record<string, SeoOverride> = {};
      for (const r of rows as any[]) map[r.path] = r;
      _overridesCache = { value: map, expiresAt: now + 60_000 };
    } catch {
      _overridesCache = { value: _overridesCache.value || {}, expiresAt: now + 5_000 };
    }
  }
  return _overridesCache.value?.[pathname] || null;
}

async function buildGlobalMeta(pathname: string): Promise<MetaPayload | null> {
  const cfg = await getSeoConfig();
  const brand = cfg.brand_name || "Zandofy";
  const baseTitle = cfg.site_title || `${brand} — Marketplace`;
  const description = truncate(
    cfg.site_description ||
      cfg.tagline ||
      `${brand} : marketplace mode et import. Livraison rapide en Afrique.`,
  );
  const image = cfg.default_og_image || `${SITE_URL}/og-default.jpg`;
  const canonical = `${SITE_URL}${pathname === "/" ? "/" : pathname}`;

  // For sub-pages add a humanised suffix; homepage keeps the bare site title.
  const pageLabel: Record<string, string> = {
    "/faq": "FAQ",
    "/stores": "Boutiques",
    "/blog": "Blog",
    "/about": "À propos",
    "/contact": "Contact",
    "/careers": "Carrières",
    "/help": "Centre d'aide",
    "/pricing": "Tarifs",
    "/privacy": "Confidentialité",
    "/terms": "Conditions",
    "/popular": "Populaires",
    "/trends": "Tendances",
    "/search": "Recherche",
  };
  const title =
    pathname === "/" ? baseTitle : `${pageLabel[pathname] || ""} | ${brand}`.trim();

  return {
    title,
    description,
    canonical,
    image,
    ogType: "website",
    keywords: Array.isArray(cfg.default_keywords) ? cfg.default_keywords.join(", ") : undefined,
  };
}

async function buildProductMeta(slug: string): Promise<MetaPayload | null> {
  // products.slug column may be null → we accept slug OR id
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
  const filter = isUuid ? `id=eq.${slug}` : `slug=eq.${encodeURIComponent(slug)}`;
  const rows = await sbFetch(
    `products?${filter}&publish_status=eq.published&select=id,name,slug,description,price,rating,review_count,store_id,product_images(image_url,position)&limit=1`,
  );
  const p = rows[0];
  if (!p) return null;

  const canonical = `${SITE_URL}/product/${p.slug || p.id}`;
  // Images live in `product_images` (relational), sorted by `position`.
  const sortedImages = Array.isArray(p.product_images)
    ? [...p.product_images].sort(
        (a: any, b: any) => (a?.position ?? 0) - (b?.position ?? 0),
      )
    : [];
  const image =
    sortedImages[0]?.image_url || `${SITE_URL}/og-default.jpg`;
  const title = `${p.name} | Zandofy`;
  const description = truncate(
    p.description ||
      `Achetez ${p.name} sur Zandofy — marketplace mode sino-africaine. Livraison rapide en Afrique.`,
  );

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description,
    image,
    url: canonical,
    sku: p.id,
    brand: { "@type": "Brand", name: "Zandofy" },
    offers: {
      "@type": "Offer",
      url: canonical,
      priceCurrency: "USD",
      price: p.price,
      availability: "https://schema.org/InStock",
    },
  };
  if (p.rating && p.review_count) {
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: p.rating,
      reviewCount: p.review_count,
    };
  }

  return { title, description, canonical, image, ogType: "product", jsonLd };
}

async function buildStoreMeta(slug: string): Promise<MetaPayload | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
  const filter = isUuid ? `id=eq.${slug}` : `slug=eq.${encodeURIComponent(slug)}`;
  const rows = await sbFetch(
    `stores?${filter}&select=id,name,slug,description,logo_url,banner_url,city,country,rating,followers_count&limit=1`,
  );
  const s = rows[0];
  if (!s) return null;

  const canonical = `${SITE_URL}/store/${s.slug || s.id}`;
  const image = s.banner_url || s.logo_url || `${SITE_URL}/og-default.jpg`;
  const title = `${s.name} — Boutique sur Zandofy`;
  const location = [s.city, s.country].filter(Boolean).join(", ");
  const description = truncate(
    s.description ||
      `Découvrez la boutique ${s.name}${location ? ` (${location})` : ""} sur Zandofy. Mode et accessoires de qualité, livraison rapide.`,
  );

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: s.name,
    description,
    image,
    url: canonical,
    ...(s.city || s.country
      ? {
          address: {
            "@type": "PostalAddress",
            addressLocality: s.city || undefined,
            addressCountry: s.country || undefined,
          },
        }
      : {}),
  };
  if (s.rating) {
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: s.rating,
      reviewCount: s.followers_count || 1,
    };
  }

  return { title, description, canonical, image, ogType: "website", jsonLd };
}

async function buildCategoryMeta(slug: string): Promise<MetaPayload | null> {
  // Categories have no slug column → match by slugified name (PostgREST ilike).
  // Replace dashes with spaces and try ilike on name and name_fr.
  const guess = slug.replace(/-/g, " ");
  const rows = await sbFetch(
    `categories?or=(name.ilike.${encodeURIComponent(guess)},name_fr.ilike.${encodeURIComponent(guess)})&select=id,name,name_fr,image_url&limit=1`,
  );
  const c = rows[0];
  const displayName = c?.name_fr || c?.name || guess;
  const canonical = `${SITE_URL}/category/${slug}`;
  const image = c?.image_url || `${SITE_URL}/og-default.jpg`;
  const title = `${displayName} — Catalogue Zandofy`;
  const description = truncate(
    `Tous les produits ${displayName} sur Zandofy. Mode élégante & accessible, livraison rapide en Afrique.`,
  );

  return {
    title,
    description,
    canonical,
    image,
    ogType: "website",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: displayName,
      url: canonical,
      image,
      description,
    },
  };
}

async function buildBlogMeta(slug: string): Promise<MetaPayload | null> {
  const rows = await sbFetch(
    `blog_posts?slug=eq.${encodeURIComponent(slug)}&status=eq.published&select=title,excerpt,meta_title,meta_description,cover_image_url,og_image_url,published_at,updated_at,seo_keywords&limit=1`,
  );
  const b = rows[0];
  if (!b) return null;

  const canonical = `${SITE_URL}/blog/${slug}`;
  const image = b.og_image_url || b.cover_image_url || `${SITE_URL}/og-default.jpg`;
  const title = b.meta_title || `${b.title} | Zandofy`;
  const description = truncate(b.meta_description || b.excerpt || b.title);

  return {
    title,
    description,
    canonical,
    image,
    ogType: "article",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: b.title,
      description,
      image,
      url: canonical,
      datePublished: b.published_at,
      dateModified: b.updated_at,
      keywords: Array.isArray(b.seo_keywords) ? b.seo_keywords.join(", ") : undefined,
      publisher: {
        "@type": "Organization",
        name: "Zandofy",
        logo: { "@type": "ImageObject", url: `${SITE_URL}/icons/icon-512.png` },
      },
    },
  };
}

async function buildMetaForPath(pathname: string): Promise<MetaPayload | null> {
  // Per-page override takes priority for global/static routes.
  const override = await getOverride(pathname);

  const productMatch = pathname.match(/^\/product\/([^/?#]+)/i);
  if (productMatch) return buildProductMeta(decodeURIComponent(productMatch[1]));

  const storeMatch = pathname.match(/^\/store\/([^/?#]+)/i);
  if (storeMatch) return buildStoreMeta(decodeURIComponent(storeMatch[1]));

  const categoryMatch = pathname.match(/^\/category\/([^/?#]+)/i);
  if (categoryMatch) return buildCategoryMeta(decodeURIComponent(categoryMatch[1]));

  const blogMatch = pathname.match(/^\/blog\/([^/?#]+)/i);
  if (blogMatch) return buildBlogMeta(decodeURIComponent(blogMatch[1]));

  // Global / static pages — admin-controlled SEO config
  if (GLOBAL_ROUTES.has(pathname)) {
    const base = await buildGlobalMeta(pathname);
    if (!base && !override) return null;
    const merged: MetaPayload = base || {
      title: "Zandofy",
      description: "",
      canonical: `${SITE_URL}${pathname}`,
      ogType: "website",
    };
    if (override) {
      if (override.title) merged.title = override.title;
      if (override.description) merged.description = truncate(override.description);
      if (override.og_image) merged.image = override.og_image;
      if (override.keywords && override.keywords.length)
        merged.keywords = override.keywords.join(", ");
      if (override.robots) merged.robots = override.robots;
      // og_title injected via separate meta tag below
      if (override.og_title) (merged as any).ogTitle = override.og_title;
    }
    return merged;
  }

  return null;
}

function buildHeadInjection(meta: MetaPayload): string {
  const t = escapeHtml(meta.title);
  const ogT = escapeHtml((meta as any).ogTitle || meta.title);
  const d = escapeHtml(meta.description);
  const c = escapeHtml(meta.canonical);
  const img = escapeHtml(meta.image || `${SITE_URL}/og-default.jpg`);
  const ogType = meta.ogType || "website";
  const robots = meta.robots || "index,follow";

  let html = `
<!-- BEGIN injected SEO (meta-injector edge fn) -->
<title>${t}</title>
<meta name="robots" content="${escapeHtml(robots)}" />
<meta name="description" content="${d}" />
<link rel="canonical" href="${c}" />
<meta property="og:type" content="${ogType}" />
<meta property="og:url" content="${c}" />
<meta property="og:title" content="${ogT}" />
<meta property="og:description" content="${d}" />
<meta property="og:image" content="${img}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${ogT}" />
<meta name="twitter:description" content="${d}" />
<meta name="twitter:image" content="${img}" />`;
  if (meta.keywords) {
    html += `\n<meta name="keywords" content="${escapeHtml(meta.keywords)}" />`;
  }

  if (meta.jsonLd) {
    html += `\n<script type="application/ld+json">${escapeJsonLd(JSON.stringify(meta.jsonLd))}</script>`;
  }
  html += `\n<!-- END injected SEO -->\n`;
  return html;
}

/**
 * Strip the static defaults (<title>, og:*, twitter:*, canonical, description)
 * already in index.html so search engines don't see duplicate/conflicting tags.
 */
function stripStaticSeo(head: string): string {
  return head
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/<link[^>]+rel=["']canonical["'][^>]*>/gi, "")
    .replace(/<meta[^>]+name=["']description["'][^>]*>/gi, "")
    .replace(/<meta[^>]+name=["']robots["'][^>]*>/gi, "")
    .replace(/<meta[^>]+property=["']og:[^"']+["'][^>]*>/gi, "")
    .replace(/<meta[^>]+name=["']twitter:[^"']+["'][^>]*>/gi, "");
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const ua = req.headers.get("user-agent");

  // Cache purge endpoint (called by admin after saving SEO config).
  if (req.headers.get("x-purge-cache") === "1") {
    _seoCache = { value: null, expiresAt: 0 };
    _overridesCache = { value: null, expiresAt: 0 };
    return new Response(JSON.stringify({ purged: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Humans should never reach this fn (rewrite is bot-only), but be defensive.
  if (!isBot(ua)) {
    return Response.redirect(`${url.origin}${url.pathname}${url.search}`, 302);
  }

  // Fetch the original index.html from the same deployment.
  const indexUrl = `${url.origin}/index.html`;
  const indexRes = await fetch(indexUrl, {
    headers: { "User-Agent": "meta-injector/1.0" },
  });
  if (!indexRes.ok) {
    return new Response("upstream index.html unavailable", { status: 502 });
  }
  let html = await indexRes.text();

  let meta: MetaPayload | null = null;
  try {
    meta = await buildMetaForPath(url.pathname);
  } catch {
    meta = null;
  }

  if (meta) {
    const headOpenIdx = html.search(/<head[^>]*>/i);
    const headCloseIdx = html.search(/<\/head>/i);
    if (headOpenIdx !== -1 && headCloseIdx !== -1) {
      const before = html.slice(0, html.indexOf(">", headOpenIdx) + 1);
      const headInner = html.slice(html.indexOf(">", headOpenIdx) + 1, headCloseIdx);
      const after = html.slice(headCloseIdx);
      const cleanedHead = stripStaticSeo(headInner);
      html = before + cleanedHead + buildHeadInjection(meta) + after;
    }
  }

  // Use a much shorter cache for product/store/category pages so image changes
  // (or first-time scrapes) propagate quickly to social crawlers. Global pages
  // (FAQ, About, etc.) keep the longer cache because they change rarely.
  const isDynamic =
    /^\/(product|store|category|blog)\//i.test(url.pathname);
  const cacheControl = isDynamic
    ? "public, max-age=60, s-maxage=60, stale-while-revalidate=300"
    : "public, max-age=300, s-maxage=600, stale-while-revalidate=86400";

  // Honor per-page robots override at the HTTP header level too.
  const xRobots = meta?.robots || "index, follow";
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": cacheControl,
      "X-Robots-Tag": xRobots,
      Vary: "User-Agent",
    },
  });
}
