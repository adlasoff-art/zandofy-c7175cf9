import { useState } from "react";
import { RefreshCw, ExternalLink, Loader2, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SITE_URL = "https://zandofy.com";

/**
 * Permet à l'admin de :
 * 1) Purger le cache Vercel edge du meta-injector pour forcer un nouveau snapshot.
 * 2) Ouvrir directement les outils de validation/re-scrape de Facebook, LinkedIn,
 *    Twitter et WhatsApp pour une URL donnée (produit, boutique, page).
 *
 * Cas d'usage : après un changement d'image produit, le partage WhatsApp continue
 * d'afficher l'ancien aperçu (cache Meta ~7 jours). Le bouton "Re-scrape FB"
 * force Meta à relire l'URL et met à jour le cache pour TOUS les utilisateurs.
 */
export function SeoSocialRescrapeSection() {
  const [path, setPath] = useState("/product/");
  const [purging, setPurging] = useState(false);
  const [purged, setPurged] = useState(false);
  const { toast } = useToast();

  const fullUrl = `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const encoded = encodeURIComponent(fullUrl);

  const handlePurge = async () => {
    setPurging(true);
    setPurged(false);
    try {
      // Purge le cache in-memory de l'edge function (header supporté par meta-injector.ts).
      await fetch("/api/meta-injector", {
        method: "GET",
        headers: { "x-purge-cache": "1" },
      });
      // Force Vercel à régénérer en faisant un appel direct comme un crawler.
      await fetch(fullUrl, {
        method: "GET",
        headers: { "User-Agent": "facebookexternalhit/1.1", "Cache-Control": "no-cache" },
      }).catch(() => {});
      setPurged(true);
      toast({
        title: "Cache purgé",
        description: "Les prochains scrapers verront la version la plus récente.",
      });
    } catch (e: any) {
      toast({
        title: "Erreur",
        description: e?.message || "Échec de la purge",
        variant: "destructive",
      });
    } finally {
      setPurging(false);
      setTimeout(() => setPurged(false), 3000);
    }
  };

  const tools = [
    {
      name: "Facebook & WhatsApp",
      description: "WhatsApp utilise le scraper Facebook. Force le re-scrape pour tous.",
      url: `https://developers.facebook.com/tools/debug/?q=${encoded}`,
      color: "text-[#1877F2]",
    },
    {
      name: "LinkedIn Post Inspector",
      description: "Vérifie et rafraîchit l'aperçu LinkedIn.",
      url: `https://www.linkedin.com/post-inspector/inspect/${encoded}`,
      color: "text-[#0A66C2]",
    },
    {
      name: "Twitter / X Card Validator",
      description: "Aperçu Twitter Card et debug.",
      url: `https://cards-dev.twitter.com/validator?url=${encoded}`,
      color: "text-foreground",
    },
    {
      name: "Google Rich Results",
      description: "Vérifie le balisage structuré (JSON-LD).",
      url: `https://search.google.com/test/rich-results?url=${encoded}`,
      color: "text-[#4285F4]",
    },
  ];

  return (
    <section className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <RefreshCw size={18} className="text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Aperçus réseaux sociaux & re-scrape</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Quand l'image d'un produit change, WhatsApp/Facebook gardent l'ancien aperçu en cache jusqu'à 7 jours.
        Utilise les outils ci-dessous pour forcer un nouveau scrape et mettre à jour les aperçus partout.
      </p>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium text-foreground mb-1.5 block">
            Chemin de l'URL à rafraîchir
          </label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">{SITE_URL}</span>
            <input
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/product/mon-produit-slug"
              className="flex-1 px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Ex : <code className="bg-muted px-1 rounded">/product/sac-a-dos-chic-motif-matelasse</code>
          </p>
        </div>

        <button
          onClick={handlePurge}
          disabled={purging}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {purging ? (
            <Loader2 size={14} className="animate-spin" />
          ) : purged ? (
            <Check size={14} />
          ) : (
            <RefreshCw size={14} />
          )}
          {purged ? "Cache purgé" : "Purger le cache Vercel"}
        </button>

        <div className="pt-3 border-t border-border space-y-2">
          <p className="text-xs font-medium text-foreground">Outils de re-scrape externes</p>
          {tools.map((t) => (
            <a
              key={t.name}
              href={t.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 p-3 bg-muted/30 hover:bg-muted/60 rounded-lg transition-colors group"
            >
              <ExternalLink size={14} className={`${t.color} shrink-0 mt-0.5 group-hover:translate-x-0.5 transition-transform`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{t.name}</p>
                <p className="text-[11px] text-muted-foreground">{t.description}</p>
              </div>
            </a>
          ))}
        </div>

        <div className="text-[11px] text-muted-foreground bg-muted/30 p-3 rounded-lg leading-relaxed">
          <strong className="text-foreground">Astuce :</strong> sur Facebook Debugger, clique sur
          <em> « Récupérer à nouveau »</em> (Scrape Again) une ou deux fois pour forcer la mise à jour.
          WhatsApp utilise le même cache que Facebook — un seul re-scrape suffit pour les deux.
        </div>
      </div>
    </section>
  );
}
