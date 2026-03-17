import { useEffect } from "react";
import { useSeoEnabled } from "@/hooks/use-seo-enabled";

interface SEOHeadProps {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  ogType?: string;
  jsonLd?: Record<string, any>;
}

const SITE_NAME = "Zandofy";
const SITE_URL = import.meta.env.VITE_SITE_URL || "https://zandofy.com";

export function SEOHead({ title, description, canonical, ogImage, ogType = "website", jsonLd }: SEOHeadProps) {
  const { seoEnabled } = useSeoEnabled();

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

    // When SEO is disabled, force noindex/nofollow
    if (!seoEnabled) {
      setMeta("robots", "noindex, nofollow");
      // Still set title for browser tab but skip all other SEO tags
      return () => {
        document.querySelector('script[data-seo-jsonld]')?.remove();
      };
    }

    // SEO enabled — set all meta tags
    setMeta("robots", "index, follow");
    setMeta("description", description);
    setMeta("og:title", fullTitle, "property");
    setMeta("og:description", description, "property");
    setMeta("og:type", ogType, "property");
    setMeta("og:site_name", SITE_NAME, "property");
    if (ogImage) setMeta("og:image", ogImage, "property");

    // Twitter Card
    setMeta("twitter:card", ogImage ? "summary_large_image" : "summary");
    setMeta("twitter:title", fullTitle);
    setMeta("twitter:description", description);
    if (ogImage) setMeta("twitter:image", ogImage);

    if (canonical) {
      const url = canonical.startsWith("http") ? canonical : `${SITE_URL}${canonical}`;
      let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement("link");
        link.rel = "canonical";
        document.head.appendChild(link);
      }
      link.href = url;
    }

    if (jsonLd) {
      let script = document.querySelector('script[data-seo-jsonld]') as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement("script");
        script.type = "application/ld+json";
        script.setAttribute("data-seo-jsonld", "true");
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(jsonLd);
    }

    return () => {
      document.querySelector('script[data-seo-jsonld]')?.remove();
    };
  }, [title, description, canonical, ogImage, ogType, jsonLd, seoEnabled]);

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
      price: product.price.toFixed(2),
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
export function buildBreadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url.startsWith("http") ? item.url : `https://zandofy.lovable.app${item.url}`,
    })),
  };
}
