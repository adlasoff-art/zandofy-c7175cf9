import { Link } from "react-router-dom";
import {
  Globe,
  Package,
  ShieldCheck,
  Truck,
  CreditCard,
  Search,
  ShoppingCart,
  MapPin,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { useI18n } from "@/contexts/I18nContext";
import {
  MarketingBenefitGrid,
  MarketingCtaBand,
  MarketingFaq,
  MarketingHero,
  MarketingSection,
  MarketingSteps,
} from "@/components/marketing/MarketingLandingPrimitives";

export default function DiscoverPage() {
  const { t } = useI18n();

  const benefits = [
    {
      icon: <Package size={20} />,
      title: t("discover.benefit.factory.title"),
      desc: t("discover.benefit.factory.desc"),
    },
    {
      icon: <Truck size={20} />,
      title: t("discover.benefit.logistics.title"),
      desc: t("discover.benefit.logistics.desc"),
    },
    {
      icon: <CreditCard size={20} />,
      title: t("discover.benefit.pay.title"),
      desc: t("discover.benefit.pay.desc"),
    },
    {
      icon: <ShieldCheck size={20} />,
      title: t("discover.benefit.trust.title"),
      desc: t("discover.benefit.trust.desc"),
    },
  ];

  const steps = [
    {
      icon: <Search size={22} />,
      title: t("discover.step1.title"),
      desc: t("discover.step1.desc"),
    },
    {
      icon: <ShoppingCart size={22} />,
      title: t("discover.step2.title"),
      desc: t("discover.step2.desc"),
    },
    {
      icon: <MapPin size={22} />,
      title: t("discover.step3.title"),
      desc: t("discover.step3.desc"),
    },
  ];

  const trustItems = [
    {
      icon: <ShieldCheck size={20} />,
      title: t("discover.trust.kyc.title"),
      desc: t("discover.trust.kyc.desc"),
    },
    {
      icon: <Truck size={20} />,
      title: t("discover.trust.track.title"),
      desc: t("discover.trust.track.desc"),
    },
    {
      icon: <Globe size={20} />,
      title: t("discover.trust.hub.title"),
      desc: t("discover.trust.hub.desc"),
    },
    {
      icon: <Package size={20} />,
      title: t("discover.trust.vendors.title"),
      desc: t("discover.trust.vendors.desc"),
    },
  ];

  const faq = [
    { q: t("discover.faq1.q"), a: t("discover.faq1.a") },
    { q: t("discover.faq2.q"), a: t("discover.faq2.a") },
    { q: t("discover.faq3.q"), a: t("discover.faq3.a") },
    { q: t("discover.faq4.q"), a: t("discover.faq4.a") },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead
        title={t("discover.seo.title")}
        description={t("discover.seo.desc")}
      />
      <Header />
      <main className="flex-1">
        <MarketingHero
          eyebrow={t("discover.eyebrow")}
          title={t("discover.hero.title")}
          titleHighlight={t("discover.hero.highlight")}
          subtitle={t("discover.hero.subtitle")}
          primaryCta={{ label: t("discover.cta.explore"), to: "/search" }}
          secondaryCta={{ label: t("discover.cta.becomeVendor"), to: "/become-vendor" }}
        />

        <MarketingSection
          title={t("discover.why.title")}
          subtitle={t("discover.why.subtitle")}
          tone="muted"
        >
          <MarketingBenefitGrid items={benefits} />
        </MarketingSection>

        <MarketingSection title={t("discover.how.title")} subtitle={t("discover.how.subtitle")}>
          <MarketingSteps steps={steps} />
        </MarketingSection>

        <MarketingSection
          title={t("discover.trust.title")}
          subtitle={t("discover.trust.subtitle")}
          tone="muted"
        >
          <MarketingBenefitGrid items={trustItems} />
        </MarketingSection>

        <MarketingSection title={t("discover.faq.title")}>
          <MarketingFaq items={faq} />
          <p className="text-center text-xs text-muted-foreground mt-8">
            <Link to="/faq" className="text-primary hover:underline">
              {t("discover.faq.more")}
            </Link>
          </p>
        </MarketingSection>

        <MarketingCtaBand
          title={t("discover.final.title")}
          subtitle={t("discover.final.subtitle")}
          primaryCta={{ label: t("discover.cta.explore"), to: "/search" }}
          secondaryCta={{ label: t("discover.cta.becomeVendor"), to: "/become-vendor" }}
        />
      </main>
      <Footer />
    </div>
  );
}
