import { useEffect } from "react";
import { useBranding } from "@/hooks/use-branding";

/**
 * Dynamically updates the favicon and PWA manifest icons based on CMS branding settings.
 * Place once in the app root.
 */
export function DynamicFavicon() {
  const { data: branding } = useBranding();

  useEffect(() => {
    if (!branding) return;

    // Update favicon
    if (branding.favicon_url) {
      const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (link) {
        link.href = branding.favicon_url;
      }
      const appleLink = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
      if (appleLink) {
        appleLink.href = branding.favicon_url;
      }
    }

    // Prefer static /manifest.json for installability (TWA/APK). Never replace with blob URL.
    // CMS PWA icons are applied as apple-touch / favicon only above.
  }, [branding]);

  return null;
}
