import { useEffect, useState } from "react";
import { useBootstrapSetting } from "@/hooks/use-platform-bootstrap";

interface SocialUrls {
  facebook?: string;
  instagram?: string;
  twitter?: string;
}

export interface SeoConfig {
  site_title: string;
  site_description: string;
  default_keywords: string[];
  default_og_image: string;
  site_language: string;
  brand_name: string;
  tagline: string;
  social_urls: SocialUrls;
  google_site_verification: string;
  google_analytics_id: string;
  category_title_template: string;
  category_description_template: string;
  product_title_template: string;
  product_description_template: string;
  store_title_template: string;
  store_description_template: string;
  sitelinks_nav: { name: string; url: string }[];
}

export const DEFAULT_SITELINKS_NAV = [
  { name: "Fournisseurs fiables", url: "/stores" },
  { name: "Populaires", url: "/popular" },
  { name: "Tendances", url: "/trends" },
  { name: "Blog", url: "/blog" },
  { name: "Centre d'aide", url: "/help-center" },
  { name: "Devenir vendeur", url: "/become-vendor" },
  { name: "Programme d'affiliation", url: "/affiliate-program" },
  { name: "À propos", url: "/about" },
];

const DEFAULT_CONFIG: SeoConfig = {
  site_title: "Zandofy — Achetez en Chine, livré en Afrique | Prix usine",
  site_description:
    "Achetez directement aux usines chinoises, turques et internationales. Zandofy gère fournisseurs, logistique et livraison en Afrique. Prix imbattables, support en français.",
  default_keywords: [
    "acheter en chine depuis l'afrique",
    "importer de chine afrique",
    "fournisseur chine afrique",
    "transitaire chine afrique",
    "marketplace sino-africaine",
    "prix usine chine",
    "zandofy",
    "e-commerce afrique",
    "logistique chine afrique",
  ],
  default_og_image: "",
  site_language: "fr",
  brand_name: "Zandofy",
  tagline: "Première plateforme e-commerce sino-africaine d'achat et logistique en Chine et à l'international.",
  social_urls: {},
  google_site_verification: "",
  google_analytics_id: "",
  category_title_template: "{name} à prix Kinshasa | Zandofy",
  category_description_template:
    "Achetez {name} sur Zandofy à Kinshasa — import Chine & livraison Afrique. Prix usine, logistique inclusive.",
  product_title_template: "{name} — {category} à prix Kinshasa | Zandofy",
  product_description_template: "Achetez {name} sur Zandofy — import Chine & livraison Afrique.",
  store_title_template: "{name} — Boutique | Zandofy",
  store_description_template:
    "Découvrez la boutique {name} sur Zandofy. Produits prix usine, livraison en Afrique.",
  sitelinks_nav: DEFAULT_SITELINKS_NAV,
};

/**
 * Reads SEO config from the shared platform-bootstrap cache.
 * No additional network request.
 */
export function useSeoConfig() {
  const { value } = useBootstrapSetting<Partial<SeoConfig>>("seo_config");
  const [config, setConfig] = useState<SeoConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    if (!value) return;
    const v = value as any;
    setConfig({
      site_title: v.site_title || DEFAULT_CONFIG.site_title,
      site_description: v.site_description || DEFAULT_CONFIG.site_description,
      default_keywords: v.default_keywords || DEFAULT_CONFIG.default_keywords,
      default_og_image: v.default_og_image || "",
      site_language: v.site_language || "fr",
      brand_name: v.brand_name || "Zandofy",
      tagline: v.tagline || DEFAULT_CONFIG.tagline,
      social_urls: v.social_urls || {},
      google_site_verification: v.google_site_verification || "",
      google_analytics_id: v.google_analytics_id || "",
      category_title_template: v.category_title_template || DEFAULT_CONFIG.category_title_template,
      category_description_template:
        v.category_description_template || DEFAULT_CONFIG.category_description_template,
      product_title_template: v.product_title_template || DEFAULT_CONFIG.product_title_template,
      product_description_template:
        v.product_description_template || DEFAULT_CONFIG.product_description_template,
      store_title_template: v.store_title_template || DEFAULT_CONFIG.store_title_template,
      store_description_template:
        v.store_description_template || DEFAULT_CONFIG.store_description_template,
      sitelinks_nav:
        Array.isArray(v.sitelinks_nav) && v.sitelinks_nav.length
          ? v.sitelinks_nav
          : DEFAULT_CONFIG.sitelinks_nav,
    });
  }, [value]);

  return config;
}
