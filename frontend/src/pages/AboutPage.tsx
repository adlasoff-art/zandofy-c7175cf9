import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { Shield, Globe, Heart, Users, Truck, Award } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";

export default function AboutPage() {
  const { t } = useI18n();

  const values = [
    { icon: Globe, titleKey: "about.globalReach", descKey: "about.globalReachDesc" },
    { icon: Shield, titleKey: "about.trustSafety", descKey: "about.trustSafetyDesc" },
    { icon: Heart, titleKey: "about.socialCommitment", descKey: "about.socialCommitmentDesc" },
    { icon: Users, titleKey: "about.community", descKey: "about.communityDesc" },
    { icon: Truck, titleKey: "about.optimizedLogistics", descKey: "about.optimizedLogisticsDesc" },
    { icon: Award, titleKey: "about.guaranteedQuality", descKey: "about.guaranteedQualityDesc" },
  ];

  const stats = [
    { num: "10K+", labelKey: "about.products" },
    { num: "500+", labelKey: "about.verifiedSellers" },
    { num: "50K+", labelKey: "about.satisfiedCustomers" },
    { num: "30+", labelKey: "about.countriesServed" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={`${t("about.title")} — Marketplace`}
        description={t("about.subtitle")}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Zandofy",
          description: t("about.subtitle"),
          url: window.location.origin,
        }}
      />
      <Header />
      <main>
        <section className="bg-brand-gradient text-primary-foreground py-16 md:py-24">
          <div className="container text-center">
            <h1 className="text-3xl md:text-5xl font-bold mb-4">{t("about.title")}</h1>
            <p className="text-lg md:text-xl opacity-90 max-w-2xl mx-auto">{t("about.subtitle")}</p>
          </div>
        </section>

        <section className="container py-12 md:py-16">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-foreground mb-4">{t("about.storyTitle")}</h2>
            <p className="text-muted-foreground leading-relaxed">{t("about.storyContent")}</p>
          </div>
        </section>

        <section className="bg-muted py-12 md:py-16">
          <div className="container">
            <h2 className="text-2xl font-bold text-foreground text-center mb-10">{t("about.valuesTitle")}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {values.map(v => (
                <article key={v.titleKey} className="bg-card border border-border rounded-lg p-6 hover:shadow-card-hover transition-shadow">
                  <v.icon size={28} className="text-primary mb-3" />
                  <h3 className="text-base font-bold text-foreground mb-2">{t(v.titleKey)}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{t(v.descKey)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="container py-12 md:py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {stats.map(s => (
              <div key={s.labelKey}>
                <p className="text-3xl md:text-4xl font-bold text-primary">{s.num}</p>
                <p className="text-sm text-muted-foreground mt-1">{t(s.labelKey)}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
