import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useI18n } from "@/contexts/I18nContext";
import { Briefcase, Globe2, Heart, Rocket, Users, Zap, ArrowRight, CheckCircle2, MapPin, Clock } from "lucide-react";
import { Link } from "react-router-dom";

const values = [
  { icon: Rocket, title: "Innovation", desc: "Nous repoussons les limites du e-commerce africain avec des solutions technologiques de pointe." },
  { icon: Globe2, title: "Impact global", desc: "Nous connectons les marchés mondiaux à l'Afrique, créant des opportunités pour tous." },
  { icon: Heart, title: "Bienveillance", desc: "Nous cultivons un environnement de travail respectueux, inclusif et stimulant." },
  { icon: Users, title: "Esprit d'équipe", desc: "Le succès se construit ensemble. Collaboration et entraide sont notre ADN." },
];

const benefits = [
  "Travail flexible et télétravail possible",
  "Formation continue et développement professionnel",
  "Environnement multiculturel et dynamique",
  "Participation à un projet à impact social fort",
  "Rémunération compétitive et avantages sociaux",
  "Opportunités d'évolution rapide",
];

const openings = [
  { title: "Développeur Full-Stack", department: "Technologie", location: "Kinshasa / Remote", type: "CDI" },
  { title: "Responsable Marketing Digital", department: "Marketing", location: "Kinshasa", type: "CDI" },
  { title: "Chargé(e) Logistique", department: "Opérations", location: "Kinshasa", type: "CDI" },
  { title: "Community Manager", department: "Communication", location: "Remote", type: "CDD" },
  { title: "Analyste Données", department: "Data", location: "Kinshasa / Remote", type: "CDI" },
];

export default function CareersPage() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-accent/10 to-secondary/20 py-20 md:py-28">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,hsl(var(--primary)/0.08),transparent_60%)]" />
          <div className="container mx-auto px-4 relative z-10 text-center max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-6">
              <Briefcase className="w-4 h-4" />
              Rejoignez l'aventure Zandofy
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-foreground mb-6 leading-tight">
              Construisez le futur du <span className="text-primary">commerce en Afrique</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Zandofy est une plateforme e-commerce en pleine croissance qui connecte l'Afrique au monde.
              Rejoignez une équipe passionnée et contribuez à transformer le commerce digital sur le continent.
            </p>
            <a href="#openings" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-8 py-3 rounded-full font-semibold hover:opacity-90 transition-opacity text-lg shadow-lg">
              Voir les postes ouverts <ArrowRight className="w-5 h-5" />
            </a>
          </div>
        </section>

        {/* Values */}
        <section className="py-16 md:py-20 container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-foreground mb-4">Nos Valeurs</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
            Ce qui nous anime au quotidien et guide toutes nos décisions.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((v, i) => (
              <div key={i} className="bg-card rounded-2xl p-6 border border-border hover:shadow-lg transition-shadow text-center">
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <v.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="font-bold text-foreground text-lg mb-2">{v.title}</h3>
                <p className="text-muted-foreground text-sm">{v.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Benefits */}
        <section className="py-16 md:py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold text-center text-foreground mb-4">Pourquoi travailler chez Zandofy ?</h2>
            <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
              Nous investissons dans le bien-être et le développement de chaque membre de l'équipe.
            </p>
            <div className="max-w-2xl mx-auto grid sm:grid-cols-2 gap-4">
              {benefits.map((b, i) => (
                <div key={i} className="flex items-start gap-3 bg-card rounded-xl p-4 border border-border">
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <span className="text-foreground font-medium text-sm">{b}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Open positions */}
        <section id="openings" className="py-16 md:py-20 container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-foreground mb-4">Postes Ouverts</h2>
          <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
            Découvrez nos opportunités actuelles et trouvez le rôle qui vous correspond.
          </p>
          <div className="max-w-3xl mx-auto space-y-4">
            {openings.map((job, i) => (
              <div key={i} className="bg-card rounded-2xl p-6 border border-border hover:shadow-md transition-shadow flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                  <h3 className="font-bold text-foreground text-lg">{job.title}</h3>
                  <p className="text-muted-foreground text-sm">{job.department}</p>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{job.location}</span>
                  <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{job.type}</span>
                </div>
                <a href={`mailto:careers@zandofy.com?subject=Candidature : ${job.title}`}
                  className="inline-flex items-center gap-1 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-semibold hover:bg-primary/20 transition-colors whitespace-nowrap">
                  Postuler <ArrowRight className="w-4 h-4" />
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 md:py-20 bg-gradient-to-r from-primary to-primary/80">
          <div className="container mx-auto px-4 text-center">
            <Zap className="w-12 h-12 text-primary-foreground mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-primary-foreground mb-4">Vous ne trouvez pas le poste idéal ?</h2>
            <p className="text-primary-foreground/80 mb-8 max-w-lg mx-auto">
              Envoyez-nous une candidature spontanée ! Nous sommes toujours à la recherche de talents passionnés.
            </p>
            <a href="mailto:careers@zandofy.com?subject=Candidature spontanée"
              className="inline-flex items-center gap-2 bg-primary-foreground text-primary px-8 py-3 rounded-full font-semibold hover:opacity-90 transition-opacity text-lg">
              Candidature spontanée <ArrowRight className="w-5 h-5" />
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
