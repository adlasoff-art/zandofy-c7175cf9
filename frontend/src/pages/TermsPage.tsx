import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { useI18n } from "@/contexts/I18nContext";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const defaultSectionsFr = [
  { title: "1. Objet", content: "Les présentes Conditions Générales de Vente (CGV) régissent l'ensemble des transactions effectuées sur la plateforme Zandofy. En passant commande, vous acceptez sans réserve les présentes conditions." },
  { title: "2. Inscription", content: "L'utilisation de certains services nécessite la création d'un compte. Vous êtes responsable de la confidentialité de vos identifiants. Toute activité réalisée depuis votre compte est présumée effectuée par vous." },
  { title: "3. Produits & Prix", content: "Les produits sont proposés dans la limite des stocks disponibles. Les prix sont affichés en dollars US (USD) et incluent les taxes applicables. Zandofy se réserve le droit de modifier ses prix à tout moment, les commandes en cours restant au prix convenu." },
  { title: "4. Commandes", content: "Une commande est considérée comme définitive après confirmation du paiement. Un email de confirmation vous est envoyé avec le récapitulatif de votre commande et un numéro de référence." },
  { title: "5. Paiement", content: "Le paiement s'effectue au moment de la commande par les moyens de paiement acceptés (carte bancaire, Mobile Money, PayPal). Le paiement à la livraison est disponible dans certaines zones." },
  { title: "6. Livraison", content: "Les délais de livraison sont indiqués à titre informatif et peuvent varier selon la destination. Zandofy ne saurait être tenue responsable des retards imputables au transporteur." },
  { title: "7. Retours & Remboursements", content: "Vous disposez de 30 jours calendaires à compter de la réception pour retourner un produit non utilisé dans son emballage d'origine. Le remboursement est effectué sous 5 à 7 jours ouvrés après réception et vérification du retour." },
  { title: "8. Garanties", content: "Les produits bénéficient de la garantie légale de conformité et de la garantie des vices cachés. En cas de produit défectueux, contactez notre service client pour obtenir un échange ou un remboursement." },
  { title: "9. Stockage Hub & Pénalités", content: "Les boutiques bénéficient de 14 jours de stockage gratuit au Hub (du lundi au samedi, hors jours fériés). À partir du 15ᵉ jour, une pénalité de $0,25 par jour et par kilogramme est appliquée pour tout stock supérieur à 1 kg. Le quota de stockage gratuit dépend du package souscrit. Les pénalités sont prélevées automatiquement sur le solde de la boutique." },
  { title: "10. Responsabilité", content: "Zandofy agit en qualité d'intermédiaire entre acheteurs et vendeurs. La responsabilité de Zandofy ne saurait être engagée en cas de manquement du vendeur à ses obligations." },
  { title: "11. Propriété Intellectuelle", content: "L'ensemble du contenu du site (textes, images, logos, marques) est protégé par le droit de la propriété intellectuelle. Toute reproduction non autorisée constitue une contrefaçon." },
  { title: "12. Données Personnelles", content: "Le traitement de vos données personnelles est régi par notre Politique de Confidentialité, accessible depuis le lien en bas de page." },
  { title: "13. Droit Applicable", content: "Les présentes CGV sont soumises au droit applicable dans le pays de résidence de l'utilisateur. En cas de litige, une solution amiable sera recherchée avant toute action judiciaire." },
];

const defaultSectionsEn = [
  { title: "1. Purpose", content: "These Terms and Conditions govern all transactions made on the Zandofy platform. By placing an order, you accept these conditions without reservation." },
  { title: "2. Registration", content: "Use of certain services requires creating an account. You are responsible for the confidentiality of your credentials. Any activity from your account is assumed to be performed by you." },
  { title: "3. Products & Prices", content: "Products are offered subject to availability. Prices are displayed in US Dollars (USD) and include applicable taxes. Zandofy reserves the right to modify prices at any time, with current orders remaining at the agreed price." },
  { title: "4. Orders", content: "An order is considered final after payment confirmation. A confirmation email is sent with your order summary and reference number." },
  { title: "5. Payment", content: "Payment is made at the time of order using accepted payment methods (credit card, Mobile Money, PayPal). Cash on delivery is available in certain areas." },
  { title: "6. Delivery", content: "Delivery times are provided for informational purposes and may vary depending on the destination. Zandofy cannot be held responsible for delays attributable to the carrier." },
  { title: "7. Returns & Refunds", content: "You have 30 calendar days from receipt to return an unused product in its original packaging. Refunds are processed within 5 to 7 business days after receipt and verification of the return." },
  { title: "8. Warranties", content: "Products benefit from the legal warranty of conformity and the warranty against hidden defects. In case of a defective product, contact our customer service for an exchange or refund." },
  { title: "9. Hub Storage & Penalties", content: "Stores benefit from 14 days of free Hub storage (Monday to Saturday, excluding public holidays). From the 15th day onward, a penalty of $0.25 per day per kilogram is applied for any stock exceeding 1 kg. The free storage quota depends on the subscribed package. Penalties are automatically deducted from the store balance." },
  { title: "10. Liability", content: "Zandofy acts as an intermediary between buyers and sellers. Zandofy's liability cannot be engaged in case of failure by the seller to meet their obligations." },
  { title: "11. Intellectual Property", content: "All site content (texts, images, logos, trademarks) is protected by intellectual property law. Any unauthorized reproduction constitutes infringement." },
  { title: "12. Personal Data", content: "The processing of your personal data is governed by our Privacy Policy, accessible from the link at the bottom of the page." },
  { title: "13. Applicable Law", content: "These Terms are subject to the law applicable in the user's country of residence. In case of dispute, an amicable solution will be sought before any legal action." },
];

export default function TermsPage() {
  const { t, locale } = useI18n();
  const [cmsData, setCmsData] = useState<{ fr: typeof defaultSectionsFr; en: typeof defaultSectionsEn } | null>(null);

  useEffect(() => {
    supabase.from("platform_settings").select("value").eq("key", "cms_terms").maybeSingle().then(({ data }) => {
      if (data?.value) setCmsData(data.value as any);
    });
  }, []);

  const sections = cmsData
    ? (locale === "en" ? cmsData.en : cmsData.fr)
    : (locale === "en" ? defaultSectionsEn : defaultSectionsFr);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title={`${t("terms.title")} | Zandofy`} description={t("terms.title")} />
      <Header />
      <main className="container py-10 md:py-16">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-2">{t("terms.title")}</h1>
          <p className="text-sm text-muted-foreground mb-8">{t("terms.lastUpdate")}</p>
          <div className="space-y-6">
            {sections.map(s => (
              <article key={s.title}>
                <h2 className="text-base font-bold text-foreground mb-2">{s.title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.content}</p>
              </article>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
