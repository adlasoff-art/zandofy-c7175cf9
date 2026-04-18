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

/**
 * Reads primary font from the shared platform-bootstrap cache (no extra request).
 */
export function usePlatformFont() {
  const { value } = useBootstrapSetting<any>("branding");
  const font = value?.primary_font || DEFAULT_FONT;

  useEffect(() => {
    document.documentElement.style.setProperty("--font-primary", font);
  }, [font]);
}
