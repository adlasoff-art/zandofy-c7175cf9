import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Globe2 } from "lucide-react";
import {
  listSeoOverrides,
  clearSeoOverridesCache,
  type SeoOverride,
} from "@/hooks/use-seo-overrides";
import { SeoSerpPreview } from "./SeoSerpPreview";

const KNOWN_PATHS: { path: string; label: string }[] = [
  { path: "/", label: "Accueil" },
  { path: "/stores", label: "Boutiques" },
  { path: "/pricing", label: "Tarifs" },
  { path: "/about", label: "À propos" },
  { path: "/faq", label: "FAQ" },
  { path: "/help", label: "Centre d'aide" },
  { path: "/careers", label: "Carrières" },
  { path: "/blog", label: "Blog" },
  { path: "/popular", label: "Populaires" },
  { path: "/trends", label: "Tendances" },
  { path: "/search", label: "Recherche" },
  { path: "/privacy", label: "Confidentialité" },
  { path: "/terms", label: "Conditions" },
];

const inputClass =
  "w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20";

function titleColor(len: number): string {
  if (len === 0) return "text-muted-foreground";
  if (len <= 60) return "text-emerald-600 dark:text-emerald-400";
  if (len <= 70) return "text-amber-600 dark:text-amber-400";
  return "text-destructive";
}
function descColor(len: number): string {
  if (len === 0) return "text-muted-foreground";
  if (len <= 160) return "text-emerald-600 dark:text-emerald-400";
  if (len <= 180) return "text-amber-600 dark:text-amber-400";
  return "text-destructive";
}

export function SeoPageOverridesSection() {
  const [rows, setRows] = useState<Record<string, SeoOverride>>({});
  const [activePath, setActivePath] = useState<string>("/");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    listSeoOverrides().then((list) => {
      const map: Record<string, SeoOverride> = {};
      for (const r of list) map[r.path] = r;
      setRows(map);
      setLoading(false);
    });
  }, []);

  const current: SeoOverride =
    rows[activePath] || {
      path: activePath,
      title: null,
      og_title: null,
      description: null,
      og_image: null,
      keywords: null,
      robots: "index,follow",
      jsonld_extra: null,
    };

  const update = (patch: Partial<SeoOverride>) =>
    setRows((p) => ({ ...p, [activePath]: { ...current, ...patch } }));

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      path: current.path,
      title: current.title || null,
      og_title: current.og_title || null,
      description: current.description || null,
      og_image: current.og_image || null,
      keywords:
        typeof (current as any)._kwInput === "string"
          ? (current as any)._kwInput
              .split(",")
              .map((k: string) => k.trim())
              .filter(Boolean)
          : current.keywords,
      robots: current.robots || "index,follow",
    };
    const { error } = await (supabase as any)
      .from("seo_page_overrides")
      .upsert(payload, { onConflict: "path" });
    setSaving(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    clearSeoOverridesCache();
    fetch("/api/meta-injector", { method: "GET", headers: { "x-purge-cache": "1" } }).catch(() => {});
    toast({ title: "Page SEO mise à jour", description: current.path });
  };

  if (loading) {
    return (
      <section className="bg-card border border-border rounded-xl p-5">
        <Loader2 className="animate-spin text-primary" size={20} />
      </section>
    );
  }

  const titleLen = (current.title || "").length;
  const descLen = (current.description || "").length;
  const ogTitleLen = (current.og_title || "").length;
  const isIndexable = (current.robots || "index,follow").startsWith("index");

  return (
    <section className="bg-card border border-border rounded-xl p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Globe2 size={18} className="text-primary" />
        <h2 className="text-sm font-semibold text-foreground">SEO par page</h2>
        <span className="ml-auto text-[10px] text-muted-foreground">
          Override le SEO global pour chaque route publique.
        </span>
      </div>

      {/* Path selector */}
      <div className="flex flex-wrap gap-2">
        {KNOWN_PATHS.map((p) => {
          const has = !!rows[p.path]?.title;
          const active = p.path === activePath;
          return (
            <button
              key={p.path}
              onClick={() => setActivePath(p.path)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted border-border text-foreground hover:border-primary/40"
              }`}
            >
              {p.label}
              {has && <span className="ml-1.5 text-[9px] opacity-70">●</span>}
            </button>
          );
        })}
      </div>

      {/* Editor */}
      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-foreground flex items-center justify-between">
            <span>Titre Google (≤ 60 car.)</span>
            <span className={`text-[10px] tabular-nums ${titleColor(titleLen)}`}>
              {titleLen}/60
            </span>
          </label>
          <input
            value={current.title || ""}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="Ex: Boutiques vérifiées — Zandofy"
            className={inputClass}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-foreground flex items-center justify-between">
            <span>Titre Open Graph (réseaux sociaux, optionnel)</span>
            <span className={`text-[10px] tabular-nums ${titleColor(ogTitleLen)}`}>
              {ogTitleLen}/95
            </span>
          </label>
          <input
            value={current.og_title || ""}
            onChange={(e) => update({ og_title: e.target.value })}
            placeholder="Titre plus long pour Facebook / LinkedIn"
            className={inputClass}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-foreground flex items-center justify-between">
            <span>Description (≤ 160 car.)</span>
            <span className={`text-[10px] tabular-nums ${descColor(descLen)}`}>
              {descLen}/160
            </span>
          </label>
          <textarea
            value={current.description || ""}
            onChange={(e) => update({ description: e.target.value })}
            rows={3}
            className={inputClass}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-foreground">Image Open Graph (URL)</label>
          <input
            value={current.og_image || ""}
            onChange={(e) => update({ og_image: e.target.value })}
            placeholder="https://..."
            className={inputClass}
          />
        </div>

        <div>
          <label className="text-xs font-medium text-foreground">
            Mots-clés (séparés par virgules)
          </label>
          <input
            defaultValue={(current.keywords || []).join(", ")}
            onChange={(e) => update({ ...(current as any), _kwInput: e.target.value } as any)}
            placeholder="acheter en chine, marketplace afrique, ..."
            className={inputClass}
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={isIndexable}
              onChange={(e) =>
                update({ robots: e.target.checked ? "index,follow" : "noindex,nofollow" })
              }
            />
            Indexable par Google
          </label>
          <span className="text-[10px] text-muted-foreground">{current.robots}</span>
        </div>

        <SeoSerpPreview
          title={current.title || ""}
          description={current.description || ""}
          url={`https://zandofy.com${current.path}`}
        />

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Enregistrer cette page
        </button>
      </div>
    </section>
  );
}
