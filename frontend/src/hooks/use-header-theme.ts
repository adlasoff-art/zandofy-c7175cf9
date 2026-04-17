import { useBootstrapSetting } from "@/hooks/use-platform-bootstrap";

export interface HeaderTheme {
  bg_color: string;
  text_color: string;
  icon_color: string;
  badge_bg_color: string;
  badge_text_color: string;
  nav_bg_color: string;
  nav_text_color: string;
  nav_highlight_color: string;
  scrollbar_color: string;
}

const DEFAULTS: HeaderTheme = {
  bg_color: "",
  text_color: "",
  icon_color: "",
  badge_bg_color: "",
  badge_text_color: "",
  nav_bg_color: "",
  nav_text_color: "",
  nav_highlight_color: "",
  scrollbar_color: "",
};

export function useHeaderTheme() {
  const { value } = useBootstrapSetting<Partial<HeaderTheme>>("header_theme");
  return { ...DEFAULTS, ...(value || {}) } as HeaderTheme;
}
