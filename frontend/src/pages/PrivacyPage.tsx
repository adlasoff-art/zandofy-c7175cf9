import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { useI18n } from "@/contexts/I18nContext";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const defaultSectionsFr = [
  { title: "1. Collecte des Données", content: "Nous collectons les données que vous nous fournissez directement (nom, email, adresse, téléphone) lors de votre inscription, vos commandes et vos interactions avec notre service client. Nous collectons également des données de navigation (adresse IP, type de navigateur, pages visitées) via des cookies." },
  { title: "2. Utilisation des Données", content: "Vos données sont utilisées pour : traiter vos commandes, gérer votre compte, personnaliser votre expérience, vous envoyer des communications commerciales (avec votre consentement), améliorer nos services et assurer la sécurité de la plateforme." },
  { title: "3. Partage des Données", content: "Nous partageons vos données uniquement avec : les vendeurs (pour l'exécution de vos commandes), les prestataires de paiement, les transporteurs, et les autorités compétentes (si requis par la loi). Nous ne vendons jamais vos données à des tiers." },
  { title: "4. Cookies", content: "Nous utilisons des cookies essentiels (fonctionnement du site), analytiques (mesure d'audience) et publicitaires (personnalisation des annonces). Vous pouvez gérer vos préférences via notre bandeau cookies ou la page 'Gérer les Cookies'." },
  { title: "5. Sécurité", content: "Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données : chiffrement SSL/TLS, contrôle d'accès strict, audits de sécurité réguliers et hébergement sur des serveurs sécurisés." },
  { title: "6. Conservation", content: "Vos données de compte sont conservées tant que votre compte est actif. Les données de commande sont conservées pendant la durée légale requise (10 ans pour les données comptables). Vous pouvez demander la suppression de votre compte à tout moment." },
  { title: "7. Vos Droits", content: "Conformément au RGPD, vous disposez des droits suivants : accès, rectification, suppression, portabilité, limitation du traitement et opposition. Pour exercer ces droits, contactez-nous à privacy@zandofy.com." },
  { title: "8. Mineurs", content: "Nos services sont destinés aux personnes majeures. Nous ne collectons pas sciemment de données personnelles de mineurs de moins de 16 ans." },
  { title: "9. Modifications", content: "Nous nous réservons le droit de modifier cette politique à tout moment. Les modifications prennent effet dès leur publication sur cette page. Nous vous notifierons des changements significatifs par email." },
  { title: "10. Contact", content: "Pour toute question relative à la protection de vos données, contactez notre Délégué à la Protection des Données à l'adresse : privacy@zandofy.com ou via notre formulaire de contact." },
];

const defaultSectionsEn = [
  { title: "1. Data Collection", content: "We collect data you provide directly (name, email, address, phone) during registration, orders and interactions with our customer service. We also collect browsing data (IP address, browser type, pages visited) via cookies." },
  { title: "2. Data Usage", content: "Your data is used to: process your orders, manage your account, personalize your experience, send you commercial communications (with your consent), improve our services and ensure platform security." },
  { title: "3. Data Sharing", content: "We share your data only with: sellers (for order fulfillment), payment providers, carriers, and competent authorities (if required by law). We never sell your data to third parties." },
  { title: "4. Cookies", content: "We use essential cookies (site functionality), analytical cookies (audience measurement) and advertising cookies (ad personalization). You can manage your preferences via our cookie banner or the 'Manage Cookies' page." },
  { title: "5. Security", content: "We implement appropriate technical and organizational measures to protect your data: SSL/TLS encryption, strict access control, regular security audits and hosting on secure servers." },
  { title: "6. Retention", content: "Your account data is kept as long as your account is active. Order data is kept for the legally required duration (10 years for accounting data). You can request deletion of your account at any time." },
  { title: "7. Your Rights", content: "Under GDPR, you have the following rights: access, rectification, deletion, portability, restriction of processing and objection. To exercise these rights, contact us at privacy@zandofy.com." },
  { title: "8. Minors", content: "Our services are intended for adults. We do not knowingly collect personal data from minors under 16 years of age." },
  { title: "9. Changes", content: "We reserve the right to modify this policy at any time. Changes take effect upon publication on this page. We will notify you of significant changes by email." },
  { title: "10. Contact", content: "For any questions regarding the protection of your data, contact our Data Protection Officer at: privacy@zandofy.com or via our contact form." },
];

export default function PrivacyPage() {
  const { t, locale } = useI18n();
  const [cmsData, setCmsData] = useState<{ fr: typeof defaultSectionsFr; en: typeof defaultSectionsEn } | null>(null);

  useEffect(() => {
    supabase.from("platform_settings").select("value").eq("key", "cms_privacy").maybeSingle().then(({ data }) => {
      if (data?.value) setCmsData(data.value as any);
    });
  }, []);

  const sections = cmsData
    ? (locale === "en" ? cmsData.en : cmsData.fr)
    : (locale === "en" ? defaultSectionsEn : defaultSectionsFr);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title={`${t("privacy.title")} | Zandofy`} description={t("privacy.title")} />
      <Header />
      <main className="container py-10 md:py-16">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-2">{t("privacy.title")}</h1>
          <p className="text-sm text-muted-foreground mb-8">{t("privacy.lastUpdate")}</p>
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
