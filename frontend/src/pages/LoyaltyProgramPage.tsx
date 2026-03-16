import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/contexts/I18nContext";
import { Crown, ArrowRight, CheckCircle2, Star, Award, ShoppingBag, TrendingUp, Gift, Percent, MapPin } from "lucide-react";

interface CustomerTier {
  id: string;
  tier_name: string;
  badge_label: string;
  min_orders: number;
  min_spent: number;
  discount_pct: number;
  sort_order: number;
}

export default function LoyaltyProgramPage() {
  const { formatPrice } = useI18n();
  const [tiers, setTiers] = useState<CustomerTier[]>([]);

  useEffect(() => {
    supabase
      .from("customer_tiers")
      .select("*")
      .order("sort_order")
      .then(({ data }) => {
        setTiers(
          (data || []).map((t: any) => ({
            ...t,
            min_spent: Number(t.min_spent),
            discount_pct: Number(t.discount_pct),
          }))
        );
      });
  }, []);

  const highlights = [
    { icon: Percent, title: "Réductions permanentes", desc: "Bénéficiez de remises croissantes sur toutes vos commandes selon votre niveau." },
    { icon: Crown, title: "Badges exclusifs", desc: "Montez en grade et débloquez des badges qui reflètent votre statut de client fidèle." },
    { icon: MapPin, title: "Adresses supplémentaires", desc: "Les niveaux supérieurs débloquent des emplacements d'adresse supplémentaires." },
    { icon: Gift, title: "Avantages VIP", desc: "Accès prioritaire, offres exclusives et surprises réservées aux membres les plus fidèles." },
  ];

  const howItWorks = [
    { icon: ShoppingBag, title: "Achetez", desc: "Passez des commandes sur Zandofy comme d'habitude." },
    { icon: TrendingUp, title: "Progressez", desc: "Chaque commande confirmée vous rapproche du prochain niveau." },
    { icon: Award, title: "Demandez votre badge", desc: "Dès que vous atteignez les seuils, demandez votre nouveau badge." },
    { icon: Star, title: "Profitez", desc: "Vos réductions s'appliquent automatiquement sur toutes vos commandes." },
  ];

  const tierColors = [
    "border-border bg-card",
    "border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30",
    "border-violet-200 bg-violet-50/50 dark:border-violet-800 dark:bg-violet-950/30",
    "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30",
    "border-rose-200 bg-rose-50/50 dark:border-rose-800 dark:bg-rose-950/30",
    "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30",
    "border-primary bg-primary/5",
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-primary/10 via-background to-primary/5 py-16 md:py-24">
        <div className="container text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-4 py-2 rounded-full mb-6">
            <Crown size={14} />
            Programme de Fidélité Zandofy
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-4 leading-tight">
            Votre fidélité, nos <span className="text-primary">récompenses</span>
          </h1>
          <p className="text-base md:text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
            Chaque commande vous rapproche d'avantages exclusifs. Montez en grade et profitez de réductions permanentes allant jusqu'à{" "}
            {tiers.length > 0 ? `${Math.max(...tiers.map((t) => t.discount_pct))}%` : "15%"} !
          </p>
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3.5 rounded-full font-semibold hover:bg-primary/90 transition-colors text-sm"
          >
            Rejoindre le programme <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* Highlights */}
      <section className="py-16 bg-card">
        <div className="container max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center mb-12">
            Pourquoi rejoindre le programme ?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {highlights.map((h, i) => (
              <div key={i} className="bg-background border border-border rounded-2xl p-6 text-center hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <h.icon size={22} className="text-primary" />
                </div>
                <h3 className="font-bold text-foreground mb-2 text-sm">{h.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{h.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 bg-background">
        <div className="container max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center mb-12">
            Comment ça marche ?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {howItWorks.map((step, i) => (
              <div key={i} className="relative bg-card border border-border rounded-2xl p-6 text-center">
                <div className="absolute -top-3 -left-2 w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </div>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <step.icon size={22} className="text-primary" />
                </div>
                <h3 className="font-bold text-foreground mb-2 text-sm">{step.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tiers */}
      {tiers.length > 0 && (
        <section className="py-16 bg-card">
          <div className="container max-w-5xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center mb-4">
              Les niveaux de fidélité
            </h2>
            <p className="text-sm text-muted-foreground text-center mb-10 max-w-lg mx-auto">
              7 niveaux de progression pour récompenser votre engagement.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {tiers.map((tier, i) => (
                <div
                  key={tier.id}
                  className={`relative border rounded-2xl p-5 transition-all hover:shadow-lg ${tierColors[i] || tierColors[0]}`}
                >
                  {i === tiers.length - 1 && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1">
                      <Star size={10} /> ULTIME
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-3">
                    <Award size={18} className="text-primary" />
                    <h3 className="font-bold text-foreground text-sm">{tier.badge_label}</h3>
                  </div>
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 size={12} className="text-primary shrink-0" />
                      <span>≥ <strong className="text-foreground">{tier.min_orders}</strong> commandes</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 size={12} className="text-primary shrink-0" />
                      <span>≥ <strong className="text-foreground">{formatPrice(tier.min_spent)}</strong> dépensés</span>
                    </div>
                    {tier.discount_pct > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Percent size={12} className="text-primary shrink-0" />
                        <span className="font-semibold text-primary">-{tier.discount_pct}% permanent</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="py-16 bg-background">
        <div className="container max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-foreground text-center mb-10">Questions fréquentes</h2>
          <div className="space-y-4">
            {[
              { q: "Le programme est-il gratuit ?", a: "Oui, le programme de fidélité est entièrement gratuit. Il suffit de créer un compte Zandofy." },
              { q: "Comment demander mon badge ?", a: "Rendez-vous dans votre espace client, section 'Programme de fidélité'. Dès que vous atteignez les seuils requis, un bouton vous permet de soumettre votre demande." },
              { q: "La réduction est-elle automatique ?", a: "Oui, une fois votre badge validé par notre équipe, la réduction s'applique automatiquement sur toutes vos commandes." },
              { q: "Puis-je perdre mon niveau ?", a: "Non, votre niveau de fidélité est acquis et ne diminue jamais. Vous ne pouvez que progresser !" },
            ].map((faq, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-semibold text-foreground text-sm mb-2">{faq.q}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-br from-primary/10 via-background to-primary/5">
        <div className="container text-center max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
            Commencez à cumuler vos avantages
          </h2>
          <p className="text-sm text-muted-foreground mb-8">
            Inscrivez-vous ou connectez-vous pour suivre votre progression et profiter de vos récompenses.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3.5 rounded-full font-semibold hover:bg-primary/90 transition-colors text-sm"
            >
              Créer mon compte <ArrowRight size={16} />
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 border border-border text-foreground px-8 py-3.5 rounded-full font-semibold hover:bg-muted transition-colors text-sm"
            >
              Mon espace fidélité
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
