import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SeoConfig {
  site_title: string;
  site_description: string;
  default_keywords: string[];
}

const DEFAULT_CONFIG: SeoConfig = {
  site_title: "Zandofy — Marketplace Mode, Électronique & Maison",
  site_description:
    "Découvrez des milliers de produits mode, électronique, maison et beauté sur Zandofy. Livraison gratuite, vendeurs vérifiés, prix compétitifs.",
  default_keywords: [],
};

let cachedConfig: SeoConfig | null = null;

export function useSeoConfig() {
  const [config, setConfig] = useState<SeoConfig>(cachedConfig ?? DEFAULT_CONFIG);

  useEffect(() => {
    if (cachedConfig) return;

    supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "seo_config")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) {
          const v = data.value as any;
          const c: SeoConfig = {
            site_title: v.site_title || DEFAULT_CONFIG.site_title,
            site_description: v.site_description || DEFAULT_CONFIG.site_description,
            default_keywords: v.default_keywords || [],
          };
          cachedConfig = c;
          setConfig(c);
        }
      });
  }, []);

  return config;
}
