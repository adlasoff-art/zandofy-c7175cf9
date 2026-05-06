import { useEffect } from "react";
import { useBootstrapSetting } from "@/hooks/use-platform-bootstrap";

export const PLATFORM_FONTS = [
  { value: "'Inter', system-ui, sans-serif", label: "Inter", description: "Sans-serif moderne, lisibilité optimale" },
  { value: "'Outfit', system-ui, sans-serif", label: "Outfit", description: "Police du logo Zandofy, élégante" },
  { value: "'Poppins', system-ui, sans-serif", label: "Poppins", description: "Géométrique moderne, e-commerce" },
  { value: "'DM Sans', system-ui, sans-serif", label: "DM Sans", description: "Clean et contemporain" },
  { value: "'Plus Jakarta Sans', system-ui, sans-serif", label: "Plus Jakarta Sans", description: "Élégant et professionnel" },
  { value: "'Roboto', system-ui, sans-serif", label: "Roboto", description: "Classique Google, universel" },
] as const;

const DEFAULT_FONT = PLATFORM_FONTS[0].value;

// Map CSS font-family value -> Google Fonts family parameter.
// Inter is loaded render-blocking by index.html; the others are lazy-injected
// only when an admin selects them via CMS branding (avoids ~85 KiB at first paint).
const GOOGLE_FONT_PARAMS: Record<string, string> = {
  Outfit: "Outfit:wght@400;500;600;700",
  Poppins: "Poppins:wght@400;500;600;700",
  "DM Sans": "DM+Sans:wght@400;500;600;700",
  "Plus Jakarta Sans": "Plus+Jakarta+Sans:wght@400;500;600;700",
  Roboto: "Roboto:wght@400;500;700",
};

function ensureGoogleFontLoaded(family: string) {
  const param = GOOGLE_FONT_PARAMS[family];
  if (!param) return; // Inter or system fallback — nothing to load
  const id = `gf-${family.replace(/\s+/g, "-").toLowerCase()}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${param}&display=swap`;
  document.head.appendChild(link);
}

/**
 * Reads primary font from the shared platform-bootstrap cache (no extra request).
 * Lazy-injects the matching Google Fonts stylesheet only when needed.
 */
export function usePlatformFont() {
  const { value } = useBootstrapSetting<any>("branding");
  const font = value?.primary_font || DEFAULT_FONT;

  useEffect(() => {
    document.documentElement.style.setProperty("--font-primary", font);
    // Extract the first family from the CSS stack, e.g. "'Outfit', system-ui" -> "Outfit"
    const match = font.match(/^['"]?([^'",]+)['"]?/);
    if (match) ensureGoogleFontLoaded(match[1].trim());
  }, [font]);
}
