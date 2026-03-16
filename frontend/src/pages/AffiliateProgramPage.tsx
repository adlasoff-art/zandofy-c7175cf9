import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/contexts/I18nContext";
import { Users, Gift, TrendingUp, Star, ArrowRight, CheckCircle2, Coins, Share2, UserPlus, ShoppingBag } from "lucide-react";

interface AffiliateTier {
  id: string;
  tier_name: string;
  min_referrals: number;
  commission_pct: number;
  bonus_points: number;
  badge_label: string;
}

interface ReferralSettings {
  enabled: boolean;
  commission_pct: number;
  max_rewarded_orders: number;
  referee_coupon_pct: number;
  points_expiry_months: number;
}

export default function AffiliateProgramPage() {
  const { t, formatPrice } = useI18n();
  const [tiers, setTiers] = useState<AffiliateTier[]>([]);
  const [settings, setSettings] = useState<ReferralSettings | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from("affiliate_tiers").select("*").order("min_referrals"),
      supabase.from("platform_settings").select("value").eq("key", "referral_settings").maybeSingle(),
    ]).then(([tiersRes, settingsRes]) => {
      setTiers((tiersRes.data || []) as AffiliateTier[]);
      if (settingsRes.data) setSettings(settingsRes.data.value as unknown as ReferralSettings);
    });
  }, []);

  const steps = [
    { icon: UserPlus, title: "Inscrivez-vous", desc: "Créez votre compte Zandofy et obtenez votre lien de parrainage unique." },
    { icon: Share2, title: "Partagez", desc: "Envoyez votre lien à vos amis, famille et réseau via vos canaux préférés." },
    { icon: ShoppingBag, title: "Ils achètent", desc: "Vos filleuls profitent d'une réduction exclusive sur leurs premiers achats." },
    { icon: Coins, title: "Vous gagnez", desc: "Recevez des ZandoPoints à chaque commande de vos filleuls. Convertibles en réductions ou cartes cadeaux !" },
  ];

  const benefits = [
    "Commission sur chaque commande de vos filleuls",
    "Vos filleuls reçoivent un coupon de bienvenue",
    "ZandoPoints convertibles en cartes cadeaux",
    "Suivi en temps réel dans votre espace client",
    "Programme gratuit, sans engagement",
    "Paliers de progression avec bonus exclusifs",
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-primary/10 via-background to-primary/5 py-16 md:py-24">
        <div className="container text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-4 py-2 rounded-full mb-6">
            <Gift size={14} />
            Programme d'affiliation Zandofy
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-4 leading-tight">
            Parrainez, partagez, <span className="text-primary">gagnez</span>
          </h1>
          <p className="text-base md:text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
            Recommandez Zandofy à vos proches et gagnez des récompenses à chaque commande qu'ils passent.
            {settings && ` Jusqu'à ${settings.commission_pct}% de commission sur ${settings.max_rewarded_orders} commandes !`}
          </p>
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3.5 rounded-full font-semibold hover:bg-primary/90 transition-colors text-sm"
          >
            Commencer maintenant <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 bg-card">
        <div className="container max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center mb-12">
            Comment ça marche ?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <div key={i} className="relative bg-background border border-border rounded-2xl p-6 text-center hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <step.icon size={22} className="text-primary" />
                </div>
                <div className="absolute -top-3 -left-2 w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </div>
                <h3 className="font-bold text-foreground mb-2">{step.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Key stats */}
      {settings && (
        <section className="py-12 bg-background">
          <div className="container max-w-4xl mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="bg-card border border-border rounded-2xl p-6 text-center">
                <TrendingUp size={28} className="text-primary mx-auto mb-3" />
                <p className="text-3xl font-bold text-foreground">{settings.commission_pct}%</p>
                <p className="text-xs text-muted-foreground mt-1">Commission par commande</p>
              </div>
              <div className="bg-card border border-border rounded-2xl p-6 text-center">
                <ShoppingBag size={28} className="text-primary mx-auto mb-3" />
                <p className="text-3xl font-bold text-foreground">{settings.max_rewarded_orders}</p>
                <p className="text-xs text-muted-foreground mt-1">Commandes récompensées par filleul</p>
              </div>
              <div className="bg-card border border-border rounded-2xl p-6 text-center">
                <Gift size={28} className="text-primary mx-auto mb-3" />
                <p className="text-3xl font-bold text-foreground">{settings.referee_coupon_pct || 10}%</p>
                <p className="text-xs text-muted-foreground mt-1">Réduction pour vos filleuls</p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Benefits */}
      <section className="py-16 bg-card">
        <div className="container max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center mb-10">
            Les avantages du programme
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {benefits.map((b, i) => (
              <div key={i} className="flex items-start gap-3 bg-background border border-border rounded-xl p-4">
                <CheckCircle2 size={18} className="text-primary shrink-0 mt-0.5" />
                <p className="text-sm text-foreground">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Affiliate tiers */}
      {tiers.length > 0 && (
        <section className="py-16 bg-background">
          <div className="container max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center mb-4">
              Paliers d'affiliation
            </h2>
            <p className="text-sm text-muted-foreground text-center mb-10 max-w-lg mx-auto">
              Plus vous parrainez, plus vos avantages augmentent. Progressez à travers les paliers !
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {tiers.map((tier, i) => (
                <div
                  key={tier.id}
                  className={`relative border rounded-2xl p-6 transition-all hover:shadow-lg ${
                    i === tiers.length - 1
                      ? "border-primary bg-primary/5 shadow-md"
                      : "border-border bg-card"
                  }`}
                >
                  {i === tiers.length - 1 && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] font-bold px-3 py-1 rounded-full">
                      <Star size={10} className="inline mr-1" />TOP
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-3">
                    <Users size={16} className="text-primary" />
                    <h3 className="font-bold text-foreground">{tier.badge_label || tier.tier_name}</h3>
                  </div>
                  <div className="space-y-2 text-xs text-muted-foreground">
                    <p>À partir de <span className="font-semibold text-foreground">{tier.min_referrals}</span> filleuls</p>
                    <p>Commission : <span className="font-semibold text-primary">{tier.commission_pct}%</span></p>
                    {tier.bonus_points > 0 && (
                      <p>Bonus : <span className="font-semibold text-foreground">+{tier.bonus_points} ZandoPoints</span></p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-16 bg-gradient-to-br from-primary/10 via-background to-primary/5">
        <div className="container text-center max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
            Prêt à gagner avec Zandofy ?
          </h2>
          <p className="text-sm text-muted-foreground mb-8">
            Rejoignez le programme d'affiliation dès maintenant. C'est gratuit, simple et sans engagement.
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
              Mon espace parrainage
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
