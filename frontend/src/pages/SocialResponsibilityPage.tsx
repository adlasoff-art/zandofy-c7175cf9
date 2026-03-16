import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useI18n } from "@/contexts/I18nContext";
import { Heart, Globe2, Leaf, GraduationCap, HandHeart, ShieldCheck, Users, ArrowRight, CheckCircle2, Target } from "lucide-react";

const pillars = [
  { icon: HandHeart, title: "Commerce Équitable", desc: "Nous soutenons les artisans et petits producteurs africains en leur offrant une plateforme de vente accessible et équitable, avec des commissions transparentes.", color: "primary" },
  { icon: Leaf, title: "Environnement", desc: "Nous optimisons nos chaînes logistiques pour réduire notre empreinte carbone et encourageons les emballages recyclables et écologiques.", color: "primary" },
  { icon: GraduationCap, title: "Éducation & Formation", desc: "Nous formons nos vendeurs au commerce digital et contribuons à des programmes d'alphabétisation numérique dans les communautés locales.", color: "primary" },
  { icon: Users, title: "Inclusion & Diversité", desc: "Nous promouvons l'égalité des chances en soutenant les entrepreneures féminines et les jeunes créateurs d'entreprise à travers l'Afrique.", color: "primary" },
];

const commitments = [
  "Soutien aux vendeurs locaux et artisans africains",
  "Réduction de l'empreinte carbone de nos livraisons",
  "Programmes de formation numérique pour les communautés",
  "Partenariats avec des ONG locales et internationales",
  "Politique de non-discrimination et d'inclusion",
  "Transparence totale sur nos pratiques commerciales",
  "Emballages éco-responsables encouragés",
  "Contribution au développement économique local",
];

const impacts = [
  { value: "500+", label: "Vendeurs africains accompagnés" },
  { value: "15+", label: "Pays couverts en Afrique" },
  { value: "1000+", label: "Emplois indirects créés" },
  { value: "30%", label: "De réduction d'emballage plastique visée" },
];

export default function SocialResponsibilityPage() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-accent/10 to-secondary/20 py-20 md:py-28">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,hsl(var(--primary)/0.08),transparent_60%)]" />
          <div className="container mx-auto px-4 relative z-10 text-center max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-6">
              <Heart className="w-4 h-4" />
              Notre engagement
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-foreground mb-6 leading-tight">
              Responsabilité <span className="text-primary">Sociale</span> & Environnementale
            </h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Chez Zandofy, nous croyons que le commerce peut être une force de changement positif.
              Nous nous engageons à construire une plateforme responsable, équitable et durable pour l'Afrique et au-delà.
            </p>
          </div>
        </section>

        {/* Mission */}
        <section className="py-16 md:py-20 container mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto">
            <Target className="w-12 h-12 text-primary mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-foreground mb-4">Notre Mission</h2>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Démocratiser l'accès au commerce international pour les entreprises africaines, tout en garantissant
              des pratiques éthiques, durables et bénéfiques pour les communautés. Nous voulons prouver qu'il est
              possible de concilier croissance économique et responsabilité sociale.
            </p>
          </div>
        </section>

        {/* Pillars */}
        <section className="py-16 md:py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center text-foreground mb-4">Nos Piliers RSE</h2>
            <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
              Quatre axes stratégiques guident notre engagement au quotidien.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {pillars.map((p, i) => (
                <div key={i} className="bg-card rounded-2xl p-6 border border-border hover:shadow-lg transition-shadow">
                  <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <p.icon className="w-7 h-7 text-primary" />
                  </div>
                  <h3 className="font-bold text-foreground text-lg mb-2">{p.title}</h3>
                  <p className="text-muted-foreground text-sm">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Impact numbers */}
        <section className="py-16 md:py-20 container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">Notre Impact en Chiffres</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {impacts.map((item, i) => (
              <div key={i} className="text-center bg-card rounded-2xl p-6 border border-border">
                <div className="text-4xl font-extrabold text-primary mb-2">{item.value}</div>
                <div className="text-muted-foreground text-sm font-medium">{item.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Commitments */}
        <section className="py-16 md:py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center text-foreground mb-4">Nos Engagements</h2>
            <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
              Des actions concrètes pour un commerce plus juste et plus durable.
            </p>
            <div className="max-w-2xl mx-auto grid sm:grid-cols-2 gap-4">
              {commitments.map((c, i) => (
                <div key={i} className="flex items-start gap-3 bg-card rounded-xl p-4 border border-border">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-foreground font-medium text-sm">{c}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 md:py-20 bg-gradient-to-r from-primary to-primary/80">
          <div className="container mx-auto px-4 text-center">
            <Globe2 className="w-12 h-12 text-primary-foreground mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-primary-foreground mb-4">Ensemble, construisons un avenir meilleur</h2>
            <p className="text-primary-foreground/80 mb-8 max-w-lg mx-auto">
              Vous partagez notre vision ? Rejoignez la communauté Zandofy en tant que vendeur, acheteur ou partenaire.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a href="/become-vendor"
                className="inline-flex items-center gap-2 bg-primary-foreground text-primary px-8 py-3 rounded-full font-semibold hover:opacity-90 transition-opacity">
                Devenir Vendeur <ArrowRight className="w-5 h-5" />
              </a>
              <a href="/auth"
                className="inline-flex items-center gap-2 border-2 border-primary-foreground text-primary-foreground px-8 py-3 rounded-full font-semibold hover:bg-primary-foreground/10 transition-colors">
                Créer un Compte <ArrowRight className="w-5 h-5" />
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
