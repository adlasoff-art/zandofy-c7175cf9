import { useEffect, useRef } from "react";
import { useI18n, CURRENCIES, LOCALES, type CurrencyCode, type Locale } from "@/contexts/I18nContext";
import { useTheme } from "@/contexts/ThemeContext";
import { Sun, Moon, Monitor } from "lucide-react";

interface Props {
  onClose: () => void;
}

export function CurrencySwitcher({ onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { locale, currency, setLocale, setCurrency, t } = useI18n();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const themeOptions = [
    { value: "light" as const, label: t("switcher.light"), icon: Sun },
    { value: "dark" as const, label: t("switcher.dark"), icon: Moon },
    { value: "system" as const, label: t("switcher.system"), icon: Monitor },
  ];

  return (
    <div ref={ref} className="absolute right-0 top-full mt-1 w-72 bg-card border border-border rounded-lg shadow-lg z-50 p-4 animate-fade-in">
      {/* Language */}
      <div className="mb-4">
        <span className="text-xs font-bold text-foreground uppercase tracking-wider">{t("switcher.language")}</span>
        <div className="flex gap-2 mt-2">
          {LOCALES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setLocale(lang.code)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                locale === lang.code
                  ? "bg-foreground text-card border-foreground"
                  : "bg-card text-foreground border-border hover:border-foreground"
              }`}
            >
              {lang.flag} {lang.label}
            </button>
          ))}
        </div>
      </div>

      {/* Theme */}
      <div className="mb-4">
        <span className="text-xs font-bold text-foreground uppercase tracking-wider">{t("switcher.theme")}</span>
        <div className="flex gap-2 mt-2">
          {themeOptions.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                  theme === opt.value
                    ? "bg-foreground text-card border-foreground"
                    : "bg-card text-foreground border-border hover:border-foreground"
                }`}
              >
                <Icon size={12} />
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Currency */}
      <div>
        <span className="text-xs font-bold text-foreground uppercase tracking-wider">{t("switcher.currency")}</span>
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
          className="mt-2 w-full px-3 py-2 text-sm bg-muted border border-border rounded-md outline-none focus:border-primary text-foreground"
        >
          {Object.values(CURRENCIES).map((c) => (
            <option key={c.code} value={c.code}>
              {c.symbol} — {c.label}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={onClose}
        className="mt-4 w-full py-2 text-xs font-bold bg-foreground text-card rounded-md hover:bg-foreground/90 transition-colors"
      >
        {t("switcher.apply")}
      </button>
    </div>
  );
}
