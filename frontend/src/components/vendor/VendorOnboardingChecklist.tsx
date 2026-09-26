import { Link } from "react-router-dom";
import { CheckCircle2, Circle, CreditCard, Image, MapPin, MessageCircle, Package, Sparkles } from "lucide-react";

type Props = {
  storeId: string;
  productCount?: number;
  hasLogo?: boolean;
  hasBanner?: boolean;
  hasCountry?: boolean;
  hasWhatsappNumber?: boolean;
  whatsappEnabled?: boolean;
};

/**
 * First-run checklist for newly approved vendors — two columns:
 * Inclus / à faire (socle) vs Extras (Pricing).
 */
export function VendorOnboardingChecklist({
  storeId,
  productCount = 0,
  hasLogo = false,
  hasBanner = false,
  hasCountry = false,
  hasWhatsappNumber = false,
  whatsappEnabled = false,
}: Props) {
  const included = [
    {
      done: hasLogo,
      label: "Logo boutique",
      href: `/vendor?tab=settings&store=${storeId}`,
      icon: Image,
    },
    {
      done: hasBanner,
      label: "Bannière boutique",
      href: `/vendor?tab=settings&store=${storeId}`,
      icon: Image,
    },
    {
      done: hasCountry,
      label: "Pays de la boutique",
      href: `/vendor?tab=settings&store=${storeId}`,
      icon: MapPin,
    },
    {
      done: hasWhatsappNumber,
      label: "WhatsApp business (numéro)",
      href: `/vendor?tab=settings&store=${storeId}`,
      icon: MessageCircle,
    },
    {
      done: productCount >= 1,
      label: "Publier au moins 1 produit",
      href: `/vendor?tab=catalogue&store=${storeId}`,
      icon: Package,
    },
    {
      done: true,
      label: "Paiements plateforme (MoMo / carte)",
      href: `/vendor?tab=payments&store=${storeId}`,
      icon: CreditCard,
    },
  ];

  const extras = [
    {
      done: hasWhatsappNumber && whatsappEnabled,
      label: whatsappEnabled
        ? "WhatsApp activé (admin)"
        : "Activation WhatsApp (Pricing / admin)",
      href: `/vendor?tab=pricing&store=${storeId}`,
      icon: MessageCircle,
    },
    {
      done: false,
      label: "Extras payants (Pricing)",
      href: `/vendor?tab=pricing&store=${storeId}`,
      icon: Sparkles,
    },
  ];

  const remainingIncluded = included.filter((s) => !s.done).length;
  if (remainingIncluded === 0 && extras.every((s) => s.done)) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 mb-4">
      <div>
        <h3 className="text-sm font-bold text-foreground">Bienvenue — démarrage boutique</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Socle gratuit : identité boutique + catalogue. Commission selon{" "}
          <Link to="/pricing" className="text-primary underline underline-offset-2">
            Pricing / CGV
          </Link>
          .
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Inclus / à faire
          </p>
          <ul className="space-y-2">
            {included.map((s) => (
              <li key={s.label}>
                <Link
                  to={s.href}
                  className="flex items-start gap-2 text-sm hover:text-primary transition-colors"
                >
                  {s.done ? (
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <Circle size={16} className="text-muted-foreground shrink-0 mt-0.5" />
                  )}
                  <span className={s.done ? "text-muted-foreground line-through" : "text-foreground"}>
                    <s.icon size={12} className="inline mr-1 opacity-70" />
                    {s.label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Extras (Pricing)
          </p>
          <ul className="space-y-2">
            {extras.map((s) => (
              <li key={s.label}>
                <Link
                  to={s.href}
                  className="flex items-start gap-2 text-sm hover:text-primary transition-colors"
                >
                  {s.done ? (
                    <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <Circle size={16} className="text-muted-foreground shrink-0 mt-0.5" />
                  )}
                  <span className={s.done ? "text-muted-foreground line-through" : "text-foreground"}>
                    <s.icon size={12} className="inline mr-1 opacity-70" />
                    {s.label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
