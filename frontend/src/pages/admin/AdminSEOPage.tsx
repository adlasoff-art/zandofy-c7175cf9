import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Globe, Search, Save, Loader2, Store, Package, Tag, AlertTriangle } from "lucide-react";

interface SeoConfig {
  site_title: string;
  site_description: string;
  default_keywords: string[];
}

export default function AdminSEOPage() {
  const [seoEnabled, setSeoEnabled] = useState(false);
  const [seoConfig, setSeoConfig] = useState<SeoConfig>({
    site_title: "Zandofy",
    site_description: "La marketplace africaine",
    default_keywords: ["marketplace", "afrique", "shopping", "mode"],
  });
  const [keywordsInput, setKeywordsInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    supabase
      .from("platform_settings")
      .select("key, value")
      .in("key", ["seo_enabled", "seo_config"])
      .then(({ data }) => {
        data?.forEach((row) => {
          if (row.key === "seo_enabled") {
            setSeoEnabled(row.value === true);
          } else if (row.key === "seo_config") {
            const v = row.value as any;
            setSeoConfig({
              site_title: v.site_title || "Zandofy",
              site_description: v.site_description || "",
              default_keywords: v.default_keywords || [],
            });
            setKeywordsInput((v.default_keywords || []).join(", "));
          }
        });
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const now = new Date().toISOString();
    const keywords = keywordsInput.split(",").map((k) => k.trim()).filter(Boolean);

    const [r1, r2] = await Promise.all([
      supabase.from("platform_settings").upsert(
        { key: "seo_enabled", value: seoEnabled as any, updated_at: now },
        { onConflict: "key" }
      ),
      supabase.from("platform_settings").upsert(
        {
          key: "seo_config",
          value: { ...seoConfig, default_keywords: keywords } as any,
          updated_at: now,
        },
        { onConflict: "key" }
      ),
    ]);

    if (r1.error || r2.error) {
      toast({ title: "Erreur", description: (r1.error || r2.error)?.message, variant: "destructive" });
    } else {
      toast({ title: "SEO mis à jour", description: seoEnabled ? "Le référencement est activé." : "Le référencement reste désactivé." });
    }
    setSaving(false);
  };

  const inputClass = "w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20";

  if (loading) {
    return (
      <AdminLayout title="Référencement (SEO)">
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Référencement (SEO)">
      <div className="space-y-6 max-w-2xl">
        {/* Master toggle */}
        <section className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Globe size={18} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Contrôle global du SEO</h2>
          </div>

          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
            <div>
              <p className="text-sm font-medium text-foreground">Activer le référencement</p>
              <p className="text-xs text-muted-foreground">
                {seoEnabled
                  ? "Le site est indexable par les moteurs de recherche"
                  : "Le site est masqué des moteurs de recherche (noindex, nofollow)"}
              </p>
            </div>
            <Switch checked={seoEnabled} onCheckedChange={setSeoEnabled} />
          </div>

          {!seoEnabled && (
            <div className="flex items-start gap-2 mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Mode privé actif</p>
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  Les moteurs de recherche ne peuvent pas indexer le site. Activez le SEO quand vous êtes prêt pour le lancement.
                </p>
              </div>
            </div>
          )}
        </section>

        {/* Global SEO Config */}
        <section className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Search size={18} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Métadonnées globales</h2>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Titre du site (balise title)</label>
              <input
                value={seoConfig.site_title}
                onChange={(e) => setSeoConfig((p) => ({ ...p, site_title: e.target.value }))}
                maxLength={60}
                className={inputClass}
              />
              <p className="text-[10px] text-muted-foreground mt-1">{seoConfig.site_title.length}/60 caractères</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Description (meta description)</label>
              <textarea
                value={seoConfig.site_description}
                onChange={(e) => setSeoConfig((p) => ({ ...p, site_description: e.target.value }))}
                maxLength={160}
                rows={3}
                className={inputClass}
              />
              <p className="text-[10px] text-muted-foreground mt-1">{seoConfig.site_description.length}/160 caractères</p>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                <Tag size={12} className="inline mr-1" />
                Mots-clés par défaut (séparés par des virgules)
              </label>
              <input
                value={keywordsInput}
                onChange={(e) => setKeywordsInput(e.target.value)}
                placeholder="marketplace, mode, afrique, shopping"
                className={inputClass}
              />
              <div className="flex flex-wrap gap-1 mt-2">
                {keywordsInput.split(",").map((k) => k.trim()).filter(Boolean).map((k, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    {k}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Info about store/product SEO */}
        <section className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Store size={18} className="text-primary" />
            <h2 className="text-sm font-semibold text-foreground">SEO des boutiques & produits</h2>
          </div>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
              <Store size={16} className="text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Boutiques</p>
                <p className="text-xs">Les vendeurs peuvent définir un titre SEO, une meta description et des mots-clés pour leur boutique depuis leur tableau de bord.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
              <Package size={16} className="text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground">Produits</p>
                <p className="text-xs">Chaque produit dispose de champs SEO (titre, description, mots-clés) éditables par le vendeur lors de la création ou modification du produit.</p>
              </div>
            </div>
          </div>
        </section>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Enregistrer les paramètres SEO
        </button>
      </div>
    </AdminLayout>
  );
}
