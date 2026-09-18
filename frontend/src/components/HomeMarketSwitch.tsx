import { useHomeMarket, type HomeMarket } from "@/contexts/HomeMarketContext";
import { useI18n } from "@/contexts/I18nContext";
import { cn } from "@/lib/utils";

const OPTIONS: { value: HomeMarket; labelKey: string; fallbackFr: string; fallbackEn: string }[] = [
  { value: "all", labelKey: "home.marketAll", fallbackFr: "Tout", fallbackEn: "All" },
  { value: "local", labelKey: "home.marketLocal", fallbackFr: "Local", fallbackEn: "Local" },
  {
    value: "international",
    labelKey: "home.marketInternational",
    fallbackFr: "International",
    fallbackEn: "International",
  },
];

/** Discovery-only filter (stores.shop_type). Does not affect checkout. Mobile-first. */
export function HomeMarketSwitch({ className }: { className?: string }) {
  const { market, setMarket } = useHomeMarket();
  const { t, locale } = useI18n();

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-1 px-3 py-2 bg-card border-b border-border",
        className,
      )}
      role="tablist"
      aria-label={t("home.marketFilter") || "Marché"}
    >
      <div className="inline-flex rounded-full border border-border bg-muted/50 p-0.5 w-full max-w-md">
        {OPTIONS.map((opt) => {
          const label =
            t(opt.labelKey) || (locale === "fr" ? opt.fallbackFr : opt.fallbackEn);
          const active = market === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setMarket(opt.value)}
              className={cn(
                "flex-1 min-h-[40px] px-2 py-1.5 text-xs font-semibold rounded-full transition-colors touch-manipulation",
                active
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
