import { useEffect } from "react";
import { useSeoEnabled } from "@/hooks/use-seo-enabled";
import { useSeoConfig } from "@/hooks/use-seo-config";

interface SEOHeadProps {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  /** Single schema object, or multiple nodes (wrapped in @graph automatically). */
  jsonLd?: Record<string, any> | Record<string, any>[];
  /** Force noindex,nofollow regardless of global SEO toggle (private pages). */
  noindex?: boolean;
}

/** Combine multiple JSON-LD nodes into one script (valid for Google). */
export function buildJsonLdGraph(...nodes: Record<string, any>[]) {
  return {
    "@context": "https://schema.org",
    "@graph": nodes.map(({ ["@context"]: _ctx, ...node }) => node),
  };
}

function normalizeJsonLd(jsonLd: Record<string, any> | Record<string, any>[]): Record<string, any> {
  if (Array.isArray(jsonLd)) {
    return buildJsonLdGraph(...jsonLd);
  }
  return jsonLd;
}

const SITE_NAME = "Zandofy";
const SITE_URL = import.meta.env.VITE_SITE_URL || "https://zandofy.com";

export function SEOHead({ title, description, canonical, ogImage, ogType = "website", jsonLd, noindex }: SEOHeadProps) {
  const { seoEnabled } = useSeoEnabled();
  const seoConfig = useSeoConfig();

  useEffect(() => {
    const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
    document.title = fullTitle;

    const setMeta = (name: string, content: string, attr = "name") => {
      let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.content = content;
    };

    // When SEO is disabled OR page explicitly requests noindex
    if (!seoEnabled || noindex) {
      setMeta("robots", "noindex, nofollow");
      return () => {
        document.querySelector('script[data-seo-jsonld]')?.remove();
      };
    }

    // SEO enabled — set all meta tags
    setMeta("robots", "index, follow");
    setMeta("description", description);

    const rawKw = seoConfig.default_keywords;
    const keywords = Array.isArray(rawKw)
      ? rawKw.filter(Boolean).join(", ")
      : typeof rawKw === "string"
        ? rawKw.trim()
        : "";
    if (keywords) {
      setMeta("keywords", keywords);
    }

    // Google Site Verification
    if (seoConfig.google_site_verification) {
      setMeta("google-site-verification", seoConfig.google_site_verification);
    }

    // Resolve OG image: prop > config default
    const resolvedOgImage = ogImage || seoConfig.default_og_image || undefined;

    // Open Graph
    setMeta("og:title", fullTitle, "property");
    setMeta("og:description", description, "property");
    setMeta("og:type", ogType, "property");
    setMeta("og:site_name", SITE_NAME, "property");
    if (resolvedOgImage) setMeta("og:image", resolvedOgImage, "property");

    // Twitter Card
    setMeta("twitter:card", resolvedOgImage ? "summary_large_image" : "summary");
    setMeta("twitter:title", fullTitle);
    setMeta("twitter:description", description);
    setMeta("twitter:site", "@Zandofy");
    if (resolvedOgImage) setMeta("twitter:image", resolvedOgImage);

    // Canonical — always set, fallback to current pathname
    const canonicalPath = canonical || window.location.pathname;
    const canonicalUrl = canonicalPath.startsWith("http") ? canonicalPath : `${SITE_URL}${canonicalPath}`;
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = canonicalUrl;

    // hreflang tags
    const lang = seoConfig.site_language || "fr";
    const currentUrl = canonical
      ? (canonical.startsWith("http") ? canonical : `${SITE_URL}${canonical}`)
      : `${SITE_URL}${window.location.pathname}`;

    const setHreflang = (hrefLang: string, href: string) => {
      let link = document.querySelector(`link[rel="alternate"][hreflang="${hrefLang}"]`) as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement("link");
        link.rel = "alternate";
        link.setAttribute("hreflang", hrefLang);
        document.head.appendChild(link);
      }
      link.href = href;
    };
    setHreflang(lang, currentUrl);
    setHreflang("x-default", currentUrl);

    // JSON-LD
    if (jsonLd) {
      let script = document.querySelector('script[data-seo-jsonld]') as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement("script");
        script.type = "application/ld+json";
        script.setAttribute("data-seo-jsonld", "true");
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(normalizeJsonLd(jsonLd));
    }

    // Google Analytics / GTM
    if (seoConfig.google_analytics_id) {
      const gaId = seoConfig.google_analytics_id;
      const existingScript = document.querySelector(`script[src*="googletagmanager.com"][data-seo-ga]`);
      if (!existingScript) {
        // gtag.js loader
        const gtagScript = document.createElement("script");
        gtagScript.async = true;
        gtagScript.src = gaId.startsWith("GTM-")
          ? `https://www.googletagmanager.com/gtm.js?id=${gaId}`
          : `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
        gtagScript.setAttribute("data-seo-ga", "true");
        document.head.appendChild(gtagScript);

        if (!gaId.startsWith("GTM-")) {
          const inlineScript = document.createElement("script");
          inlineScript.setAttribute("data-seo-ga-inline", "true");
          inlineScript.textContent = `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${gaId}');
          `;
          document.head.appendChild(inlineScript);
        }
      }
    }

    return () => {
      document.querySelector('script[data-seo-jsonld]')?.remove();
    };
  }, [title, description, canonical, ogImage, ogType, jsonLd, seoEnabled, seoConfig, noindex]);

  return null;
}

// ─── Helper: Build Product JSON-LD ────────────────────
export function buildProductJsonLd(product: {
  name: string;
  description?: string;
  image: string;
  price: number;
  currency: string;
  rating?: number;
  reviewCount?: number;
  sku?: string;
  storeName?: string;
}) {
  const ld: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: product.image,
    description: product.description || product.name,
    sku: product.sku || undefined,
    brand: product.storeName ? { "@type": "Brand", name: product.storeName } : undefined,
    offers: {
      "@type": "Offer",
      priceCurrency: product.currency || "USD",
      price: Number(product.price ?? 0).toFixed(2),
      availability: "https://schema.org/InStock",
      url: typeof window !== "undefined" ? window.location.href : "",
    },
  };
  if (product.rating && product.reviewCount) {
    ld.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: product.rating.toFixed(1),
      reviewCount: product.reviewCount,
    };
  }
  return ld;
}

// ─── Helper: Build BreadcrumbList JSON-LD ─────────────
/** Product listing pages (category, search results). */
export function buildProductItemListJsonLd(
  products: { name: string; slug?: string; id: string; image?: string; price?: number; currency?: string }[],
  listName: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: listName,
    numberOfItems: products.length,
    itemListElement: products.slice(0, 20).map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/product/${p.slug || p.id}`,
      item: {
        "@type": "Product",
        name: p.name,
        image: p.image,
        offers: p.price != null
          ? {
              "@type": "Offer",
              price: String(p.price),
              priceCurrency: p.currency || "USD",
            }
          : undefined,
      },
    })),
  };
}

/** Static marketplace FAQ for AEO (shipping / trust). */
export function buildMarketplaceFaqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Comment acheter sur Zandofy ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Créez un compte, parcourez le catalogue, ajoutez des articles au panier et finalisez le paiement. Le suivi de commande est disponible dans votre espace client.",
        },
      },
      {
        "@type": "Question",
        name: "Zandofy livre-t-il en Afrique ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Oui. Zandofy est une marketplace orientée import Chine → Afrique avec options de livraison à domicile ou retrait en hub selon la commande.",
        },
      },
      {
        "@type": "Question",
        name: "Comment devenir vendeur sur Zandofy ?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Rendez-vous sur la page Devenir vendeur pour soumettre votre boutique. L'équipe valide le profil avant publication des produits.",
        },
      },
    ],
  };
}

export function buildBreadcrumbJsonLd(items: { name: string; url: string }[]) {
  const validItems = items.filter(i => i.name && i.name.trim());
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: validItems.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : `${SITE_URL}${item.url}`,
    })),
  };
}
