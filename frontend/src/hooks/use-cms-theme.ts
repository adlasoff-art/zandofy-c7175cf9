import { useEffect, useState } from "react";
import { useBootstrapSetting } from "@/hooks/use-platform-bootstrap";

export interface ThemeColors {
  primary_h: number;
  primary_s: number;
  primary_l: number;
  accent_h: number;
  accent_s: number;
  accent_l: number;
  destructive_h: number;
  destructive_s: number;
  destructive_l: number;
  badge_new: string;
  badge_sale: string;
  badge_hot: string;
  promo_banner_bg: string;
  promo_banner_text: string;
  category_highlight: string;
}

const CSS_VAR_MAP: Record<string, (t: ThemeColors) => string> = {
  "--primary": (t) => `${t.primary_h} ${t.primary_s}% ${t.primary_l}%`,
  "--primary-foreground": () => "0 0% 100%",
  "--ring": (t) => `${t.primary_h} ${t.primary_s}% ${t.primary_l}%`,
  "--accent": (t) => `${t.accent_h} ${t.accent_s}% ${t.accent_l}%`,
  "--accent-foreground": (t) => `${t.primary_h} ${t.primary_s}% 10%`,
  "--secondary": (t) => `${t.primary_h} 100% 93%`,
  "--secondary-foreground": (t) => `${t.primary_h} 55% 18%`,
  "--sidebar-primary": (t) => `${t.primary_h} ${t.primary_s}% ${t.primary_l}%`,
  "--sidebar-primary-foreground": () => "0 0% 100%",
  "--sidebar-ring": (t) => `${t.primary_h} ${t.primary_s}% ${t.primary_l}%`,
  "--destructive": (t) => `${t.destructive_h} ${t.destructive_s}% ${t.destructive_l}%`,
};

/**
 * Reads theme_colors from the shared platform-bootstrap cache and injects CSS vars.
 */
export function useCmsTheme() {
  const { value } = useBootstrapSetting<ThemeColors>("theme_colors");
  const [theme, setTheme] = useState<ThemeColors | null>(null);

  useEffect(() => {
    if (value) {
      setTheme(value);
      applyTheme(value);
    }
  }, [value]);

  return theme;
}

function applyTheme(t: ThemeColors) {
  const root = document.documentElement;
  for (const [varName, fn] of Object.entries(CSS_VAR_MAP)) {
    root.style.setProperty(varName, fn(t));
  }

  root.style.setProperty(
    "--brand-gradient",
    `linear-gradient(135deg, hsl(${t.primary_h} ${t.primary_s}% ${t.primary_l}%), hsl(${t.accent_h} ${t.accent_s}% ${t.accent_l}%))`
  );
  root.style.setProperty(
    "--brand-gradient-soft",
    `linear-gradient(135deg, hsl(${t.primary_h} 100% 93%), hsl(${t.primary_h} 60% 96%))`
  );
  root.style.setProperty(
    "--shadow-brand",
    `0 4px 20px -4px hsl(${t.primary_h} ${t.primary_s}% ${t.primary_l}% / 0.15)`
  );

  root.style.setProperty("--background", `${t.primary_h} 15% 96%`);
  root.style.setProperty("--foreground", `${t.primary_h} 55% 18%`);
  root.style.setProperty("--card-foreground", `${t.primary_h} 55% 18%`);
  root.style.setProperty("--muted", `${t.primary_h} 20% 95%`);
  root.style.setProperty("--muted-foreground", `${t.primary_h} 10% 45%`);
  root.style.setProperty("--border", `${t.primary_h} 20% 88%`);
  root.style.setProperty("--input", `${t.primary_h} 20% 88%`);

  root.style.setProperty("--sidebar-background", `${t.primary_h} 100% 97%`);
  root.style.setProperty("--sidebar-foreground", `${t.primary_h} 55% 18%`);
  root.style.setProperty("--sidebar-accent", `${t.primary_h} 40% 92%`);
  root.style.setProperty("--sidebar-accent-foreground", `${t.primary_h} 55% 18%`);
  root.style.setProperty("--sidebar-border", `${t.primary_h} 20% 88%`);
}
