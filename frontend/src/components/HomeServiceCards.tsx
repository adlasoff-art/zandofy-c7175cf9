import { Link } from "react-router-dom";
import { LayoutGrid, PackageSearch, Sparkles, Store } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useI18n } from "@/contexts/I18nContext";
import { TOGGLE_CATEGORIES_EVENT } from "@/components/MobileBottomNav";

type ServiceCard = {
  id: string;
  labelKey: string;
  fallbackFr: string;
  fallbackEn: string;
  icon: typeof LayoutGrid;
  kind: "categories" | "link";
  href?: string;
};

const CARDS: ServiceCard[] = [
  {
    id: "categories",
    labelKey: "home.serviceExploreCategories",
    fallbackFr: "Catégories",
    fallbackEn: "Categories",
    icon: LayoutGrid,
    kind: "categories",
  },
  {
    id: "sourcing",
    labelKey: "home.serviceSourcing",
    fallbackFr: "Demander un devis",
    fallbackEn: "Request a quote",
    icon: Sparkles,
    kind: "link",
    href: "/sourcing",
  },
  {
    id: "tracking",
    labelKey: "home.serviceTracking",
    fallbackFr: "Suivi colis",
    fallbackEn: "Track package",
    icon: PackageSearch,
    kind: "link",
    href: "/tracking",
  },
  {
    id: "vendor",
    labelKey: "home.serviceVendors",
    fallbackFr: "Devenir vendeur",
    fallbackEn: "Become a seller",
    icon: Store,
    kind: "link",
    href: "/become-vendor",
  },
];

export function HomeServiceCards() {
  const { t, locale } = useI18n();
  const { user } = useAuth();

  return (
    <section className="pb-3 pt-1 bg-card sm:hidden" aria-label={t("home.serviceExploreCategories") || "Services"}>
      <div className="container">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide snap-x snap-mandatory touch-pan-x">
          {CARDS.map((card) => {
            const Icon = card.icon;
            const label =
              t(card.labelKey) ||
              (locale === "fr" ? card.fallbackFr : card.fallbackEn);
            const className =
              "snap-start shrink-0 flex items-center gap-2 min-h-[44px] px-3 py-2 rounded-xl border border-border bg-muted/40 active:scale-[0.98] transition-transform";

            if (card.kind === "categories") {
              return (
                <button
                  key={card.id}
                  type="button"
                  className={className}
                  onClick={() => window.dispatchEvent(new CustomEvent(TOGGLE_CATEGORIES_EVENT))}
                  aria-label={label}
                >
                  <Icon size={18} className="text-primary shrink-0" aria-hidden />
                  <span className="text-xs font-medium text-foreground whitespace-nowrap">{label}</span>
                </button>
              );
            }

            const href =
              card.id === "sourcing" && !user
                ? "/auth?redirect=%2Fsourcing"
                : card.href || "/";

            return (
              <Link key={card.id} to={href} className={className} aria-label={label}>
                <Icon size={18} className="text-primary shrink-0" aria-hidden />
                <span className="text-xs font-medium text-foreground whitespace-nowrap">{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
