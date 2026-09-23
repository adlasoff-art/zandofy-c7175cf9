/** CMS marketing landings (Discover + Become Vendor) — platform_settings JSON helpers. */

export type LandingTextItem = { title: string; desc: string };
export type LandingFaqItem = { q: string; a: string };

export type LandingLocaleContent = {
  seo: { title: string; description: string };
  hero: {
    eyebrow: string;
    title: string;
    highlight: string;
    subtitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
  };
  why: { title: string; subtitle: string };
  benefits: LandingTextItem[];
  how: { title: string; subtitle: string };
  steps: LandingTextItem[];
  trust: { title: string; subtitle: string; items: LandingTextItem[] };
  faq: { title: string; items: LandingFaqItem[]; moreLabel: string };
  final: {
    title: string;
    subtitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
  };
  sections: {
    why: boolean;
    how: boolean;
    trust: boolean;
    faq: boolean;
    final: boolean;
  };
};

export type CmsLandingDocument = {
  fr: LandingLocaleContent;
  en: LandingLocaleContent;
};

export type CmsLandingKey = "cms_discover" | "cms_become_vendor_landing";

/** Cap CMS text size + strip tags (defense in depth; React already escapes). */
const CMS_TEXT_MAX = 4000;

export function sanitizeCmsText(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
    .slice(0, CMS_TEXT_MAX);
}

function pickStr(cms: unknown, fallback: string): string {
  if (typeof cms === "string") {
    const cleaned = sanitizeCmsText(cms);
    if (cleaned) return cleaned;
  }
  return fallback;
}

function pickBool(cms: unknown, fallback: boolean): boolean {
  return typeof cms === "boolean" ? cms : fallback;
}

function mergeTextItems(
  cms: unknown,
  fallback: LandingTextItem[]
): LandingTextItem[] {
  if (!Array.isArray(cms) || cms.length === 0) return fallback;
  return cms.map((raw, i) => {
    const fb = fallback[i] ?? { title: "", desc: "" };
    const row = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    return {
      title: pickStr(row.title, fb.title),
      desc: pickStr(row.desc, fb.desc),
    };
  });
}

function mergeFaqItems(
  cms: unknown,
  fallback: LandingFaqItem[]
): LandingFaqItem[] {
  if (!Array.isArray(cms) || cms.length === 0) return fallback;
  return cms.map((raw, i) => {
    const fb = fallback[i] ?? { q: "", a: "" };
    const row = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    return {
      q: pickStr(row.q, fb.q),
      a: pickStr(row.a, fb.a),
    };
  });
}

/** Merge CMS locale blob with i18n fallback (empty CMS fields → fallback). */
export function mergeLandingContent(
  cmsLocale: unknown,
  fallback: LandingLocaleContent
): LandingLocaleContent {
  if (!cmsLocale || typeof cmsLocale !== "object") return fallback;
  const c = cmsLocale as Record<string, any>;
  const seo = (c.seo && typeof c.seo === "object" ? c.seo : {}) as Record<string, unknown>;
  const hero = (c.hero && typeof c.hero === "object" ? c.hero : {}) as Record<string, unknown>;
  const why = (c.why && typeof c.why === "object" ? c.why : {}) as Record<string, unknown>;
  const how = (c.how && typeof c.how === "object" ? c.how : {}) as Record<string, unknown>;
  const trust = (c.trust && typeof c.trust === "object" ? c.trust : {}) as Record<string, any>;
  const faq = (c.faq && typeof c.faq === "object" ? c.faq : {}) as Record<string, any>;
  const final = (c.final && typeof c.final === "object" ? c.final : {}) as Record<string, unknown>;
  const sections = (c.sections && typeof c.sections === "object" ? c.sections : {}) as Record<
    string,
    unknown
  >;

  return {
    seo: {
      title: pickStr(seo.title, fallback.seo.title),
      description: pickStr(seo.description, fallback.seo.description),
    },
    hero: {
      eyebrow: pickStr(hero.eyebrow, fallback.hero.eyebrow),
      title: pickStr(hero.title, fallback.hero.title),
      highlight: pickStr(hero.highlight, fallback.hero.highlight),
      subtitle: pickStr(hero.subtitle, fallback.hero.subtitle),
      ctaPrimary: pickStr(hero.ctaPrimary, fallback.hero.ctaPrimary),
      ctaSecondary: pickStr(hero.ctaSecondary, fallback.hero.ctaSecondary),
    },
    why: {
      title: pickStr(why.title, fallback.why.title),
      subtitle: pickStr(why.subtitle, fallback.why.subtitle),
    },
    benefits: mergeTextItems(c.benefits, fallback.benefits),
    how: {
      title: pickStr(how.title, fallback.how.title),
      subtitle: pickStr(how.subtitle, fallback.how.subtitle),
    },
    steps: mergeTextItems(c.steps, fallback.steps),
    trust: {
      title: pickStr(trust.title, fallback.trust.title),
      subtitle: pickStr(trust.subtitle, fallback.trust.subtitle),
      items: mergeTextItems(trust.items, fallback.trust.items),
    },
    faq: {
      title: pickStr(faq.title, fallback.faq.title),
      items: mergeFaqItems(faq.items, fallback.faq.items),
      moreLabel: pickStr(faq.moreLabel, fallback.faq.moreLabel),
    },
    final: {
      title: pickStr(final.title, fallback.final.title),
      subtitle: pickStr(final.subtitle, fallback.final.subtitle),
      ctaPrimary: pickStr(final.ctaPrimary, fallback.final.ctaPrimary),
      ctaSecondary: pickStr(final.ctaSecondary, fallback.final.ctaSecondary),
    },
    sections: {
      why: pickBool(sections.why, fallback.sections.why),
      how: pickBool(sections.how, fallback.sections.how),
      trust: pickBool(sections.trust, fallback.sections.trust),
      faq: pickBool(sections.faq, fallback.sections.faq),
      final: pickBool(sections.final, fallback.sections.final),
    },
  };
}

export function emptyLandingLocale(
  overrides?: Partial<LandingLocaleContent>
): LandingLocaleContent {
  const base: LandingLocaleContent = {
    seo: { title: "", description: "" },
    hero: {
      eyebrow: "",
      title: "",
      highlight: "",
      subtitle: "",
      ctaPrimary: "",
      ctaSecondary: "",
    },
    why: { title: "", subtitle: "" },
    benefits: [],
    how: { title: "", subtitle: "" },
    steps: [],
    trust: { title: "", subtitle: "", items: [] },
    faq: { title: "", items: [], moreLabel: "" },
    final: { title: "", subtitle: "", ctaPrimary: "", ctaSecondary: "" },
    sections: { why: true, how: true, trust: true, faq: true, final: true },
  };
  return overrides ? { ...base, ...overrides } : base;
}

/** Build Discover fallback from i18n `t` for the active locale. */
export function discoverFallbackFromT(
  t: (key: string) => string
): LandingLocaleContent {
  return {
    seo: { title: t("discover.seo.title"), description: t("discover.seo.desc") },
    hero: {
      eyebrow: t("discover.eyebrow"),
      title: t("discover.hero.title"),
      highlight: t("discover.hero.highlight"),
      subtitle: t("discover.hero.subtitle"),
      ctaPrimary: t("discover.cta.explore"),
      ctaSecondary: t("discover.cta.becomeVendor"),
    },
    why: { title: t("discover.why.title"), subtitle: t("discover.why.subtitle") },
    benefits: [
      { title: t("discover.benefit.factory.title"), desc: t("discover.benefit.factory.desc") },
      { title: t("discover.benefit.logistics.title"), desc: t("discover.benefit.logistics.desc") },
      { title: t("discover.benefit.pay.title"), desc: t("discover.benefit.pay.desc") },
      { title: t("discover.benefit.trust.title"), desc: t("discover.benefit.trust.desc") },
    ],
    how: { title: t("discover.how.title"), subtitle: t("discover.how.subtitle") },
    steps: [
      { title: t("discover.step1.title"), desc: t("discover.step1.desc") },
      { title: t("discover.step2.title"), desc: t("discover.step2.desc") },
      { title: t("discover.step3.title"), desc: t("discover.step3.desc") },
    ],
    trust: {
      title: t("discover.trust.title"),
      subtitle: t("discover.trust.subtitle"),
      items: [
        { title: t("discover.trust.kyc.title"), desc: t("discover.trust.kyc.desc") },
        { title: t("discover.trust.track.title"), desc: t("discover.trust.track.desc") },
        { title: t("discover.trust.hub.title"), desc: t("discover.trust.hub.desc") },
        { title: t("discover.trust.vendors.title"), desc: t("discover.trust.vendors.desc") },
      ],
    },
    faq: {
      title: t("discover.faq.title"),
      items: [
        { q: t("discover.faq1.q"), a: t("discover.faq1.a") },
        { q: t("discover.faq2.q"), a: t("discover.faq2.a") },
        { q: t("discover.faq3.q"), a: t("discover.faq3.a") },
        { q: t("discover.faq4.q"), a: t("discover.faq4.a") },
      ],
      moreLabel: t("discover.faq.more"),
    },
    final: {
      title: t("discover.final.title"),
      subtitle: t("discover.final.subtitle"),
      ctaPrimary: t("discover.cta.explore"),
      ctaSecondary: t("discover.cta.becomeVendor"),
    },
    sections: { why: true, how: true, trust: true, faq: true, final: true },
  };
}

/** Build Become Vendor landing fallback from i18n `t`. */
export function becomeVendorFallbackFromT(
  t: (key: string) => string
): LandingLocaleContent {
  return {
    seo: {
      title: t("becomeVendor.landing.seo.title"),
      description: t("becomeVendor.landing.seo.desc"),
    },
    hero: {
      eyebrow: t("becomeVendor.landing.eyebrow"),
      title: t("becomeVendor.landing.hero.title"),
      highlight: t("becomeVendor.landing.hero.highlight"),
      subtitle: t("becomeVendor.landing.hero.subtitle"),
      ctaPrimary: t("becomeVendor.landing.cta.apply"),
      ctaSecondary: t("becomeVendor.landing.cta.pricing"),
    },
    why: {
      title: t("becomeVendor.landing.why.title"),
      subtitle: t("becomeVendor.landing.why.subtitle"),
    },
    benefits: [
      {
        title: t("becomeVendor.landing.benefit.store.title"),
        desc: t("becomeVendor.landing.benefit.store.desc"),
      },
      {
        title: t("becomeVendor.landing.benefit.reach.title"),
        desc: t("becomeVendor.landing.benefit.reach.desc"),
      },
      {
        title: t("becomeVendor.landing.benefit.logistics.title"),
        desc: t("becomeVendor.landing.benefit.logistics.desc"),
      },
      {
        title: t("becomeVendor.landing.benefit.commission.title"),
        desc: t("becomeVendor.landing.benefit.commission.desc"),
      },
      {
        title: t("becomeVendor.landing.benefit.whatsapp.title"),
        desc: t("becomeVendor.landing.benefit.whatsapp.desc"),
      },
      {
        title: t("becomeVendor.landing.benefit.catalog.title"),
        desc: t("becomeVendor.landing.benefit.catalog.desc"),
      },
    ],
    how: {
      title: t("becomeVendor.landing.how.title"),
      subtitle: t("becomeVendor.landing.how.subtitle"),
    },
    steps: [
      {
        title: t("becomeVendor.landing.step1.title"),
        desc: t("becomeVendor.landing.step1.desc"),
      },
      {
        title: t("becomeVendor.landing.step2.title"),
        desc: t("becomeVendor.landing.step2.desc"),
      },
      {
        title: t("becomeVendor.landing.step3.title"),
        desc: t("becomeVendor.landing.step3.desc"),
      },
    ],
    trust: { title: "", subtitle: "", items: [] },
    faq: {
      title: t("becomeVendor.landing.faq.title"),
      items: [
        { q: t("becomeVendor.landing.faq1.q"), a: t("becomeVendor.landing.faq1.a") },
        { q: t("becomeVendor.landing.faq2.q"), a: t("becomeVendor.landing.faq2.a") },
        { q: t("becomeVendor.landing.faq3.q"), a: t("becomeVendor.landing.faq3.a") },
        { q: t("becomeVendor.landing.faq4.q"), a: t("becomeVendor.landing.faq4.a") },
      ],
      moreLabel: "",
    },
    final: {
      title: t("becomeVendor.landing.final.title"),
      subtitle: t("becomeVendor.landing.final.subtitle"),
      ctaPrimary: t("becomeVendor.landing.cta.apply"),
      ctaSecondary: t("becomeVendor.landing.cta.discover"),
    },
    sections: { why: true, how: true, trust: false, faq: true, final: true },
  };
}

/** Seed documents for migration / admin empty state (post-I2 FR+EN). */
export const DISCOVER_SEED: CmsLandingDocument = {
  fr: {
    seo: {
      title: "Découvrir Zandofy | Marketplace Chine–Afrique",
      description:
        "Zandofy connecte acheteurs en Afrique et vendeurs : prix usine, logistique, paiement Mobile Money / carte, suivi de commande.",
    },
    hero: {
      eyebrow: "Marketplace sino-africaine",
      title: "Achetez mieux avec",
      highlight: "Zandofy",
      subtitle:
        "Produits locaux et importés, paiement adapté à l’Afrique, et une logistique pensée pour livrer dans votre pays, votre ville et même jusqu’à chez vous.",
      ctaPrimary: "Explorer le catalogue",
      ctaSecondary: "Devenir vendeur",
    },
    why: {
      title: "Pourquoi Zandofy ?",
      subtitle: "Une marketplace complète — pas seulement une simple boutique.",
    },
    benefits: [
      {
        title: "Prix des usines, grossistes et détaillants",
        desc: "Accédez à des vendeurs et sources internationales avec une transparence sur le parcours commande.",
      },
      {
        title: "Logistique : partout, vers et depuis l’Afrique",
        desc: "Transit, hub et livraison locale selon les options disponibles sur chaque commande.",
      },
      {
        title: "Multiples méthodes de paiement",
        desc: "Mobile Money, carte bancaire, hors plateforme, COD ou WhatsApp (selon la boutique) au checkout.",
      },
      {
        title: "Confiance & suivi",
        desc: "Espace client, preuves de paiement, et suivi d’état de commande en temps réel, support 24h/24 et 7j/7.",
      },
    ],
    how: {
      title: "Comment commander ?",
      subtitle: "Du catalogue à la livraison, en trois étapes.",
    },
    steps: [
      {
        title: "Parcourir",
        desc: "Explorez catégories, boutiques et offres adaptées à votre marché.",
      },
      {
        title: "Panier & checkout",
        desc: "Choisissez le mode de paiement autorisé pour votre panier.",
      },
      {
        title: "Suivre",
        desc: "Suivez votre commande depuis votre espace client jusqu’à la livraison.",
      },
    ],
    trust: {
      title: "Achetez en confiance",
      subtitle: "Des garde-fous côté vendeurs et côté commande.",
      items: [
        {
          title: "Vendeurs vérifiés",
          desc: "Candidature vendeur avec vérification d’identité (KYC).",
        },
        {
          title: "Suivi de commande",
          desc: "Statuts clairs dans votre tableau de bord client.",
        },
        {
          title: "Réseau logistique",
          desc: "Transitaires, entrepôts (hubs) et options de livraison selon le parcours.",
        },
        {
          title: "Boutiques multiples",
          desc: "Fournisseurs locaux et internationaux sur une même plateforme.",
        },
      ],
    },
    faq: {
      title: "Questions fréquentes",
      items: [
        {
          q: "Zandofy remplace-t-il WhatsApp ?",
          a: "Non. Zandofy est une marketplace avec checkout. WhatsApp peut être un moyen de paiement optionnel chez certains vendeurs.",
        },
        {
          q: "Quels paiements sont disponibles ?",
          a: "Selon la boutique et les réglages plateforme : Mobile Money, carte, hors plateforme, COD (KYC), WhatsApp.",
        },
        {
          q: "Puis-je suivre ma commande ?",
          a: "Oui, depuis votre espace client (dashboard) et les pages de suivi.",
        },
        {
          q: "Comment vendre sur Zandofy ?",
          a: "Ouvrez la page Devenir vendeur, candidatez, puis validez votre identité.",
        },
      ],
      moreLabel: "Voir toute la FAQ",
    },
    final: {
      title: "Prêt à découvrir le catalogue ?",
      subtitle: "Parcourez les produits ou ouvrez une boutique vendeur.",
      ctaPrimary: "Explorer le catalogue",
      ctaSecondary: "Devenir vendeur",
    },
    sections: { why: true, how: true, trust: true, faq: true, final: true },
  },
  en: {
    seo: {
      title: "Discover Zandofy | China–Africa marketplace",
      description:
        "Zandofy connects African buyers and sellers: factory prices, logistics, Mobile Money / card payments, order tracking.",
    },
    hero: {
      eyebrow: "Sino-African marketplace",
      title: "Shop smarter with",
      highlight: "Zandofy",
      subtitle:
        "Local and imported products, Africa-ready payments, and logistics designed to deliver in your country, your city, and even to your door.",
      ctaPrimary: "Browse the catalog",
      ctaSecondary: "Become a seller",
    },
    why: {
      title: "Why Zandofy?",
      subtitle: "A full marketplace — not just a simple storefront.",
    },
    benefits: [
      {
        title: "Factory, wholesaler and retailer prices",
        desc: "Access international sellers and sources with a clear order journey.",
      },
      {
        title: "Logistics: everywhere, to and from Africa",
        desc: "Freight, hub and local delivery options depending on each order.",
      },
      {
        title: "Multiple payment methods",
        desc: "Mobile Money, bank card, off-platform, COD or WhatsApp (per store) at checkout.",
      },
      {
        title: "Trust & tracking",
        desc: "Customer space, payment proofs, and real-time order status tracking, with 24/7 support.",
      },
    ],
    how: {
      title: "How to order?",
      subtitle: "From catalog to delivery in three steps.",
    },
    steps: [
      {
        title: "Browse",
        desc: "Explore categories, stores and offers for your market.",
      },
      {
        title: "Cart & checkout",
        desc: "Pick a payment method allowed for your cart.",
      },
      {
        title: "Track",
        desc: "Follow your order from your customer space through to delivery.",
      },
    ],
    trust: {
      title: "Shop with confidence",
      subtitle: "Guards on the seller side and the order side.",
      items: [
        {
          title: "Verified sellers",
          desc: "Seller application with identity verification (KYC).",
        },
        {
          title: "Order tracking",
          desc: "Clear statuses in your customer dashboard.",
        },
        {
          title: "Logistics network",
          desc: "Forwarders, warehouses (hubs) and delivery options along the journey.",
        },
        {
          title: "Multiple stores",
          desc: "Local and international suppliers on one platform.",
        },
      ],
    },
    faq: {
      title: "Frequently asked questions",
      items: [
        {
          q: "Does Zandofy replace WhatsApp?",
          a: "No. Zandofy is a marketplace with checkout. WhatsApp can be an optional payment method for some sellers.",
        },
        {
          q: "Which payments are available?",
          a: "Depending on the store and platform settings: Mobile Money, card, off-platform, COD (KYC), WhatsApp.",
        },
        {
          q: "Can I track my order?",
          a: "Yes, from your customer space (dashboard) and tracking pages.",
        },
        {
          q: "How do I sell on Zandofy?",
          a: "Open Become a seller, apply, then verify your identity.",
        },
      ],
      moreLabel: "See full FAQ",
    },
    final: {
      title: "Ready to browse the catalog?",
      subtitle: "Explore products or open a seller store.",
      ctaPrimary: "Browse the catalog",
      ctaSecondary: "Become a seller",
    },
    sections: { why: true, how: true, trust: true, faq: true, final: true },
  },
};

export const BECOME_VENDOR_SEED: CmsLandingDocument = {
  fr: {
    seo: {
      title: "Devenir vendeur | Zandofy",
      description:
        "Vendez sur Zandofy : catalogue, clients en Afrique, logistique Chine–Afrique, commission sur ventes livrées. Candidature en quelques étapes.",
    },
    hero: {
      eyebrow: "Espace vendeur",
      title: "Vendez sur",
      highlight: "Zandofy",
      subtitle:
        "Marketplace africaine : ouvrez votre boutique, touchez des acheteurs en Afrique, et laissez la plateforme gérer paiement et logistique.",
      ctaPrimary: "Candidater",
      ctaSecondary: "Voir la tarification",
    },
    why: {
      title: "Pourquoi vendre sur Zandofy ?",
      subtitle:
        "Un modèle marketplace continentale — pas une simple boutique ou catalogue WhatsApp.",
    },
    benefits: [
      {
        title: "Votre boutique en ligne",
        desc: "Catalogue, commandes et suivi dans un espace vendeur dédié.",
      },
      {
        title: "Clients en Afrique",
        desc: "Accédez à des acheteurs qui cherchent déjà des produits importés et locaux.",
      },
      {
        title: "Logistique intégrée",
        desc: "Chaîne transitaires / hub / livraison locale selon le type de boutique.",
      },
      {
        title: "Gratuit pour démarrer",
        desc: "Vendre est gratuit. Commission d’environ 10 % sur les commandes livrées (paiement sécurisé).",
      },
      {
        title: "Option paiement WhatsApp",
        desc: "Si activé pour votre boutique : commande enregistrée + récépissé WhatsApp, confirmation ensuite.",
      },
      {
        title: "Jusqu’à 100 produits",
        desc: "Quota catalogue généreux au démarrage ; options Mobile Money boutique en upsell.",
      },
    ],
    how: {
      title: "Comment candidater ?",
      subtitle: "Trois étapes pour ouvrir votre boutique.",
    },
    steps: [
      {
        title: "Créez un compte",
        desc: "Connectez-vous puis démarrez la candidature vendeur.",
      },
      {
        title: "KYC identité",
        desc: "Vérification d’identité obligatoire. Les docs entreprise (KYB) viennent plus tard selon le palier de ventes.",
      },
      {
        title: "Boutique active",
        desc: "Après validation de l’équipe Zandofy, publiez vos produits et recevez des commandes.",
      },
    ],
    trust: { title: "", subtitle: "", items: [] },
    faq: {
      title: "Questions fréquentes vendeurs",
      items: [
        {
          q: "Faut-il payer un abonnement pour vendre ?",
          a: "Non. Vendre est gratuit. La plateforme prélève une commission sur les commandes livrées. Des forfaits optionnels existent (ex. : numéros Mobile Money, catalogue au-delà de 100 produits, boutiques supplémentaires au-delà de la première, offerte gratuitement).",
        },
        {
          q: "Le KYB est-il obligatoire à l’inscription ?",
          a: "Non à la création. Le KYC identité l’est. Le KYB entreprise est demandé après un palier de ventes.",
        },
        {
          q: "Puis-je encaisser via WhatsApp ?",
          a: "Oui si l’équipe Zandofy active le mode pour votre boutique et que votre numéro WhatsApp est renseigné. Ce n’est pas le seul moyen de paiement.",
        },
        {
          q: "Local ou international ?",
          a: "Vous choisissez le type de boutique à la candidature : stock local ou sourcing / import.",
        },
      ],
      moreLabel: "",
    },
    final: {
      title: "Prêt à ouvrir votre boutique ?",
      subtitle: "Complétez la candidature ci-dessous. Notre équipe valide ensuite votre dossier.",
      ctaPrimary: "Candidater",
      ctaSecondary: "Découvrir Zandofy",
    },
    sections: { why: true, how: true, trust: false, faq: true, final: true },
  },
  en: {
    seo: {
      title: "Become a seller | Zandofy",
      description:
        "Sell on Zandofy: catalog, African buyers, China–Africa logistics, commission on delivered orders. Apply in a few steps.",
    },
    hero: {
      eyebrow: "Seller space",
      title: "Sell on",
      highlight: "Zandofy",
      subtitle:
        "African marketplace: open your store, reach buyers in Africa, and let the platform handle payments and logistics.",
      ctaPrimary: "Apply now",
      ctaSecondary: "See pricing",
    },
    why: {
      title: "Why sell on Zandofy?",
      subtitle:
        "A continental marketplace model — not just a simple store or WhatsApp catalog.",
    },
    benefits: [
      {
        title: "Your online store",
        desc: "Catalog, orders and tracking in a dedicated seller workspace.",
      },
      {
        title: "Buyers in Africa",
        desc: "Reach shoppers already looking for imported and local products.",
      },
      {
        title: "Built-in logistics",
        desc: "Forwarders, hub and last-mile options depending on store type.",
      },
      {
        title: "Free to start",
        desc: "Selling is free. About 10% commission on delivered orders (secured payments).",
      },
      {
        title: "Optional WhatsApp payment",
        desc: "If enabled for your store: order saved + WhatsApp receipt, then confirmation.",
      },
      {
        title: "Up to 100 products",
        desc: "Generous catalog quota to start; optional Mobile Money number upsells.",
      },
    ],
    how: {
      title: "How to apply?",
      subtitle: "Three steps to open your store.",
    },
    steps: [
      {
        title: "Create an account",
        desc: "Sign in, then start the seller application.",
      },
      {
        title: "Identity KYC",
        desc: "Identity verification is required. Company KYB comes later after a sales threshold.",
      },
      {
        title: "Active store",
        desc: "After Zandofy team approval, publish products and receive orders.",
      },
    ],
    trust: { title: "", subtitle: "", items: [] },
    faq: {
      title: "Seller FAQ",
      items: [
        {
          q: "Do I need a subscription to sell?",
          a: "No. Selling is free. The platform takes a commission on delivered orders. Optional plans exist (e.g. Mobile Money numbers, catalog beyond 100 products, extra stores beyond the first, which is free).",
        },
        {
          q: "Is KYB required at signup?",
          a: "Not at creation. Identity KYC is. Company KYB is requested after a sales threshold.",
        },
        {
          q: "Can I collect via WhatsApp?",
          a: "Yes if the Zandofy team enables it for your store and your WhatsApp number is set. It is not the only payment method.",
        },
        {
          q: "Local or international?",
          a: "You choose store type in the application: local stock or import / sourcing.",
        },
      ],
      moreLabel: "",
    },
    final: {
      title: "Ready to open your store?",
      subtitle: "Complete the application below. Our team will review your file.",
      ctaPrimary: "Apply now",
      ctaSecondary: "Discover Zandofy",
    },
    sections: { why: true, how: true, trust: false, faq: true, final: true },
  },
};
