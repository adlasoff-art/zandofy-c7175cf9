import { useEffect, useState } from "react";
import { FolderTree, Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SeoSerpPreview } from "./SeoSerpPreview";

type CatRow = {
  id: string;
  name: string;
  name_fr: string;
  meta_title: string | null;
  meta_description: string | null;
  seo_keywords: string[] | null;
  og_image_url: string | null;
  seo_body: string | null;
  seo_faq: { question: string; answer: string }[] | null;
};

const inputClass =
  "w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20";

export function SeoCategoriesSection() {
  const [rows, setRows] = useState<CatRow[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, name_fr, meta_title, meta_description, seo_keywords, og_image_url, seo_body, seo_faq")
        .is("parent_id", null)
        .order("name_fr");
      if (error) {
        // Columns may not exist yet on staging — soft fail
        toast({
          title: "Catégories SEO",
          description: error.message.includes("meta_title") || error.message.includes("seo_body")
            ? "Exécutez d'abord les migrations categories_seo / seo_body sur Supabase."
            : error.message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      const list = (data || []) as CatRow[];
      setRows(list);
      if (list[0]) setActiveId(list[0].id);
      setLoading(false);
    })();
  }, [toast]);

  const current = rows.find((r) => r.id === activeId);

  const patch = (p: Partial<CatRow>) =>
    setRows((prev) => prev.map((r) => (r.id === activeId ? { ...r, ...p } : r)));

  const handleSave = async () => {
    if (!current) return;
    setSaving(true);
    const { error } = await supabase
      .from("categories")
      .update({
        meta_title: current.meta_title?.trim() || null,
        meta_description: current.meta_description?.trim() || null,
        seo_keywords: current.seo_keywords?.length ? current.seo_keywords : null,
        og_image_url: current.og_image_url?.trim() || null,
        seo_body: current.seo_body?.trim() || null,
        seo_faq: current.seo_faq?.length ? current.seo_faq : null,
      } as any)
      .eq("id", current.id);
    setSaving(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Catégorie SEO enregistrée" });
    try {
      await fetch("/api/meta-injector", { method: "GET", headers: { "x-purge-cache": "1" } });
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="animate-spin text-primary" size={20} />
      </div>
    );
  }

  if (!rows.length) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucune catégorie racine, ou migration SEO non appliquée.
      </p>
    );
  }

  return (
    <section className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <FolderTree size={18} className="text-primary" />
        <h2 className="text-sm font-semibold text-foreground">SEO par catégorie</h2>
      </div>
      <select
        value={activeId}
        onChange={(e) => setActiveId(e.target.value)}
        className={inputClass}
      >
        {rows.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name_fr || r.name}
            {r.meta_title ? " ✓" : ""}
          </option>
        ))}
      </select>
      {current && (
        <>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              Titre SEO ({(current.meta_title || "").length}/60)
            </label>
            <input
              value={current.meta_title || ""}
              onChange={(e) => patch({ meta_title: e.target.value })}
              maxLength={70}
              className={inputClass}
              placeholder="Vide = template global"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              Description ({(current.meta_description || "").length}/160)
            </label>
            <textarea
              value={current.meta_description || ""}
              onChange={(e) => patch({ meta_description: e.target.value })}
              maxLength={180}
              rows={3}
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              Texte SEO long ({(current.seo_body || "").length} car. — cible 300–500 mots)
            </label>
            <textarea
              value={current.seo_body || ""}
              onChange={(e) => patch({ seo_body: e.target.value })}
              rows={8}
              className={inputClass}
              placeholder="Contenu éditorial réel pour la catégorie (pas de texte inventé). Visible bots + page."
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              FAQ JSON (réelles uniquement) — [{`{"question","answer"}`}, …]
            </label>
            <textarea
              value={JSON.stringify(current.seo_faq || [], null, 2)}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value || "[]");
                  if (Array.isArray(parsed)) patch({ seo_faq: parsed });
                } catch {
                  /* keep typing invalid JSON until blur/save */
                }
              }}
              rows={5}
              className={`${inputClass} font-mono text-xs`}
              placeholder='[{"question":"…","answer":"…"}]'
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">OG image URL</label>
            <input
              value={current.og_image_url || ""}
              onChange={(e) => patch({ og_image_url: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Mots-clés (virgules)</label>
            <input
              value={(current.seo_keywords || []).join(", ")}
              onChange={(e) =>
                patch({
                  seo_keywords: e.target.value
                    .split(",")
                    .map((k) => k.trim())
                    .filter(Boolean),
                })
              }
              className={inputClass}
            />
          </div>
          <SeoSerpPreview
            title={current.meta_title || `${current.name_fr || current.name} | Zandofy`}
            description={
              current.meta_description ||
              `Achetez ${current.name_fr || current.name} sur Zandofy — import Chine & livraison Afrique.`
            }
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm rounded-lg disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Enregistrer cette catégorie
          </button>
        </>
      )}
    </section>
  );
}
