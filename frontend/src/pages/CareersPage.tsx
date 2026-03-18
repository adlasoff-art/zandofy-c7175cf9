import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useI18n } from "@/contexts/I18nContext";
import { supabase } from "@/integrations/supabase/client";
import {
  Briefcase, Globe2, Heart, Rocket, Users, Zap, ArrowRight, CheckCircle2,
  MapPin, Clock, GraduationCap, CalendarDays, Megaphone, Gavel, Star,
} from "lucide-react";
import { format } from "date-fns";

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

interface JobPosting {
  id: string;
  title: string;
  department: string;
  location: string;
  contract_type: string;
  posting_type: string;
  description: string;
  requirements: string[];
  skills: string[];
  education_level: string;
  experience_years: string;
  salary_range: string | null;
  deadline: string | null;
  is_active: boolean;
}

const POSTING_TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  job_offer: { label: "Offre d'emploi", icon: Briefcase, color: "bg-primary/10 text-primary" },
  call_for_applications: { label: "Appel à candidature", icon: Megaphone, color: "bg-accent text-accent-foreground" },
  tender: { label: "Appel d'offres", icon: Gavel, color: "bg-secondary text-secondary-foreground" },
};

export default function CareersPage() {
  const { t } = useI18n();
  const [postings, setPostings] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("job_postings")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (data) setPostings(data);
      setLoading(false);
    })();
  }, []);

  const filtered = filter === "all" ? postings : postings.filter(p => p.posting_type === filter);

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
          <h2 className="text-3xl font-bold text-center text-foreground mb-4">Postes Ouverts & Appels</h2>
          <p className="text-center text-muted-foreground mb-8 max-w-xl mx-auto">
            Découvrez nos opportunités actuelles et trouvez le rôle qui vous correspond.
          </p>

          {/* Filters */}
          <div className="flex justify-center gap-2 mb-10 flex-wrap">
            {[
              { key: "all", label: "Tout" },
              { key: "job_offer", label: "Offres d'emploi" },
              { key: "call_for_applications", label: "Appels à candidature" },
              { key: "tender", label: "Appels d'offres" },
            ].map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                  filter === f.key
                    ? "bg-foreground text-card border-foreground"
                    : "bg-card text-foreground border-border hover:border-foreground"
                }`}>
                {f.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">Aucune offre disponible pour le moment.</p>
          ) : (
            <div className="max-w-4xl mx-auto space-y-5">
              {filtered.map(job => {
                const meta = POSTING_TYPE_META[job.posting_type] || POSTING_TYPE_META.job_offer;
                const TypeIcon = meta.icon;
                const isExpired = job.deadline && new Date(job.deadline) < new Date();
                const daysLeft = job.deadline ? Math.ceil((new Date(job.deadline).getTime() - Date.now()) / 86400000) : null;

                return (
                  <div key={job.id} className="bg-card rounded-2xl border border-border hover:shadow-lg transition-shadow overflow-hidden">
                    {/* Header */}
                    <div className="p-6 pb-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${meta.color}`}>
                              <TypeIcon className="w-3 h-3" /> {meta.label}
                            </span>
                            {job.contract_type && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium bg-muted text-muted-foreground px-2.5 py-1 rounded-full">
                                <Clock className="w-3 h-3" /> {job.contract_type}
                              </span>
                            )}
                            {isExpired && (
                              <span className="text-xs font-medium bg-destructive/10 text-destructive px-2.5 py-1 rounded-full">Expiré</span>
                            )}
                          </div>
                          <h3 className="font-bold text-foreground text-xl">{job.title}</h3>
                          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-1">
                            {job.department && <span>{job.department}</span>}
                            {job.location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{job.location}</span>}
                          </div>
                        </div>

                        {/* Deadline badge */}
                        {job.deadline && !isExpired && daysLeft !== null && (
                          <div className="text-center shrink-0 bg-primary/5 border border-primary/20 rounded-xl px-4 py-2">
                            <CalendarDays className="w-5 h-5 text-primary mx-auto mb-1" />
                            <div className="text-lg font-bold text-primary">{daysLeft}</div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">jours restants</div>
                          </div>
                        )}
                      </div>

                      {job.description && (
                        <p className="text-sm text-muted-foreground mt-3 line-clamp-3">{job.description}</p>
                      )}
                    </div>

                    {/* Details grid */}
                    <div className="px-6 pb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {job.education_level && (
                        <div className="flex items-center gap-2 text-sm">
                          <GraduationCap className="w-4 h-4 text-primary shrink-0" />
                          <span className="text-foreground font-medium">{job.education_level}</span>
                        </div>
                      )}
                      {job.experience_years && (
                        <div className="flex items-center gap-2 text-sm">
                          <Star className="w-4 h-4 text-primary shrink-0" />
                          <span className="text-foreground font-medium">{job.experience_years}</span>
                        </div>
                      )}
                      {job.deadline && (
                        <div className="flex items-center gap-2 text-sm">
                          <CalendarDays className="w-4 h-4 text-primary shrink-0" />
                          <span className="text-foreground font-medium">Limite : {format(new Date(job.deadline), "dd/MM/yyyy")}</span>
                        </div>
                      )}
                    </div>

                    {/* Skills */}
                    {job.skills.length > 0 && (
                      <div className="px-6 pb-4">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Compétences</p>
                        <div className="flex flex-wrap gap-1.5">
                          {job.skills.map((s, i) => (
                            <span key={i} className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Requirements */}
                    {job.requirements.length > 0 && (
                      <div className="px-6 pb-4">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Exigences</p>
                        <ul className="space-y-1">
                          {job.requirements.map((r, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                              <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                              {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* CTA */}
                    <div className="px-6 pb-6 pt-2 border-t border-border/50">
                      <a href={`mailto:careers@zandofy.com?subject=Candidature : ${job.title}`}
                        className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-full text-sm font-bold hover:opacity-90 transition-opacity">
                        Postuler <ArrowRight className="w-4 h-4" />
                      </a>
                      {job.salary_range && (
                        <span className="ml-4 text-sm text-muted-foreground">{job.salary_range}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
