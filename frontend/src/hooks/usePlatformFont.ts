import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const PLATFORM_FONTS = [
  { value: "'Inter', system-ui, sans-serif", label: "Inter", description: "Sans-serif moderne, lisibilité optimale" },
  { value: "'Outfit', system-ui, sans-serif", label: "Outfit", description: "Police du logo Zandofy, élégante" },
  { value: "'Poppins', system-ui, sans-serif", label: "Poppins", description: "Géométrique moderne, e-commerce" },
  { value: "'DM Sans', system-ui, sans-serif", label: "DM Sans", description: "Clean et contemporain" },
  { value: "'Plus Jakarta Sans', system-ui, sans-serif", label: "Plus Jakarta Sans", description: "Élégant et professionnel" },
  { value: "'Roboto', system-ui, sans-serif", label: "Roboto", description: "Classique Google, universel" },
] as const;

const DEFAULT_FONT = PLATFORM_FONTS[0].value;

export function usePlatformFont() {
  const { data: fontValue } = useQuery({
    queryKey: ["platform-font"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "branding")
        .maybeSingle();
      const v = data?.value as any;
      return v?.primary_font || DEFAULT_FONT;
    },
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const font = fontValue || DEFAULT_FONT;
    document.documentElement.style.setProperty("--font-primary", font);
  }, [fontValue]);
}
