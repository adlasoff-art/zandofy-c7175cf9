/**
 * Vercel Edge Function — SEO meta injector for crawlers.
 *
 * Triggered ONLY for known bots (User-Agent allowlist) hitting:
 *   /, /product|store|category|blog/:slug, and hub/global pages
 *
 * Humans are never routed here (Vercel rewrite uses `has` UA condition).
 */

import { isDynamicSeoPath, resolveRequestPathname } from "./meta-injector-path";

export const config = { runtime: "edge" };

const DEV_SITE_URL = "https://zandofy.com";
const DEV_SUPABASE_URL = "https://vpttoqojmiqxgudknyxf.supabase.co";
const DEV_SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwdHRvcW9qbWlxeGd1ZGtueXhmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxNjE0MzcsImV4cCI6MjA2NTczNzQzN30.ZqJUUN6DqXrXJ7CcjmmMRrcVtDkQ4zYM4nhP8mC4_zE";

function getSiteUrl(): string {
  return (process.env.SITE_URL || process.env.VITE_SITE_URL || DEV_SITE_URL).replace(/\/$/, "");
}

function getSupabaseUrl(): string {
  return process.env.SUPABASE_URL || DEV_SUPABASE_URL;
}

function getSupabaseAnon(): string {
  return (
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    DEV_SUPABASE_ANON
  );
}

function getFacebookAppId(): string | undefined {
  const id = process.env.FACEBOOK_APP_ID?.trim();
  return id || undefined;
}

function toAbsoluteOgImage(url: string | null | undefined): string {
  const site = getSiteUrl();
  const raw = (url || "").trim();
  if (!raw || raw === "/placeholder.svg") return `${site}/og-default.jpg`;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  return `${site}${path}`;
}

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

function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

/** Crawler-visible main: same catalogue facts as the SPA (no cloaking). */
function buildSeoMainHtml(opts: {
  h1: string;
  price?: string;
  description?: string;
  articleBody?: string;
  productLinks?: { name: string; href: string }[];
  breadcrumb?: { name: string; href: string }[];
  ctaHref: string;
  ctaLabel: string;
}): string {
  const crumbs =
    opts.breadcrumb && opts.breadcrumb.length > 0
      ? `<nav aria-label="Fil d'Ariane"><ol>${opts.breadcrumb
          .map(
            (c, i) =>
              `<li>${
                i < opts.breadcrumb!.length - 1
                  ? `<a href="${escapeHtml(c.href)}">${escapeHtml(c.name)}</a>`
                  : escapeHtml(c.name)
              }</li>`,
          )
          .join("")}</ol></nav>`
      : "";
  const price = opts.price ? `<p class="price">${escapeHtml(opts.price)}</p>` : "";
  const desc = opts.description
    ? `<p class="desc">${escapeHtml(stripHtml(opts.description).slice(0, 500))}</p>`
    : "";
  const article = opts.articleBody
    ? `<div class="article">${escapeHtml(stripHtml(opts.articleBody).slice(0, 8000))
        .split(/\n+/)
        .filter(Boolean)
        .map((p) => `<p>${p}</p>`)
        .join("")}</div>`
    : "";
  const list =
    opts.productLinks && opts.productLinks.length > 0
      ? `<ul class="products">${opts.productLinks
          .map(
            (p) =>
              `<li><a href="${escapeHtml(p.href)}">${escapeHtml(p.name)}</a></li>`,
          )
          .join("")}</ul>`
      : "";
  return `<main id="zandofy-seo-main"><style>#zandofy-seo-main{font-family:system-ui,sans-serif;max-width:42rem;margin:1rem auto;padding:0 1rem;line-height:1.5;color:#111}#zandofy-seo-main h1{font-size:1.5rem;margin:0 0 .5rem}#zandofy-seo-main .price{font-weight:700;font-size:1.125rem;margin:.5rem 0}#zandofy-seo-main .desc,#zandofy-seo-main .article{margin:.75rem 0;color:#333}#zandofy-seo-main .article p{margin:.5rem 0}#zandofy-seo-main ul.products{margin:1rem 0;padding-left:1.25rem}#zandofy-seo-main nav ol{display:flex;flex-wrap:wrap;gap:.35rem;list-style:none;padding:0;margin:0 0 1rem;font-size:.875rem;color:#555}#zandofy-seo-main nav li:not(:last-child)::after{content:"›";margin-left:.35rem;color:#999}#zandofy-seo-main a{color:#0a5}</style>${crumbs}<h1>${escapeHtml(opts.h1)}</h1>${price}${desc}${article}${list}<p><a href="${escapeHtml(opts.ctaHref)}">${escapeHtml(opts.ctaLabel)}</a></p></main>`;
}

function escapeJsonLd(s: string): string {
  return s.replace(/</g, "\\u003c");
}

function truncate(s: string, max = 160): string {
  if (!s) return "";
  const clean = s.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  // Prefer shorter primary title when over budget (avoid mid-word cut + "…")
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace >= Math.floor(max * 0.55)) {
    return cut.slice(0, lastSpace).trimEnd();
  }
  return cut.trimEnd();
}

/** Build title ≤60 chars: prefer short form if long template would truncate mid-phrase. */
function buildPageTitle(parts: { primary: string; suffix?: string; max?: number }): string {
  const max = parts.max ?? 60;
  const primary = (parts.primary || "").replace(/\s+/g, " ").trim();
  const suffix = (parts.suffix || "").replace(/\s+/g, " ").trim();
  if (!suffix) return truncate(primary, max);
  const full = `${primary} ${suffix}`.replace(/\s+/g, " ").trim();
  if (full.length <= max) return full;
  // Drop suffix if it doesn't fit entirely
  if (primary.length <= max) return primary;
  return truncate(primary, max);
}

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");
}

function applyTemplate(tpl: string, vars: Record<string, string>): string {
  return (tpl || "").replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? "");
}

async function sbFetch(path: string): Promise<any[]> {
  const res = await fetch(`${getSupabaseUrl()}/rest/v1/${path}`, {
    headers: {
      apikey: getSupabaseAnon(),
      Authorization: `Bearer ${getSupabaseAnon()}`,
      Accept: "application/json",
    },
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
  imageAlt?: string;
  ogType?: "website" | "article" | "product";
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  keywords?: string;
  robots?: string;
  ogTitle?: string;
  /** Visible body for crawlers (H1, price, description) — same facts as SPA. */
  bodyHtml?: string;
  /** HTTP status override (e.g. 410 for permanently removed products). */
  httpStatus?: number;
};

type SitelinkNavItem = { name: string; url: string };

type SeoConfig = {
  site_title?: string;
  site_description?: string;
  default_keywords?: string[];
  default_og_image?: string;
  brand_name?: string;
  tagline?: string;
  social_urls?: { facebook?: string; instagram?: string; twitter?: string };
  category_title_template?: string;
  category_description_template?: string;
  product_title_template?: string;
  product_description_template?: string;
  store_title_template?: string;
  store_description_template?: string;
  sitelinks_nav?: SitelinkNavItem[];
};

const DEFAULT_SITELINKS: SitelinkNavItem[] = [
  { name: "Boutiques", url: "/stores" },
  { name: "Populaires", url: "/popular" },
  { name: "Tendances", url: "/trends" },
  { name: "Blog", url: "/blog" },
  { name: "Centre d'aide", url: "/help-center" },
  { name: "Devenir vendeur", url: "/become-vendor" },
  { name: "Programme d'affiliation", url: "/affiliate-program" },
  { name: "À propos", url: "/about" },
];

let _seoCache: { value: SeoConfig | null; expiresAt: number } = { value: null, expiresAt: 0 };

async function getSeoConfig(forcePurge = false): Promise<SeoConfig> {
  const now = Date.now();
  if (!forcePurge && _seoCache.value && _seoCache.expiresAt > now) {
    return _seoCache.value;
  }
  try {
    const rows = await sbFetch(`platform_settings?key=eq.seo_config&select=value&limit=1`);
    const value = (rows[0]?.value as SeoConfig) || {};
    _seoCache = { value, expiresAt: now + 60_000 };
    return value;
  } catch {
    return _seoCache.value || {};
  }
}

const GLOBAL_ROUTES = new Set([
  "/",
  "/faq",
  "/stores",
  "/blog",
  "/about",
  "/careers",
  "/help-center",
  "/pricing",
  "/privacy",
  "/terms",
  "/popular",
  "/trends",
  "/search",
  "/become-vendor",
  "/affiliate-program",
  "/loyalty-program",
  "/social-responsibility",
  "/auth",
  "/reset-password",
  "/onboarding",
  "/impersonate",
]);

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

function mergeJsonLd(
  base: Record<string, unknown> | Record<string, unknown>[] | undefined,
  extra: Record<string, unknown> | null | undefined,
): Record<string, unknown> | Record<string, unknown>[] | undefined {
  if (!extra || Object.keys(extra).length === 0) return base;
  if (!base) return extra;
  if (Array.isArray(base)) return [...base, extra];
  if (base["@graph"] && Array.isArray(base["@graph"])) {
    return { ...base, "@graph": [...(base["@graph"] as unknown[]), extra] };
  }
  return {
    "@context": "https://schema.org",
    "@graph": [base, extra],
  };
}

function buildHomeJsonLd(cfg: SeoConfig): Record<string, unknown> {
  const site = getSiteUrl();
  const brand = cfg.brand_name || "Zandofy";
  const sameAs = [
    cfg.social_urls?.facebook,
    cfg.social_urls?.instagram,
    cfg.social_urls?.twitter,
  ].filter(Boolean) as string[];
  const nav = (cfg.sitelinks_nav?.length ? cfg.sitelinks_nav : DEFAULT_SITELINKS).map((item, i) => ({
    "@type": "SiteNavigationElement",
    position: i + 1,
    name: item.name,
    url: item.url.startsWith("http") ? item.url : `${site}${item.url.startsWith("/") ? item.url : `/${item.url}`}`,
  }));

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${site}/#organization`,
        name: brand,
        url: `${site}/`,
        logo: `${site}/icons/icon-512.png`,
        image: toAbsoluteOgImage(cfg.default_og_image),
        description:
          cfg.tagline ||
          cfg.site_description ||
          "Marketplace sino-africaine d'achat et logistique — prix usine, livraison en Afrique.",
        ...(sameAs.length ? { sameAs } : {}),
        contactPoint: {
          "@type": "ContactPoint",
          contactType: "customer service",
          availableLanguage: ["French", "English"],
        },
      },
      {
        "@type": "WebSite",
        "@id": `${site}/#website`,
        url: `${site}/`,
        name: brand,
        publisher: { "@id": `${site}/#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: `${site}/search?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "ItemList",
        "@id": `${site}/#mainnav`,
        name: `Navigation principale ${brand}`,
        itemListElement: nav,
      },
    ],
  };
}

async function buildGlobalMeta(pathname: string): Promise<MetaPayload | null> {
  const cfg = await getSeoConfig();
  const brand = cfg.brand_name || "Zandofy";
  const baseTitle = cfg.site_title || `${brand} — Achetez en Chine, livré en Afrique | Prix usine`;
  const description = truncate(
    cfg.site_description ||
      cfg.tagline ||
      `${brand} : achetez aux usines chinoises et internationales. Logistique et livraison en Afrique.`,
  );
  const image = toAbsoluteOgImage(cfg.default_og_image);
  const canonical = `${getSiteUrl()}${pathname === "/" ? "/" : pathname}`;

  const pageLabel: Record<string, string> = {
    "/faq": "FAQ",
    "/stores": "Boutiques",
    "/blog": "Blog",
    "/about": "À propos",
    "/careers": "Carrières",
    "/help-center": "Centre d'aide",
    "/pricing": "Tarifs",
    "/privacy": "Confidentialité",
    "/terms": "Conditions",
    "/popular": "Populaires",
    "/trends": "Tendances",
    "/search": "Recherche",
    "/become-vendor": "Devenir vendeur",
    "/affiliate-program": "Affiliation",
    "/loyalty-program": "Fidélité",
    "/social-responsibility": "Responsabilité sociale",
  };
  const title = pathname === "/" ? baseTitle : `${pageLabel[pathname] || ""} | ${brand}`.replace(/^\s*\|\s*/, "").trim();

  const payload: MetaPayload = {
    title,
    description,
    canonical,
    image,
    ogType: "website",
    keywords: Array.isArray(cfg.default_keywords) ? cfg.default_keywords.join(", ") : undefined,
  };

  if (pathname === "/auth" || pathname === "/search") {
    payload.robots = "noindex,follow";
  }

  if (pathname === "/") {
    const homeH1 = "Achetez en Chine, livré en Afrique — prix usine, livraison suivie";
    const homeArticle = [
      "Zandofy est la marketplace sino-africaine qui relie les acheteurs en RDC et en Afrique aux usines et marques internationales.",
      "Comparez des prix usine, commandez en ligne et suivez la logistique jusqu'à Kinshasa et au-delà : fournisseurs vérifiés, catalogue multi-catégories, paiement et livraison pensés pour le marché local.",
      "Que vous cherchiez mode, électronique, maison, beauté ou équipements, explorez les boutiques officielles et les catégories principales ci-dessous pour trouver le bon produit au bon prix.",
    ].join(" ");
    const homeCats = [
      { name: "Mode africaine", href: `${getSiteUrl()}/category/mode-africaine` },
      { name: "Accessoires tech", href: `${getSiteUrl()}/category/accessoires-tech` },
      { name: "Beauté & soins", href: `${getSiteUrl()}/category/beaute-soins` },
      { name: "Soins bébé", href: `${getSiteUrl()}/category/soins-bebe` },
      { name: "Sacs & accessoires", href: `${getSiteUrl()}/category/sacs-accessoires` },
      { name: "Literie", href: `${getSiteUrl()}/category/literie` },
      { name: "Auto & engin", href: `${getSiteUrl()}/category/auto-engin` },
      { name: "Boutiques", href: `${getSiteUrl()}/stores` },
    ];
    payload.jsonLd = buildHomeJsonLd(cfg);
    payload.bodyHtml = buildSeoMainHtml({
      h1: homeH1,
      description,
      articleBody: homeArticle,
      productLinks: homeCats,
      breadcrumb: [{ name: "Accueil", href: `${getSiteUrl()}/` }],
      ctaHref: `${getSiteUrl()}/stores`,
      ctaLabel: "Explorer les boutiques Zandofy",
    });
  } else if (pathname === "/faq") {
    payload.jsonLd = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      name: title,
      url: canonical,
      description,
    };
  } else if (pageLabel[pathname]) {
    payload.bodyHtml = buildSeoMainHtml({
      h1: pageLabel[pathname],
      description,
      breadcrumb: [
        { name: "Accueil", href: `${getSiteUrl()}/` },
        { name: pageLabel[pathname], href: canonical },
      ],
      ctaHref: canonical,
      ctaLabel: `Voir ${pageLabel[pathname]} sur Zandofy`,
    });
  }

  return payload;
}

async function buildProductMeta(slug: string): Promise<MetaPayload | null> {
  const cfg = await getSeoConfig();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
  const filter = isUuid ? `id=eq.${slug}` : `slug=eq.${encodeURIComponent(slug)}`;
  const rows = await sbFetch(
    `products_public?${filter}&select=id,name,name_fr,slug,description,short_description,price,currency,rating,review_count,stock_quantity,meta_title,meta_description,seo_keywords,store_id,categories(name,name_fr),product_images(image_url,position)&limit=1`,
  );
  const p = rows[0];
  if (!p) return null;

  const displayName = p.name_fr || p.name;
  let storeName = cfg.brand_name || "Zandofy";
  if (p.store_id) {
    const storeRows = await sbFetch(
      `stores_public?id=eq.${p.store_id}&select=name&limit=1`,
    );
    if (storeRows[0]?.name) storeName = storeRows[0].name;
  }
  const categoryName = p.categories?.name_fr || p.categories?.name || "";
  const canonical = `${getSiteUrl()}/product/${p.slug || p.id}`;
  const sortedImages = Array.isArray(p.product_images)
    ? [...p.product_images].sort((a: any, b: any) => (a?.position ?? 0) - (b?.position ?? 0))
    : [];
  const featuredUrl = sortedImages.find((img: { image_url?: string }) => Boolean(img?.image_url?.trim()))
    ?.image_url;
  const image = toAbsoluteOgImage(featuredUrl);

  const titleTpl =
    cfg.product_title_template || "{name} — {category} à prix Kinshasa | Zandofy";
  const descTpl =
    cfg.product_description_template ||
    "Achetez {name} sur Zandofy — import Chine & livraison Afrique.";
  const kinshasaTitle = applyTemplate(titleTpl, {
    name: displayName,
    brand: storeName,
    category: categoryName || "Marketplace",
  });
  const title = p.meta_title
    ? truncate(p.meta_title, 60)
    : kinshasaTitle.length <= 60
      ? kinshasaTitle
      : buildPageTitle({ primary: displayName, suffix: "| Zandofy", max: 60 });
  const description = truncate(
    p.meta_description ||
      p.short_description ||
      p.description ||
      applyTemplate(descTpl, { name: displayName, brand: storeName, category: categoryName }),
    155,
  );

  const priceLabel =
    p.price != null
      ? `${Number(p.price).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} ${p.currency || "USD"}`
      : "";

  const bodyHtml = buildSeoMainHtml({
    h1: displayName,
    price: priceLabel || undefined,
    description,
    breadcrumb: [
      { name: "Accueil", href: `${getSiteUrl()}/` },
      ...(categoryName
        ? [{ name: categoryName, href: `${getSiteUrl()}/category/${slugify(categoryName)}` }]
        : []),
      { name: displayName, href: canonical },
    ],
    ctaHref: canonical,
    ctaLabel: "Voir le produit sur Zandofy",
  });

  const inStock =
    p.stock_quantity == null || Number(p.stock_quantity) > 0
      ? "https://schema.org/InStock"
      : "https://schema.org/OutOfStock";

  const productLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: displayName,
    description,
    image,
    url: canonical,
    sku: p.id,
    brand: { "@type": "Brand", name: storeName },
    offers: {
      "@type": "Offer",
      url: canonical,
      priceCurrency: p.currency || "USD",
      price: p.price,
      availability: inStock,
    },
  };
  if (p.rating != null && Number(p.review_count) > 0) {
    productLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: p.rating,
      reviewCount: p.review_count,
    };
  }

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: `${getSiteUrl()}/` },
      ...(categoryName
        ? [
            {
              "@type": "ListItem",
              position: 2,
              name: categoryName,
              item: `${getSiteUrl()}/category/${slugify(categoryName)}`,
            },
          ]
        : []),
      {
        "@type": "ListItem",
        position: categoryName ? 3 : 2,
        name: displayName,
        item: canonical,
      },
    ],
  };

  return {
    title,
    description,
    canonical,
    image,
    imageAlt: displayName,
    ogType: "product",
    keywords: Array.isArray(p.seo_keywords) ? p.seo_keywords.join(", ") : undefined,
    jsonLd: [productLd, breadcrumb],
    bodyHtml,
  };
}

/**
 * Same source of truth as SPA StorePage + sitemap vendors:
 * - Public read: `stores_public` (anon; `stores` is RLS-blocked)
 * - Sitemap uses service role on `stores` with identical active filters
 */
async function buildStoreMeta(slug: string): Promise<MetaPayload | null> {
  const cfg = await getSeoConfig();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
  const storeSelect =
    "id,name,slug,description,logo_url,banner_url,city,country,rating,review_count_override,meta_title,meta_description,seo_keywords,is_banned,is_suspended";
  const filter = isUuid ? `id=eq.${slug}` : `slug=eq.${encodeURIComponent(slug)}`;

  // Include banned/suspended so we can return 410 (not soft-empty / false 404)
  let rows = await sbFetch(`stores_public?${filter}&select=${storeSelect}&limit=1`);
  if (!rows[0] && !isUuid) {
    const all = await sbFetch(`stores_public?select=${storeSelect}&limit=2000`);
    rows = all.filter(
      (r) => slugify(r.slug || "") === slug || slugify(r.name || "") === slug,
    );
  }
  const s = rows[0];
  if (!s) return null;

  const pathSlug = s.slug || s.id;
  const canonical = `${getSiteUrl()}/store/${pathSlug}`;

  if (s.is_banned || s.is_suspended) {
    return {
      title: "Boutique indisponible | Zandofy",
      description: "Cette boutique n'est plus disponible sur Zandofy.",
      canonical,
      image: `${getSiteUrl()}/og-default.jpg`,
      ogType: "website",
      robots: "noindex,nofollow",
      httpStatus: 410,
      bodyHtml: buildSeoMainHtml({
        h1: "Boutique indisponible",
        description: "Cette boutique n'est plus disponible sur Zandofy.",
        breadcrumb: [
          { name: "Accueil", href: `${getSiteUrl()}/` },
          { name: "Boutiques", href: `${getSiteUrl()}/stores` },
          { name: "Indisponible", href: canonical },
        ],
        ctaHref: `${getSiteUrl()}/stores`,
        ctaLabel: "Voir les boutiques Zandofy",
      }),
    };
  }

  const image = toAbsoluteOgImage(s.banner_url || s.logo_url);
  const titleTpl = cfg.store_title_template || "{name} Boutique | Zandofy";
  const descTpl =
    cfg.store_description_template ||
    "Découvrez la boutique {name} sur Zandofy. Produits prix usine, livraison en Afrique.";
  const location = [s.city, s.country].filter(Boolean).join(", ");
  const rawTitle = s.meta_title || applyTemplate(titleTpl, { name: s.name, brand: "Zandofy" });
  const title =
    rawTitle.length <= 60
      ? rawTitle
      : buildPageTitle({ primary: s.name, suffix: "Boutique | Zandofy", max: 60 });
  const description = truncate(
    s.meta_description ||
      s.description ||
      applyTemplate(descTpl, { name: s.name, brand: "Zandofy" }) +
        (location ? ` (${location})` : ""),
    155,
  );

  const products = await sbFetch(
    `products_public?store_id=eq.${s.id}&select=id,slug,name,name_fr,price,currency,product_images(image_url,position)&order=updated_at.desc&limit=24`,
  );
  const productLinks = products.map((p: any) => ({
    name: p.name_fr || p.name,
    href: `${getSiteUrl()}/product/${p.slug || p.id}`,
  }));
  const itemListElement = productLinks.map((p, i) => ({
    "@type": "ListItem",
    position: i + 1,
    url: p.href,
    name: p.name,
  }));

  const storeLd: Record<string, unknown> = {
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
  const reviewCount = Number(s.review_count_override) || 0;
  if (s.rating && reviewCount > 0) {
    storeLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: s.rating,
      reviewCount,
    };
  }
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: `${getSiteUrl()}/` },
      { "@type": "ListItem", position: 2, name: "Boutiques", item: `${getSiteUrl()}/stores` },
      { "@type": "ListItem", position: 3, name: s.name, item: canonical },
    ],
  };
  const itemList =
    itemListElement.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `Produits — ${s.name}`,
          numberOfItems: itemListElement.length,
          itemListElement,
        }
      : null;

  return {
    title,
    description,
    canonical,
    image,
    ogType: "website",
    keywords: Array.isArray(s.seo_keywords) ? s.seo_keywords.join(", ") : undefined,
    jsonLd: itemList ? [storeLd, breadcrumb, itemList] : [storeLd, breadcrumb],
    bodyHtml: buildSeoMainHtml({
      h1: s.name,
      description,
      productLinks,
      breadcrumb: [
        { name: "Accueil", href: `${getSiteUrl()}/` },
        { name: "Boutiques", href: `${getSiteUrl()}/stores` },
        { name: s.name, href: canonical },
      ],
      ctaHref: canonical,
      ctaLabel: "Voir la boutique sur Zandofy",
    }),
  };
}

async function buildCategoryMeta(slug: string): Promise<MetaPayload | null> {
  const cfg = await getSeoConfig();
  const rows = await sbFetch(
    `categories?select=id,name,name_fr,image_url,meta_title,meta_description,seo_keywords,og_image_url,parent_id,seo_body,seo_faq&limit=500`,
  );
  const c =
    rows.find(
      (r) => slugify(r.name_fr || "") === slug || slugify(r.name || "") === slug,
    ) || null;

  // Soft-404 prevention: unknown category slug → null → HTTP 404
  if (!c) return null;

  const displayName = c.name_fr || c.name;
  const canonical = `${getSiteUrl()}/category/${slug}`;
  const image = toAbsoluteOgImage(c.og_image_url || c.image_url);
  const titleTpl = cfg.category_title_template || "{name} à prix Kinshasa | Zandofy";
  const descTpl =
    cfg.category_description_template ||
    "Achetez {name} sur Zandofy à Kinshasa — import Chine & livraison Afrique. Prix usine, logistique inclusive.";

  const rawCatTitle =
    c.meta_title || applyTemplate(titleTpl, { name: displayName, brand: cfg.brand_name || "Zandofy" });
  const title =
    rawCatTitle.length <= 60
      ? rawCatTitle
      : buildPageTitle({ primary: displayName, suffix: "| Zandofy", max: 60 });
  const description = truncate(
    c.meta_description ||
      (c.seo_body ? stripHtml(String(c.seo_body)).slice(0, 160) : "") ||
      applyTemplate(descTpl, { name: displayName, brand: cfg.brand_name || "Zandofy" }),
    155,
  );

  const products = c.id
    ? await sbFetch(
        `products_public?category_id=eq.${c.id}&select=id,slug,name,name_fr,price,currency,product_images(image_url,position)&order=updated_at.desc&limit=12`,
      )
    : [];

  const itemListElement = products.map((p: any, i: number) => {
    const imgs = Array.isArray(p.product_images)
      ? [...p.product_images].sort((a: any, b: any) => (a?.position ?? 0) - (b?.position ?? 0))
      : [];
    return {
      "@type": "ListItem",
      position: i + 1,
      url: `${getSiteUrl()}/product/${p.slug || p.id}`,
      name: p.name_fr || p.name,
      image: toAbsoluteOgImage(imgs[0]?.image_url),
    };
  });

  const collectionLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: displayName,
    url: canonical,
    image,
    description,
  };
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: `${getSiteUrl()}/` },
      { "@type": "ListItem", position: 2, name: displayName, item: canonical },
    ],
  };
  const itemList =
    itemListElement.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: displayName,
          numberOfItems: itemListElement.length,
          itemListElement,
        }
      : null;

  const faqItems = Array.isArray(c.seo_faq)
    ? (c.seo_faq as { question?: string; answer?: string }[]).filter(
        (f) => f?.question && f?.answer,
      )
    : [];
  const faqLd =
    faqItems.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqItems.map((f) => ({
            "@type": "Question",
            name: f.question,
            acceptedAnswer: { "@type": "Answer", text: f.answer },
          })),
        }
      : null;

  const jsonNodes: Record<string, unknown>[] = [collectionLd, breadcrumb];
  if (itemList) jsonNodes.push(itemList);
  if (faqLd) jsonNodes.push(faqLd);

  return {
    title,
    description,
    canonical,
    image,
    ogType: "website",
    keywords: Array.isArray(c.seo_keywords) ? c.seo_keywords.join(", ") : undefined,
    jsonLd: jsonNodes,
    bodyHtml: buildSeoMainHtml({
      h1: displayName,
      description,
      articleBody: c.seo_body ? String(c.seo_body) : undefined,
      breadcrumb: [
        { name: "Accueil", href: `${getSiteUrl()}/` },
        { name: displayName, href: canonical },
      ],
      ctaHref: canonical,
      ctaLabel: "Voir la catégorie sur Zandofy",
    }),
  };
}

async function buildBlogMeta(slug: string): Promise<MetaPayload | null> {
  const rows = await sbFetch(
    `blog_posts?slug=eq.${encodeURIComponent(slug)}&status=eq.published&select=title,excerpt,content,meta_title,meta_description,cover_image_url,og_image_url,published_at,updated_at,seo_keywords,author_id&limit=1`,
  );
  const b = rows[0];
  if (!b) return null;

  const canonical = `${getSiteUrl()}/blog/${slug}`;
  const image = toAbsoluteOgImage(b.og_image_url || b.cover_image_url);
  const title = b.meta_title || `${b.title} | Zandofy`;
  const description = truncate(b.meta_description || b.excerpt || b.title);
  const articleBody = b.content || b.excerpt || "";

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
      dateModified: b.updated_at || b.published_at,
      articleBody: articleBody ? stripHtml(String(articleBody)).slice(0, 5000) : undefined,
      keywords: Array.isArray(b.seo_keywords) ? b.seo_keywords.join(", ") : undefined,
      publisher: {
        "@type": "Organization",
        name: "Zandofy",
        logo: { "@type": "ImageObject", url: `${getSiteUrl()}/icons/icon-512.png` },
      },
    },
    bodyHtml: buildSeoMainHtml({
      h1: b.title,
      description,
      articleBody: articleBody || undefined,
      breadcrumb: [
        { name: "Accueil", href: `${getSiteUrl()}/` },
        { name: "Blog", href: `${getSiteUrl()}/blog` },
        { name: b.title, href: canonical },
      ],
      ctaHref: canonical,
      ctaLabel: "Lire l'article sur Zandofy",
    }),
  };
}

function applyOverride(merged: MetaPayload, override: SeoOverride | null): MetaPayload {
  if (!override) return merged;
  if (override.title) merged.title = override.title;
  if (override.description) merged.description = truncate(override.description);
  if (override.og_image) merged.image = toAbsoluteOgImage(override.og_image);
  if (override.keywords && override.keywords.length) merged.keywords = override.keywords.join(", ");
  if (override.robots) merged.robots = override.robots;
  if (override.og_title) merged.ogTitle = override.og_title;
  if (override.jsonld_extra) {
    merged.jsonLd = mergeJsonLd(
      Array.isArray(merged.jsonLd) ? merged.jsonLd : merged.jsonLd ? [merged.jsonLd] : undefined,
      override.jsonld_extra,
    ) as MetaPayload["jsonLd"];
  }
  return merged;
}

async function buildMetaForPath(pathname: string): Promise<MetaPayload | null> {
  const override = await getOverride(pathname);

  const productMatch = pathname.match(/^\/product\/([^/?#]+)/i);
  if (productMatch) {
    const meta = await buildProductMeta(decodeURIComponent(productMatch[1]));
    return meta ? applyOverride(meta, override) : null;
  }

  const storeMatch = pathname.match(/^\/store\/([^/?#]+)/i);
  if (storeMatch) {
    const meta = await buildStoreMeta(decodeURIComponent(storeMatch[1]));
    return meta ? applyOverride(meta, override) : null;
  }

  const categoryMatch = pathname.match(/^\/category\/([^/?#]+)/i);
  if (categoryMatch) {
    const meta = await buildCategoryMeta(decodeURIComponent(categoryMatch[1]));
    return meta ? applyOverride(meta, override) : null;
  }

  const blogMatch = pathname.match(/^\/blog\/([^/?#]+)/i);
  if (blogMatch) {
    const meta = await buildBlogMeta(decodeURIComponent(blogMatch[1]));
    return meta ? applyOverride(meta, override) : null;
  }

  if (GLOBAL_ROUTES.has(pathname)) {
    const base = await buildGlobalMeta(pathname);
    if (!base && !override) return null;
    const merged: MetaPayload = base || {
      title: "Zandofy",
      description: "",
      canonical: `${getSiteUrl()}${pathname}`,
      ogType: "website",
    };
    return applyOverride(merged, override);
  }

  return null;
}

function buildFallbackMeta(pathname: string): MetaPayload {
  const canonical = `${getSiteUrl()}${pathname}`;
  return {
    title: "Zandofy",
    description: "Marketplace Zandofy",
    canonical,
    image: `${getSiteUrl()}/og-default.jpg`,
    ogType: "website",
    robots: "noindex,nofollow",
  };
}

function buildHeadInjection(meta: MetaPayload): string {
  const t = escapeHtml(meta.title);
  const ogT = escapeHtml(meta.ogTitle || meta.title);
  const d = escapeHtml(meta.description);
  const c = escapeHtml(meta.canonical);
  const img = escapeHtml(toAbsoluteOgImage(meta.image));
  const imgAlt = escapeHtml(meta.imageAlt || meta.title);
  const ogType = meta.ogType || "website";
  const robots = meta.robots || "index,follow";
  const fbAppId = getFacebookAppId();

  let html = `
<!-- BEGIN injected SEO (meta-injector edge fn) -->
<title>${t}</title>
<meta name="robots" content="${escapeHtml(robots)}" />
<meta name="description" content="${d}" />
<link rel="canonical" href="${c}" />
<link rel="alternate" hreflang="fr-CD" href="${c}" />
<link rel="alternate" hreflang="x-default" href="${c}" />
<meta property="og:type" content="${ogType}" />
<meta property="og:site_name" content="Zandofy" />
<meta property="og:locale" content="fr_CD" />
<meta property="og:url" content="${c}" />
<meta property="og:title" content="${ogT}" />
<meta property="og:description" content="${d}" />
<meta property="og:image" content="${img}" />
${img.startsWith("https://") ? `<meta property="og:image:secure_url" content="${img}" />` : ""}
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="${imgAlt}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:site" content="@Zandofy" />
<meta name="twitter:title" content="${ogT}" />
<meta name="twitter:description" content="${d}" />
<meta name="twitter:image" content="${img}" />`;
  if (fbAppId) {
    html += `\n<meta property="fb:app_id" content="${escapeHtml(fbAppId)}" />`;
  }
  if (meta.keywords) {
    html += `\n<meta name="keywords" content="${escapeHtml(meta.keywords)}" />`;
  }

  if (meta.jsonLd) {
    const nodes = Array.isArray(meta.jsonLd) ? meta.jsonLd : [meta.jsonLd];
    for (const node of nodes) {
      html += `\n<script type="application/ld+json">${escapeJsonLd(JSON.stringify(node))}</script>`;
    }
  }
  html += `\n<!-- END injected SEO -->\n`;
  return html;
}

function injectMetaIntoHtml(html: string, meta: MetaPayload): string {
  const headOpenIdx = html.search(/<head[^>]*>/i);
  const headCloseIdx = html.search(/<\/head>/i);
  if (headOpenIdx === -1 || headCloseIdx === -1) return html;
  const before = html.slice(0, html.indexOf(">", headOpenIdx) + 1);
  const headInner = html.slice(html.indexOf(">", headOpenIdx) + 1, headCloseIdx);
  const afterHead = html.slice(headCloseIdx);
  const cleanedHead = stripStaticSeo(headInner);
  let out = before + cleanedHead + buildHeadInjection(meta) + afterHead;

  // Avoid duplicate crawler mains (static index.html home + injector)
  out = out.replace(/<main\b[^>]*\bid=["']zandofy-seo-main["'][^>]*>[\s\S]*?<\/main>/gi, "");

  if (meta.bodyHtml) {
    // Prefer insert before </body>; else after #root so SPA still mounts.
    if (/<\/body>/i.test(out)) {
      out = out.replace(/<\/body>/i, `${meta.bodyHtml}</body>`);
    } else if (/<div[^>]+id=["']root["'][^>]*>\s*<\/div>/i.test(out)) {
      out = out.replace(
        /(<div[^>]+id=["']root["'][^>]*>\s*<\/div>)/i,
        `$1${meta.bodyHtml}`,
      );
    }
  }
  return out;
}

function stripStaticSeo(head: string): string {
  return head
    .replace(/<title>[\s\S]*?<\/title>/gi, "")
    .replace(/<link[^>]+rel=["']canonical["'][^>]*>/gi, "")
    .replace(/<link[^>]+rel=["']alternate["'][^>]*>/gi, "")
    .replace(/<meta[^>]+name=["']description["'][^>]*>/gi, "")
    .replace(/<meta[^>]+name=["']robots["'][^>]*>/gi, "")
    .replace(/<meta[^>]+name=["']keywords["'][^>]*>/gi, "")
    .replace(/<meta[^>]+property=["']og:[^"']+["'][^>]*>/gi, "")
    .replace(/<meta[^>]+name=["']twitter:[^"']+["'][^>]*>/gi, "")
    // Also match attribute order content=… property=og:…
    .replace(/<meta[^>]+content=["'][^"']*["'][^>]+property=["']og:[^"']+["'][^>]*>/gi, "")
    .replace(/<meta[^>]+content=["'][^"']*["'][^>]+name=["']twitter:[^"']+["'][^>]*>/gi, "")
    .replace(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, "");
}

function notFoundPayload(
  kind: "category" | "store" | "product",
  pathname: string,
  status: 404 | 410,
): MetaPayload {
  const labels = {
    product: { title: "Produit retiré | Zandofy", h1: "Produit retiré", desc: "Ce produit n'est plus disponible sur Zandofy." },
    category: { title: "Catégorie introuvable | Zandofy", h1: "Catégorie introuvable", desc: "Cette catégorie n'existe pas sur Zandofy." },
    store: { title: "Boutique introuvable | Zandofy", h1: "Boutique introuvable", desc: "Cette boutique n'existe pas sur Zandofy." },
  }[kind];
  const path = pathname.split("?")[0];
  return {
    title: labels.title,
    description: labels.desc,
    canonical: `${getSiteUrl()}${path}`,
    image: `${getSiteUrl()}/og-default.jpg`,
    ogType: "website",
    robots: "noindex,nofollow",
    httpStatus: status,
    bodyHtml: buildSeoMainHtml({
      h1: labels.h1,
      description: labels.desc,
      breadcrumb: [
        { name: "Accueil", href: `${getSiteUrl()}/` },
        { name: labels.h1, href: `${getSiteUrl()}${path}` },
      ],
      ctaHref: `${getSiteUrl()}/`,
      ctaLabel: "Retour à l'accueil Zandofy",
    }),
  };
}

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const ua = req.headers.get("user-agent");

  if (req.headers.get("x-purge-cache") === "1") {
    _seoCache = { value: null, expiresAt: 0 };
    _overridesCache = { value: null, expiresAt: 0 };
    return new Response(JSON.stringify({ purged: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Non-bot direct hits must NOT self-redirect (Vercel log spam / redirect chains).
  if (!isBot(ua)) {
    return new Response("Gone", {
      status: 410,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=300",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  }

  const indexUrl = `${url.origin}/index.html`;
  const indexRes = await fetch(indexUrl, {
    headers: { "User-Agent": "meta-injector/1.0" },
  });
  if (!indexRes.ok) {
    return new Response("upstream index.html unavailable", { status: 502 });
  }
  let html = await indexRes.text();

  const pathname = resolveRequestPathname(req, url);
  const isDynamic = isDynamicSeoPath(pathname);
  const isProductPath = /^\/product\/[^/?#]+/i.test(pathname);
  const isStorePath = /^\/store\/[^/?#]+/i.test(pathname);
  const isCategoryPath = /^\/category\/[^/?#]+/i.test(pathname);

  let meta: MetaPayload | null = null;
  try {
    meta = await buildMetaForPath(pathname);
  } catch (err) {
    console.warn("[meta-injector] buildMetaForPath failed", pathname, err);
    meta = null;
  }

  if (!meta && isProductPath) {
    const gone = notFoundPayload("product", pathname, 410);
    html = injectMetaIntoHtml(html, gone);
    return new Response(html, {
      status: 410,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=60, s-maxage=60",
        "X-Robots-Tag": "noindex, nofollow",
        Vary: "User-Agent",
      },
    });
  }

  if (!meta && isStorePath) {
    const miss = notFoundPayload("store", pathname, 404);
    html = injectMetaIntoHtml(html, miss);
    return new Response(html, {
      status: 404,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=60, s-maxage=60",
        "X-Robots-Tag": "noindex, nofollow",
        Vary: "User-Agent",
      },
    });
  }

  if (!meta && isCategoryPath) {
    const miss = notFoundPayload("category", pathname, 404);
    html = injectMetaIntoHtml(html, miss);
    return new Response(html, {
      status: 404,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=60, s-maxage=60",
        "X-Robots-Tag": "noindex, nofollow",
        Vary: "User-Agent",
      },
    });
  }

  if (!meta && isDynamic) {
    console.warn("[meta-injector] no meta for dynamic path, using fallback", pathname);
    meta = buildFallbackMeta(pathname);
  }

  if (meta) {
    html = injectMetaIntoHtml(html, meta);
  } else if (isDynamic) {
    html = injectMetaIntoHtml(html, buildFallbackMeta(pathname));
  }

  const cacheControl = isDynamic
    ? "public, max-age=60, s-maxage=60, stale-while-revalidate=300"
    : "public, max-age=300, s-maxage=600, stale-while-revalidate=86400";

  const xRobots = meta?.robots || "index, follow";
  const responseHeaders: Record<string, string> = {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": cacheControl,
    "X-Robots-Tag": xRobots,
    Vary: "User-Agent",
  };
  if (process.env.VERCEL_ENV === "preview") {
    responseHeaders["X-Debug-Pathname"] = pathname;
  }

  return new Response(html, {
    status: meta?.httpStatus || 200,
    headers: responseHeaders,
  });
}
