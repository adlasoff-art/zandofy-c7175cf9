import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FooterTheme {
  bg_color: string;
  text_color: string;
  link_color: string;
  guarantee_icon_color: string;
  guarantee_icon_style: "outline" | "filled";
  guarantee_bg_color: string;
  newsletter_btn_bg: string;
  newsletter_btn_text: string;
  newsletter_input_bg: string;
  social_icon_color: string;
  social_border_color: string;
  section_title_color: string;
}

const DEFAULTS: FooterTheme = {
  bg_color: "",
  text_color: "",
  link_color: "",
  guarantee_icon_color: "",
  guarantee_icon_style: "outline",
  guarantee_bg_color: "",
  newsletter_btn_bg: "",
  newsletter_btn_text: "",
  newsletter_input_bg: "",
  social_icon_color: "",
  social_border_color: "",
  section_title_color: "",
};

export function useFooterTheme() {
  const { data: theme } = useQuery({
    queryKey: ["footer-theme"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "footer_theme")
        .maybeSingle();
      return { ...DEFAULTS, ...(data?.value as any || {}) } as FooterTheme;
    },
    staleTime: 5 * 60 * 1000,
  });
  return theme || DEFAULTS;
}
