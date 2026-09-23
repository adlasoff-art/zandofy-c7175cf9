import type { ReactNode, MouseEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

const ctaPrimaryClass =
  "inline-flex items-center justify-center gap-2 min-h-[44px] bg-primary text-primary-foreground px-8 py-3 rounded-full font-semibold hover:bg-primary/90 transition-colors text-sm";
const ctaSecondaryClass =
  "inline-flex items-center justify-center gap-2 min-h-[44px] border border-border text-foreground px-8 py-3 rounded-full font-semibold hover:bg-muted transition-colors text-sm";

/** In-page hash CTAs must scroll even when the hash is already set (RR Link no-op). */
function MarketingCtaLink({
  to,
  className,
  children,
}: {
  to: string;
  className: string;
  children: ReactNode;
}) {
  if (to.startsWith("#") && to.length > 1) {
    const id = to.slice(1);
    const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        const next = `${window.location.pathname}${window.location.search}${to}`;
        if (window.location.hash !== to) {
          window.history.pushState(null, "", next);
        }
      }
    };
    return (
      <a href={to} className={className} onClick={onClick}>
        {children}
      </a>
    );
  }
  return (
    <Link to={to} className={className}>
      {children}
    </Link>
  );
}

export function MarketingHero({
  eyebrow,
  title,
  titleHighlight,
  subtitle,
  primaryCta,
  secondaryCta,
  brandFirst = true,
}: {
  eyebrow?: string;
  title: string;
  titleHighlight?: string;
  subtitle: string;
  primaryCta: { label: string; to: string };
  secondaryCta?: { label: string; to: string };
  brandFirst?: boolean;
}) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-primary/15 via-background to-primary/5 py-14 md:py-20">
      <div className="container max-w-3xl mx-auto text-center px-4">
        {brandFirst && (
          <div className="flex justify-center mb-6">
            <BrandLogo size="hero" />
          </div>
        )}
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-3">{eyebrow}</p>
        )}
        <h1 className="text-3xl md:text-5xl font-bold text-foreground leading-tight mb-4">
          {title}
          {titleHighlight ? (
            <>
              {" "}
              <span className="text-primary">{titleHighlight}</span>
            </>
          ) : null}
        </h1>
        <p className="text-base md:text-lg text-muted-foreground mb-8 max-w-xl mx-auto">{subtitle}</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <MarketingCtaLink to={primaryCta.to} className={ctaPrimaryClass}>
            {primaryCta.label} <ArrowRight size={16} />
          </MarketingCtaLink>
          {secondaryCta && (
            <MarketingCtaLink to={secondaryCta.to} className={ctaSecondaryClass}>
              {secondaryCta.label}
            </MarketingCtaLink>
          )}
        </div>
      </div>
    </section>
  );
}

export function MarketingSection({
  title,
  subtitle,
  children,
  tone = "default",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  tone?: "default" | "muted";
}) {
  return (
    <section className={`py-14 md:py-16 ${tone === "muted" ? "bg-card" : "bg-background"}`}>
      <div className="container max-w-5xl mx-auto px-4">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center mb-3">{title}</h2>
        {subtitle && (
          <p className="text-sm text-muted-foreground text-center max-w-2xl mx-auto mb-10">{subtitle}</p>
        )}
        {!subtitle && <div className="mb-10" />}
        {children}
      </div>
    </section>
  );
}

export function MarketingBenefitGrid({
  items,
}: {
  items: { icon: ReactNode; title: string; desc: string }[];
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {items.map((item) => (
        <div
          key={item.title}
          className="flex items-start gap-3 bg-background border border-border rounded-xl p-4"
        >
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-primary">
            {item.icon}
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm mb-1">{item.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function MarketingSteps({
  steps,
}: {
  steps: { title: string; desc: string; icon: ReactNode }[];
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
      {steps.map((step, i) => (
        <div
          key={step.title}
          className="relative bg-background border border-border rounded-2xl p-6 text-center"
        >
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
            {i + 1}
          </div>
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 text-primary">
            {step.icon}
          </div>
          <h3 className="font-bold text-foreground mb-2 text-sm">{step.title}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">{step.desc}</p>
        </div>
      ))}
    </div>
  );
}

export function MarketingFaq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="space-y-3 max-w-3xl mx-auto">
      {items.map((item) => (
        <details
          key={item.q}
          className="group border border-border rounded-xl bg-background px-4 py-3 open:shadow-sm"
        >
          <summary className="cursor-pointer list-none font-medium text-sm text-foreground flex items-center justify-between gap-2">
            {item.q}
            <span className="text-muted-foreground group-open:rotate-45 transition-transform text-lg leading-none">
              +
            </span>
          </summary>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed pr-6">{item.a}</p>
        </details>
      ))}
    </div>
  );
}

export function MarketingChecklist({ items }: { items: string[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl mx-auto">
      {items.map((text) => (
        <div key={text} className="flex items-start gap-2 text-sm text-foreground">
          <CheckCircle2 size={16} className="text-primary shrink-0 mt-0.5" />
          <span>{text}</span>
        </div>
      ))}
    </div>
  );
}

export function MarketingCtaBand({
  title,
  subtitle,
  primaryCta,
  secondaryCta,
}: {
  title: string;
  subtitle: string;
  primaryCta: { label: string; to: string };
  secondaryCta?: { label: string; to: string };
}) {
  return (
    <section className="py-14 md:py-16 bg-gradient-to-br from-primary/10 via-background to-primary/5">
      <div className="container max-w-2xl mx-auto text-center px-4">
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">{title}</h2>
        <p className="text-sm text-muted-foreground mb-8">{subtitle}</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <MarketingCtaLink to={primaryCta.to} className={ctaPrimaryClass}>
            {primaryCta.label} <ArrowRight size={16} />
          </MarketingCtaLink>
          {secondaryCta && (
            <MarketingCtaLink to={secondaryCta.to} className={ctaSecondaryClass}>
              {secondaryCta.label}
            </MarketingCtaLink>
          )}
        </div>
      </div>
    </section>
  );
}
