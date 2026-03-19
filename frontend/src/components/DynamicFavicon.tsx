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

    // Update manifest dynamically for PWA icons
    if (branding.pwa_icon_192_url || branding.pwa_icon_512_url) {
      const manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
      if (manifestLink) {
        // Create a dynamic manifest blob
        fetch(manifestLink.href)
          .then(r => r.json())
          .then(manifest => {
            const icons = [...(manifest.icons || [])];
            if (branding.pwa_icon_192_url) {
              const idx192 = icons.findIndex((i: any) => i.sizes === "192x192");
              if (idx192 >= 0) icons[idx192] = { ...icons[idx192], src: branding.pwa_icon_192_url };
              else icons.push({ src: branding.pwa_icon_192_url, sizes: "192x192", type: "image/png", purpose: "any maskable" });
            }
            if (branding.pwa_icon_512_url) {
              const idx512 = icons.findIndex((i: any) => i.sizes === "512x512");
              if (idx512 >= 0) icons[idx512] = { ...icons[idx512], src: branding.pwa_icon_512_url };
              else icons.push({ src: branding.pwa_icon_512_url, sizes: "512x512", type: "image/png", purpose: "any maskable" });
            }
            manifest.icons = icons;
            const blob = new Blob([JSON.stringify(manifest)], { type: "application/json" });
            manifestLink.href = URL.createObjectURL(blob);
          })
          .catch(() => {}); // Silently fail
      }
    }
  }, [branding]);

  return null;
}
