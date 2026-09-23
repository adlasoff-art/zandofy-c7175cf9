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
import { useResolvedMarketingLanding } from "@/hooks/use-cms-marketing-landing";
import { discoverFallbackFromT } from "@/lib/cms-marketing-landings";
import {
  MarketingBenefitGrid,
  MarketingCtaBand,
  MarketingFaq,
  MarketingHero,
  MarketingSection,
  MarketingSteps,
} from "@/components/marketing/MarketingLandingPrimitives";

const BENEFIT_ICONS = [
  <Package size={20} key="b0" />,
  <Truck size={20} key="b1" />,
  <CreditCard size={20} key="b2" />,
  <ShieldCheck size={20} key="b3" />,
];

const STEP_ICONS = [
  <Search size={22} key="s0" />,
  <ShoppingCart size={22} key="s1" />,
  <MapPin size={22} key="s2" />,
];

const TRUST_ICONS = [
  <ShieldCheck size={20} key="t0" />,
  <Truck size={20} key="t1" />,
  <Globe size={20} key="t2" />,
  <Package size={20} key="t3" />,
];

export default function DiscoverPage() {
  const { content } = useResolvedMarketingLanding("cms_discover", discoverFallbackFromT);

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

  const trustItems = content.trust.items.map((item, i) => ({
    icon: TRUST_ICONS[i % TRUST_ICONS.length],
    title: item.title,
    desc: item.desc,
  }));

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SEOHead title={content.seo.title} description={content.seo.description} />
      <Header />
      <main className="flex-1">
        <MarketingHero
          eyebrow={content.hero.eyebrow}
          title={content.hero.title}
          titleHighlight={content.hero.highlight}
          subtitle={content.hero.subtitle}
          primaryCta={{ label: content.hero.ctaPrimary, to: "/search" }}
          secondaryCta={{ label: content.hero.ctaSecondary, to: "/become-vendor" }}
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
          </MarketingSection>
        )}

        {content.sections.trust && (
          <MarketingSection
            title={content.trust.title}
            subtitle={content.trust.subtitle}
            tone="muted"
          >
            <MarketingBenefitGrid items={trustItems} />
          </MarketingSection>
        )}

        {content.sections.faq && (
          <MarketingSection title={content.faq.title}>
            <MarketingFaq items={content.faq.items} />
            {content.faq.moreLabel ? (
              <p className="text-center text-xs text-muted-foreground mt-8">
                <Link to="/faq" className="text-primary hover:underline">
                  {content.faq.moreLabel}
                </Link>
              </p>
            ) : null}
          </MarketingSection>
        )}

        {content.sections.final && (
          <MarketingCtaBand
            title={content.final.title}
            subtitle={content.final.subtitle}
            primaryCta={{ label: content.final.ctaPrimary, to: "/search" }}
            secondaryCta={{ label: content.final.ctaSecondary, to: "/become-vendor" }}
          />
        )}
      </main>
      <Footer />
    </div>
  );
}
