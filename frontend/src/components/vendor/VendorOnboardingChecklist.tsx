import { Link } from "react-router-dom";
import { CheckCircle2, Circle, CreditCard, MessageCircle, Package, Sparkles } from "lucide-react";

type Props = {
  storeId: string;
  productCount?: number;
  hasWhatsappNumber?: boolean;
  whatsappEnabled?: boolean;
};

/**
 * First-run checklist for newly approved vendors (base free store).
 * Soft guidance only — does not block catalogue.
 */
export function VendorOnboardingChecklist({
  storeId,
  productCount = 0,
  hasWhatsappNumber = false,
  whatsappEnabled = false,
}: Props) {
  const steps = [
    {
      done: productCount >= 1,
      label: "Publier au moins 1 produit",
      href: `/vendor?tab=catalogue&store=${storeId}`,
      icon: Package,
    },
    {
      done: true,
      label: "Modes de paiement de base (plateforme)",
      href: `/vendor?tab=payments&store=${storeId}`,
      icon: CreditCard,
    },
    {
      done: hasWhatsappNumber && whatsappEnabled,
      label: hasWhatsappNumber && !whatsappEnabled
        ? "WhatsApp : numéro enregistré — activation admin requise"
        : "Renseigner WhatsApp boutique (optionnel)",
      href: `/vendor?tab=settings&store=${storeId}`,
      icon: MessageCircle,
    },
    {
      done: false,
      label: "Activer des fonctionnalités extras (Pricing)",
      href: `/vendor?tab=pricing&store=${storeId}`,
      icon: Sparkles,
    },
  ];

  const remaining = steps.filter((s) => !s.done).length;
  if (remaining === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3 mb-4">
      <div>
        <h3 className="text-sm font-bold text-foreground">Bienvenue — démarrage boutique</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Socle gratuit actif. Complétez ces étapes, puis activez les extras depuis Pricing si besoin.
        </p>
      </div>
      <ul className="space-y-2">
        {steps.map((s) => (
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
  );
}
