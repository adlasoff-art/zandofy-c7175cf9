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
import { useResolvedMarketingLanding } from "@/hooks/use-cms-marketing-landing";
import { becomeVendorFallbackFromT } from "@/lib/cms-marketing-landings";
import {
  MarketingBenefitGrid,
  MarketingCtaBand,
  MarketingFaq,
  MarketingHero,
  MarketingSection,
  MarketingSteps,
} from "@/components/marketing/MarketingLandingPrimitives";

const BENEFIT_ICONS = [
  <Store size={20} key="b0" />,
  <Globe size={20} key="b1" />,
  <Truck size={20} key="b2" />,
  <Percent size={20} key="b3" />,
  <MessageCircle size={20} key="b4" />,
  <Package size={20} key="b5" />,
];

const STEP_ICONS = [
  <UserPlus size={22} key="s0" />,
  <FileCheck size={22} key="s1" />,
  <Store size={22} key="s2" />,
];

/** Marketing landing above the become-vendor wizard (Zandofy model, Fiitsa-like structure). */
export function BecomeVendorLanding({
  primaryCtaTo = "#candidater",
}: {
  primaryCtaTo?: string;
}) {
  const { content } = useResolvedMarketingLanding(
    "cms_become_vendor_landing",
    becomeVendorFallbackFromT
  );

  const benefits = content.benefits.map((item, i) => ({
    icon: BENEFIT_ICONS[i % BENEFIT_ICONS.length],
    title: item.title,
    desc: item.desc,
  }));

  const steps = content.steps.map((item, i) => ({
    icon: STEP_ICONS[i % STEP_ICONS.length],
    title: item.title,
    desc: item.desc,
  }));

  return (
    <div>
      <MarketingHero
        brandFirst
        eyebrow={content.hero.eyebrow}
        title={content.hero.title}
        titleHighlight={content.hero.highlight}
        subtitle={content.hero.subtitle}
        primaryCta={{ label: content.hero.ctaPrimary, to: primaryCtaTo }}
        secondaryCta={{ label: content.hero.ctaSecondary, to: "/pricing" }}
      />

      {content.sections.why && (
        <MarketingSection
          title={content.why.title}
          subtitle={content.why.subtitle}
          tone="muted"
        >
          <MarketingBenefitGrid items={benefits} />
        </MarketingSection>
      )}

      {content.sections.how && (
        <MarketingSection title={content.how.title} subtitle={content.how.subtitle}>
          <MarketingSteps steps={steps} />
          <p className="text-center text-xs text-muted-foreground mt-8">
            <Link to="/pricing" className="text-primary hover:underline">
              {content.hero.ctaSecondary}
            </Link>
          </p>
        </MarketingSection>
      )}

      {content.sections.faq && (
        <MarketingSection title={content.faq.title} tone="muted">
          <MarketingFaq items={content.faq.items} />
        </MarketingSection>
      )}

      {content.sections.final && (
        <MarketingCtaBand
          title={content.final.title}
          subtitle={content.final.subtitle}
          primaryCta={{ label: content.final.ctaPrimary, to: primaryCtaTo }}
          secondaryCta={{ label: content.final.ctaSecondary, to: "/discover" }}
        />
      )}
    </div>
  );
}
