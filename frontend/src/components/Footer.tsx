import { Link } from "react-router-dom";
import { Mail, MapPin, Phone, CreditCard, Shield, Truck, RotateCcw, Facebook, Instagram, Twitter, Youtube, Linkedin } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const paymentMethods = ["Visa", "Mastercard", "Orange Money", "Airtel Money", "M-PESA", "Apple Pay"];

export function Footer() {
  const { t, formatPrice } = useI18n();
  const [freeShippingAmount, setFreeShippingAmount] = useState(999);

  const [footerConfig, setFooterConfig] = useState({
    description: "",
    social_links: { facebook: "#", instagram: "#", twitter: "#", youtube: "#", linkedin: "#" },
    newsletter_email: "",
  });

  useEffect(() => {
    supabase.from("platform_settings").select("key, value").in("key", ["footer_config", "free_shipping_threshold"]).then(({ data }) => {
      data?.forEach(row => {
        const v = row.value as any;
        if (row.key === "footer_config") {
          setFooterConfig(prev => ({
            description: v.description || prev.description,
            social_links: { ...prev.social_links, ...v.social_links },
            newsletter_email: v.newsletter_email || prev.newsletter_email,
          }));
        } else if (row.key === "free_shipping_threshold" && v.enabled) {
          setFreeShippingAmount(Number(v.amount) || 999);
        }
      });
    });
  }, []);

  const footerSections = [
    {
      title: t("footer.customerService"),
      links: [
        { label: t("footer.helpCenter"), to: "/faq" },
        { label: t("footer.orderTracking"), to: "/tracking" },
        { label: t("footer.shippingDelivery"), to: "/faq" },
        { label: t("footer.returnsRefunds"), to: "/faq" },
        { label: t("footer.contactUs"), to: "/about" },
      ],
    },
    {
      title: t("footer.aboutZandofy"),
      links: [
        { label: t("footer.aboutUs"), to: "/about" },
        { label: t("footer.socialResponsibility"), to: "/about" },
        { label: t("footer.careers"), to: "/about" },
        { label: t("footer.blog"), to: "#" },
        { label: t("footer.affiliates"), to: "#" },
      ],
    },
    {
      title: t("footer.helpSupport"),
      links: [
        { label: t("footer.sizeGuide"), to: "/faq" },
        { label: t("footer.faq"), to: "/faq" },
        { label: t("footer.giftCard"), to: "#" },
        { label: t("footer.loyaltyProgram"), to: "#" },
        { label: t("footer.sellOnZandofy"), to: "/become-vendor" },
      ],
    },
  ];

  const guarantees = [
    { icon: Truck, label: `${t("footer.freeShippingFrom")} ${formatPrice(freeShippingAmount)}` },
    { icon: RotateCcw, label: t("footer.freeReturns30") },
    { icon: Shield, label: t("footer.securePayment") },
    { icon: CreditCard, label: t("footer.noHiddenFees") },
  ];

  const legalLinks = [
    { label: t("footer.privacyPolicy"), to: "/privacy" },
    { label: t("footer.cookiePolicy"), to: "/privacy" },
    { label: t("footer.manageCookies"), to: "#" },
    { label: t("footer.terms"), to: "/terms" },
  ];

  return (
    <footer className="bg-muted border-t border-border">
      {/* Guarantees strip */}
      <div className="border-b border-border bg-card">
        <div className="container py-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {guarantees.map((g) => (
              <div key={g.label} className="flex items-start gap-2">
                <g.icon size={18} className="text-primary shrink-0 mt-0.5" />
                <span className="text-xs font-medium text-foreground leading-tight">{g.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Newsletter */}
      <div className="bg-card border-b border-border">
        <div className="container py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">{t("footer.newsletter")}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{t("footer.newsletterSub")}</p>
            </div>
            <div className="flex w-full md:w-auto max-w-md gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                <input
                  type="email"
                  placeholder={t("footer.emailPlaceholder")}
                  className="w-full pl-9 pr-4 py-2.5 text-xs bg-muted border border-border outline-none focus:border-primary"
                />
              </div>
              <button className="px-6 py-2.5 text-xs font-bold bg-foreground text-card hover:bg-foreground/90 transition-colors whitespace-nowrap">
                {t("footer.subscribe")}
              </button>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto max-w-md justify-center md:justify-start mt-3 md:mt-2">
              <span className="text-xs text-muted-foreground font-medium">{t("footer.followUs")}</span>
              {[
                { icon: Facebook, label: "Facebook", key: "facebook" },
                { icon: Instagram, label: "Instagram", key: "instagram" },
                { icon: Twitter, label: "X (Twitter)", key: "twitter" },
                { icon: Youtube, label: "YouTube", key: "youtube" },
                { icon: Linkedin, label: "LinkedIn", key: "linkedin" },
              ].map((s) => (
                <a
                  key={s.label}
                  href={footerConfig.social_links[s.key as keyof typeof footerConfig.social_links] || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-colors"
                  aria-label={s.label}
                >
                  <s.icon size={15} />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main footer links */}
      <div className="container py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h4 className="text-base tracking-[0.08em] text-foreground mb-3" style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 400 }}>Zandofy</h4>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">{footerConfig.description || t("footer.description")}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin size={12} />
              <span>{t("footer.worldwide")}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1.5">
              <Phone size={12} />
              <span>+1 (800) ZANDOFY</span>
            </div>
          </div>

          {footerSections.map((section) => (
            <div key={section.title}>
              <h5 className="text-xs font-bold text-foreground mb-3 uppercase tracking-wider">{section.title}</h5>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link to={link.to} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-border">
          <div className="flex flex-wrap items-center gap-3 justify-center">
            {legalLinks.map((link, i) => (
              <Link key={link.label} to={link.to} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                {link.label}
                {i < legalLinks.length - 1 && <span className="ml-3 text-border">|</span>}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <span className="text-xs font-medium text-muted-foreground block mb-2">{t("footer.weAccept")}</span>
              <div className="flex flex-wrap gap-2">
                {paymentMethods.map((m) => (
                  <span key={m} className="px-2 py-1 bg-card border border-border rounded text-[10px] font-medium text-foreground">
                    {m}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">{t("footer.copyright")}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
