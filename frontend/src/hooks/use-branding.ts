import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BrandingConfig {
  header_logo_url: string | null;
  footer_logo_url: string | null;
  logo_mode: "text" | "logo_only" | "logo_and_text";
  favicon_url: string | null;
  pwa_icon_192_url: string | null;
  pwa_icon_512_url: string | null;
}

const DEFAULT_BRANDING: BrandingConfig = {
  header_logo_url: null,
  footer_logo_url: null,
  logo_mode: "text",
  favicon_url: null,
  pwa_icon_192_url: null,
  pwa_icon_512_url: null,
};

export function useBranding() {
  return useQuery({
    queryKey: ["branding"],
    queryFn: async (): Promise<BrandingConfig> => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "branding")
        .maybeSingle();

      if (error || !data) return DEFAULT_BRANDING;
      const v = data.value as any;
      return { ...DEFAULT_BRANDING, ...v };
    },
    staleTime: 5 * 60 * 1000,
  });
}
