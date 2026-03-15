import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useI18n } from "@/contexts/I18nContext";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface FaqCategory {
  title: string;
  items: { q: string; a: string }[];
}

const defaultFaqFr: FaqCategory[] = [
  {
    title: "Commandes & Paiements",
    items: [
      { q: "Comment passer une commande ?", a: "Parcourez nos produits, ajoutez-les au panier et procédez au checkout. Vous pouvez payer par carte bancaire, Mobile Money ou à la livraison selon votre zone." },
      { q: "Quels moyens de paiement acceptez-vous ?", a: "Nous acceptons Visa, Mastercard, PayPal, Apple Pay, Google Pay et Mobile Money (Orange Money, Wave, MTN MoMo)." },
      { q: "Puis-je utiliser un code promo ?", a: "Oui ! Entrez votre code promo dans le champ dédié lors du checkout. La réduction s'appliquera automatiquement si le code est valide." },
      { q: "Puis-je modifier ou annuler ma commande ?", a: "Vous pouvez annuler votre commande tant qu'elle n'a pas été expédiée. Rendez-vous dans votre espace client > Commandes." },
    ],
  },
  {
    title: "Livraison & Suivi",
    items: [
      { q: "Quels sont les délais de livraison ?", a: "Les délais varient selon votre localisation : 2-5 jours en zone urbaine, 5-10 jours en zone rurale, et 7-21 jours pour l'international." },
      { q: "La livraison est-elle gratuite ?", a: "La livraison est gratuite pour toute commande supérieure à $49. En dessous, des frais de livraison s'appliquent selon la destination." },
      { q: "Comment suivre ma commande ?", a: "Connectez-vous à votre espace client et accédez à l'onglet 'Suivi'. Vous y trouverez le statut en temps réel de votre commande." },
    ],
  },
  {
    title: "Retours & Remboursements",
    items: [
      { q: "Quelle est votre politique de retour ?", a: "Vous disposez de 30 jours après réception pour retourner un article dans son état d'origine. Les retours sont gratuits." },
      { q: "Comment demander un remboursement ?", a: "Initiez une demande de retour depuis votre espace client. Une fois l'article reçu et vérifié, le remboursement est effectué sous 5-7 jours ouvrés." },
    ],
  },
  {
    title: "Compte & Sécurité",
    items: [
      { q: "Comment créer un compte ?", a: "Cliquez sur l'icône utilisateur en haut de la page et suivez les instructions d'inscription. Vous devrez vérifier votre email." },
      { q: "J'ai oublié mon mot de passe", a: "Cliquez sur 'Mot de passe oublié' sur la page de connexion. Un lien de réinitialisation sera envoyé à votre adresse email." },
      { q: "Mes données sont-elles en sécurité ?", a: "Oui, nous utilisons un chiffrement de bout en bout et respectons les normes RGPD. Consultez notre Politique de Confidentialité pour plus de détails." },
    ],
  },
];

const defaultFaqEn: FaqCategory[] = [
  {
    title: "Orders & Payments",
    items: [
      { q: "How do I place an order?", a: "Browse our products, add them to your cart and proceed to checkout. You can pay by credit card, Mobile Money or cash on delivery depending on your area." },
      { q: "What payment methods do you accept?", a: "We accept Visa, Mastercard, PayPal, Apple Pay, Google Pay and Mobile Money (Orange Money, Wave, MTN MoMo)." },
      { q: "Can I use a promo code?", a: "Yes! Enter your promo code in the dedicated field at checkout. The discount will be applied automatically if the code is valid." },
      { q: "Can I modify or cancel my order?", a: "You can cancel your order as long as it hasn't been shipped. Go to your account > Orders." },
    ],
  },
  {
    title: "Shipping & Tracking",
    items: [
      { q: "What are the delivery times?", a: "Delivery times vary by location: 2-5 days in urban areas, 5-10 days in rural areas, and 7-21 days for international orders." },
      { q: "Is shipping free?", a: "Shipping is free for all orders over $49. Below that, shipping fees apply depending on the destination." },
      { q: "How do I track my order?", a: "Log in to your account and go to the 'Tracking' tab. You'll find real-time status of your order." },
    ],
  },
  {
    title: "Returns & Refunds",
    items: [
      { q: "What is your return policy?", a: "You have 30 days after receipt to return an item in its original condition. Returns are free." },
      { q: "How do I request a refund?", a: "Initiate a return request from your account. Once the item is received and verified, the refund is processed within 5-7 business days." },
    ],
  },
  {
    title: "Account & Security",
    items: [
      { q: "How do I create an account?", a: "Click the user icon at the top of the page and follow the registration instructions. You'll need to verify your email." },
      { q: "I forgot my password", a: "Click 'Forgot password' on the login page. A reset link will be sent to your email address." },
      { q: "Is my data secure?", a: "Yes, we use end-to-end encryption and comply with GDPR standards. See our Privacy Policy for more details." },
    ],
  },
];

export default function FAQPage() {
  const { t, locale } = useI18n();
  const [cmsFaq, setCmsFaq] = useState<{ fr: FaqCategory[]; en: FaqCategory[] } | null>(null);

  useEffect(() => {
    supabase.from("platform_settings").select("value").eq("key", "cms_faq").maybeSingle().then(({ data }) => {
      if (data?.value) setCmsFaq(data.value as any);
    });
  }, []);

  const faqCategories = cmsFaq
    ? (locale === "en" ? cmsFaq.en : cmsFaq.fr)
    : (locale === "en" ? defaultFaqEn : defaultFaqFr);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqCategories.flatMap(cat =>
      cat.items.map(item => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      }))
    ),
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={`${t("faq.title")} | Zandofy`}
        description={t("faq.subtitle")}
        jsonLd={jsonLd}
      />
      <Header />
      <main className="container py-10 md:py-16">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-2">{t("faq.title")}</h1>
          <p className="text-muted-foreground mb-8">{t("faq.subtitle")}</p>

          {faqCategories.map(cat => (
            <section key={cat.title} className="mb-8">
              <h2 className="text-lg font-bold text-foreground mb-3">{cat.title}</h2>
              <Accordion type="multiple" className="space-y-2">
                {cat.items.map((item, i) => (
                  <AccordionItem key={i} value={`${cat.title}-${i}`} className="bg-card border border-border rounded-lg px-4">
                    <AccordionTrigger className="text-sm font-medium text-foreground hover:no-underline">
                      {item.q}
                    </AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
