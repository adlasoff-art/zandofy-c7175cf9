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
}

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
    });
  }, [value]);

  return config;
}
