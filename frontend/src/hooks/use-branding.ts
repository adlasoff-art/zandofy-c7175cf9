import { useBootstrapSetting } from "@/hooks/use-platform-bootstrap";

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
  primary_font: string;
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
  primary_font: "'Inter', system-ui, sans-serif",
};

/**
 * Reads branding from the shared platform-bootstrap cache.
 * No additional network request — data is already in QueryClient.
 */
export function useBranding() {
  const { value, isLoading } = useBootstrapSetting<Partial<BrandingConfig>>(
    "branding"
  );
  const data: BrandingConfig = { ...DEFAULT_BRANDING, ...(value || {}) };
  return { data, isLoading };
}
