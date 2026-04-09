import { Link } from "react-router-dom";
import { BrandLogo } from "@/components/BrandLogo";
import { Mail, MapPin, Phone, CreditCard, Shield, Truck, RotateCcw, Facebook, Instagram, Twitter, Youtube, Linkedin } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFooterTheme } from "@/hooks/use-footer-theme";

const paymentMethods = ["Visa", "Mastercard", "Orange Money", "Airtel Money", "M-PESA", "Apple Pay"];

export function Footer() {
  const { t, formatPrice } = useI18n();
  const [freeShippingAmount, setFreeShippingAmount] = useState(999);
  const ft = useFooterTheme();

  const [footerConfig, setFooterConfig] = useState({
    description: "",
    social_links: { facebook: "#", instagram: "#", twitter: "#", youtube: "#", linkedin: "#" },
    newsletter_email: "",
    phone: "+1 (800) ZANDOFY",
    address: "Worldwide",
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
            phone: v.phone || prev.phone,
            address: v.address || prev.address,
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
        { label: t("footer.helpCenter"), to: "/help-center" },
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
        { label: t("footer.socialResponsibility"), to: "/social-responsibility" },
        { label: t("footer.careers"), to: "/careers" },
        { label: t("footer.blog"), to: "/blog" },
        { label: "Tarification", to: "/pricing" },
        { label: t("footer.affiliates"), to: "/affiliate-program" },
      ],
    },
    {
      title: t("footer.helpSupport"),
      links: [
        { label: t("footer.sizeGuide"), to: "/faq" },
        { label: t("footer.faq"), to: "/faq" },
        { label: t("footer.giftCard"), to: "/dashboard" },
        { label: t("footer.loyaltyProgram"), to: "/loyalty-program" },
        { label: t("footer.sellOnZandofy"), to: "/become-vendor" },
        { label: "Top Tendances", to: "/trends" },
        { label: "Plus Populaires", to: "/popular" },
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
    { label: t("footer.manageCookies"), to: "/privacy" },
    { label: t("footer.terms"), to: "/terms" },
  ];

  const iconStyle = ft.guarantee_icon_style === "filled"
    ? { fill: ft.guarantee_icon_color || "currentColor", color: ft.guarantee_icon_color || undefined, strokeWidth: 0 }
    : { color: ft.guarantee_icon_color || undefined };

  return (
    <footer className="border-t border-border" style={{ backgroundColor: ft.bg_color || undefined, color: ft.text_color || undefined }}>
      {/* Guarantees strip */}
      <div className="border-b border-border" style={{ backgroundColor: ft.guarantee_bg_color || undefined }}>
        <div className="container py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {guarantees.map((g) => (
              <div key={g.label} className="flex items-start gap-2">
                <g.icon size={18} className="shrink-0 mt-0.5" style={iconStyle} />
                <span className="text-xs font-medium leading-tight" style={{ color: ft.text_color || undefined }}>{g.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Newsletter */}
      <div className="border-b border-border" style={{ backgroundColor: ft.guarantee_bg_color || undefined }}>
        <div className="container py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold" style={{ color: ft.section_title_color || ft.text_color || undefined }}>{t("footer.newsletter")}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{t("footer.newsletterSub")}</p>
            </div>
            <div className="flex w-full md:w-auto max-w-md gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                <input
                  type="email"
                  placeholder={t("footer.emailPlaceholder")}
                  className="w-full pl-9 pr-4 py-2.5 text-xs border border-border outline-none focus:border-primary"
                  style={{ backgroundColor: ft.newsletter_input_bg || undefined }}
                />
              </div>
              <button
                className="px-6 py-2.5 text-xs font-bold transition-colors whitespace-nowrap"
                style={{
                  backgroundColor: ft.newsletter_btn_bg || "hsl(var(--foreground))",
                  color: ft.newsletter_btn_text || "hsl(var(--card))",
                }}
              >
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
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                  style={{
                    borderWidth: 1,
                    borderStyle: "solid",
                    borderColor: ft.social_border_color || "hsl(var(--border))",
                    color: ft.social_icon_color || undefined,
                  }}
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
            <div className="mb-3"><BrandLogo variant="footer" /></div>
            <p className="text-xs leading-relaxed mb-4" style={{ color: ft.text_color || undefined }}>{footerConfig.description || t("footer.description")}</p>
            <div className="flex items-center gap-2 text-xs" style={{ color: ft.text_color || undefined }}>
              <MapPin size={12} />
              <span>{footerConfig.address}</span>
            </div>
            <div className="flex items-center gap-2 text-xs mt-1.5" style={{ color: ft.text_color || undefined }}>
              <Phone size={12} />
              <span>{footerConfig.phone}</span>
            </div>
          </div>

          {footerSections.map((section) => (
            <div key={section.title}>
              <h5 className="text-xs font-bold mb-3 uppercase tracking-wider" style={{ color: ft.section_title_color || ft.text_color || undefined }}>{section.title}</h5>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link to={link.to} className="text-xs transition-colors hover:opacity-80" style={{ color: ft.link_color || undefined }}>
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
              <Link key={link.label} to={link.to} className="text-[10px] transition-colors hover:opacity-80" style={{ color: ft.link_color || ft.text_color || undefined }}>
                {link.label}
                {i < legalLinks.length - 1 && <span className="ml-3 text-border">|</span>}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <span className="text-xs font-medium block mb-2" style={{ color: ft.text_color || undefined }}>{t("footer.weAccept")}</span>
              <div className="flex flex-wrap gap-2">
                {paymentMethods.map((m) => (
                  <span key={m} className="px-2 py-1 bg-card border border-border rounded text-[10px] font-medium text-foreground">
                    {m}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-[10px]" style={{ color: ft.text_color || undefined }}>{t("footer.copyright").replace(/©\s*\d{4}/, `© ${new Date().getFullYear()}`)}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
