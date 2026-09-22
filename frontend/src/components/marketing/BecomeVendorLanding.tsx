import { Link } from "react-router-dom";
import {
  Globe,
  Package,
  Percent,
  MessageCircle,
  Truck,
  UserPlus,
  Store,
  FileCheck,
} from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import {
  MarketingBenefitGrid,
  MarketingCtaBand,
  MarketingFaq,
  MarketingHero,
  MarketingSection,
  MarketingSteps,
} from "@/components/marketing/MarketingLandingPrimitives";

/** Marketing landing above the become-vendor wizard (Zandofy model, Fiitsa-like structure). */
export function BecomeVendorLanding({
  primaryCtaTo = "#candidater",
}: {
  primaryCtaTo?: string;
}) {
  const { t } = useI18n();

  const benefits = [
    {
      icon: <Store size={20} />,
      title: t("becomeVendor.landing.benefit.store.title"),
      desc: t("becomeVendor.landing.benefit.store.desc"),
    },
    {
      icon: <Globe size={20} />,
      title: t("becomeVendor.landing.benefit.reach.title"),
      desc: t("becomeVendor.landing.benefit.reach.desc"),
    },
    {
      icon: <Truck size={20} />,
      title: t("becomeVendor.landing.benefit.logistics.title"),
      desc: t("becomeVendor.landing.benefit.logistics.desc"),
    },
    {
      icon: <Percent size={20} />,
      title: t("becomeVendor.landing.benefit.commission.title"),
      desc: t("becomeVendor.landing.benefit.commission.desc"),
    },
    {
      icon: <MessageCircle size={20} />,
      title: t("becomeVendor.landing.benefit.whatsapp.title"),
      desc: t("becomeVendor.landing.benefit.whatsapp.desc"),
    },
    {
      icon: <Package size={20} />,
      title: t("becomeVendor.landing.benefit.catalog.title"),
      desc: t("becomeVendor.landing.benefit.catalog.desc"),
    },
  ];

  const steps = [
    {
      icon: <UserPlus size={22} />,
      title: t("becomeVendor.landing.step1.title"),
      desc: t("becomeVendor.landing.step1.desc"),
    },
    {
      icon: <FileCheck size={22} />,
      title: t("becomeVendor.landing.step2.title"),
      desc: t("becomeVendor.landing.step2.desc"),
    },
    {
      icon: <Store size={22} />,
      title: t("becomeVendor.landing.step3.title"),
      desc: t("becomeVendor.landing.step3.desc"),
    },
  ];

  const faq = [
    { q: t("becomeVendor.landing.faq1.q"), a: t("becomeVendor.landing.faq1.a") },
    { q: t("becomeVendor.landing.faq2.q"), a: t("becomeVendor.landing.faq2.a") },
    { q: t("becomeVendor.landing.faq3.q"), a: t("becomeVendor.landing.faq3.a") },
    { q: t("becomeVendor.landing.faq4.q"), a: t("becomeVendor.landing.faq4.a") },
  ];

  return (
    <div>
      <MarketingHero
        brandFirst
        eyebrow={t("becomeVendor.landing.eyebrow")}
        title={t("becomeVendor.landing.hero.title")}
        titleHighlight={t("becomeVendor.landing.hero.highlight")}
        subtitle={t("becomeVendor.landing.hero.subtitle")}
        primaryCta={{ label: t("becomeVendor.landing.cta.apply"), to: primaryCtaTo }}
        secondaryCta={{ label: t("becomeVendor.landing.cta.pricing"), to: "/pricing" }}
      />

      <MarketingSection
        title={t("becomeVendor.landing.why.title")}
        subtitle={t("becomeVendor.landing.why.subtitle")}
        tone="muted"
      >
        <MarketingBenefitGrid items={benefits} />
      </MarketingSection>

      <MarketingSection
        title={t("becomeVendor.landing.how.title")}
        subtitle={t("becomeVendor.landing.how.subtitle")}
      >
        <MarketingSteps steps={steps} />
        <p className="text-center text-xs text-muted-foreground mt-8">
          <Link to="/pricing" className="text-primary hover:underline">
            {t("becomeVendor.landing.cta.pricing")}
          </Link>
        </p>
      </MarketingSection>

      <MarketingSection title={t("becomeVendor.landing.faq.title")} tone="muted">
        <MarketingFaq items={faq} />
      </MarketingSection>

      <MarketingCtaBand
        title={t("becomeVendor.landing.final.title")}
        subtitle={t("becomeVendor.landing.final.subtitle")}
        primaryCta={{ label: t("becomeVendor.landing.cta.apply"), to: primaryCtaTo }}
        secondaryCta={{ label: t("becomeVendor.landing.cta.discover"), to: "/discover" }}
      />
    </div>
  );
}
