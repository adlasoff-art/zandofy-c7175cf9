import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BrandingConfig {
  header_logo_url: string | null;
  footer_logo_url: string | null;
  logo_mode: "text" | "logo_only" | "logo_and_text";
  favicon_url: string | null;
  pwa_icon_192_url: string | null;
  pwa_icon_512_url: string | null;
  email_logo_url: string | null;
  email_signature_name: string;
  email_signature_address: string;
  email_signature_phone: string;
  email_signature_email: string;
  email_signature_website: string;
  email_signature_extra: string;
}

const DEFAULT_BRANDING: BrandingConfig = {
  header_logo_url: null,
  footer_logo_url: null,
  logo_mode: "text",
  favicon_url: null,
  pwa_icon_192_url: null,
  pwa_icon_512_url: null,
  email_logo_url: null,
  email_signature_name: "Zandofy",
  email_signature_address: "",
  email_signature_phone: "",
  email_signature_email: "",
  email_signature_website: "https://zandofy.com",
  email_signature_extra: "",
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
