import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "privacy" | "terms" | "cookies";
}

const CONTENT: Record<string, { title: string; sections: { title: string; text: string }[] }> = {
  privacy: {
    title: "Politique de confidentialité",
    sections: [
      { title: "1. Collecte des données", text: "Nous collectons les données que vous nous fournissez (nom, email, adresse, téléphone) lors de votre inscription et vos commandes, ainsi que des données de navigation via des cookies." },
      { title: "2. Utilisation", text: "Vos données servent à traiter vos commandes, gérer votre compte, personnaliser votre expérience et améliorer nos services." },
      { title: "3. Partage", text: "Nous partageons vos données uniquement avec les vendeurs, prestataires de paiement et transporteurs nécessaires à l'exécution de vos commandes." },
      { title: "4. Sécurité", text: "Chiffrement SSL/TLS, contrôle d'accès strict, audits réguliers et hébergement sécurisé protègent vos données." },
      { title: "5. Vos droits", text: "Vous disposez des droits d'accès, rectification, suppression et portabilité de vos données. Contactez privacy@zandofy.com." },
    ],
  },
  terms: {
    title: "Conditions Générales d'Utilisation",
    sections: [
      { title: "1. Objet", text: "Les présentes CGU régissent l'utilisation de la plateforme Zandofy, marketplace multi-vendeurs." },
      { title: "2. Inscription", text: "L'inscription est gratuite et réservée aux personnes majeures. Vous êtes responsable de la confidentialité de vos identifiants." },
      { title: "3. Commandes", text: "Toute commande vaut acceptation des prix et conditions de vente. Le paiement est exigible à la commande." },
      { title: "4. Livraison", text: "Les délais sont indicatifs. Zandofy n'est pas responsable des retards imputables aux transporteurs." },
      { title: "5. Responsabilité", text: "Zandofy agit en tant qu'intermédiaire. Sa responsabilité ne peut être engagée en cas de manquement du vendeur." },
    ],
  },
  cookies: {
    title: "Politique de Cookies",
    sections: [
      { title: "1. Qu'est-ce qu'un cookie ?", text: "Un cookie est un petit fichier texte stocké sur votre appareil lors de la visite d'un site web." },
      { title: "2. Cookies essentiels", text: "Nécessaires au fonctionnement du site : session, panier, préférences de langue. Ne peuvent pas être désactivés." },
      { title: "3. Cookies analytiques", text: "Mesurent l'audience et l'utilisation du site pour améliorer nos services. Peuvent être désactivés." },
      { title: "4. Cookies marketing", text: "Personnalisent les publicités affichées. Soumis à votre consentement explicite." },
      { title: "5. Gestion", text: "Vous pouvez gérer vos préférences via le bandeau cookies ou les paramètres de votre navigateur." },
    ],
  },
};

export function LegalModal({ open, onOpenChange, type }: Props) {
  const content = CONTENT[type];
  if (!content) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-lg">{content.title}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-4">
            {content.sections.map((s, i) => (
              <div key={i}>
                <h3 className="text-sm font-semibold text-foreground mb-1">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.text}</p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
