import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Save, Loader2, Plus, Trash2, Languages } from "lucide-react";

interface TextEntry {
  key: string;
  label: string;
  fr: string;
  en: string;
}

const DEFAULT_TEXTS: TextEntry[] = [
  { key: "site.name", label: "Site — Nom du site", fr: "Zandofy", en: "Zandofy" },
  { key: "site.title", label: "Site — Titre (partage & SEO)", fr: "Zandofy — Mode Élégante & Accessible", en: "Zandofy — Elegant & Affordable Fashion" },
  { key: "site.description", label: "Site — Description (partage & SEO)", fr: "Découvrez Zandofy : mode premium à prix accessibles. Robes, hauts, accessoires et plus. Expédition et Livraison rapide en Afrique.", en: "Discover Zandofy: premium fashion at accessible prices. Dresses, tops, accessories and more. Fast shipping across Africa." },
  { key: "footer.copyright", label: "Footer — Copyright", fr: "© {year} Zandofy. Tous droits réservés.", en: "© {year} Zandofy. All rights reserved." },
  { key: "topbar.freeShipping", label: "Top bar — Livraison", fr: "🚚 Livraison Gratuite *Conditions applicables", en: "🚚 Free Shipping *Conditions apply" },
  { key: "topbar.freeReturns", label: "Top bar — Retours", fr: "↩️ Retours Gratuits Sur toutes les commandes", en: "↩️ Free Returns On all orders" },
  { key: "topbar.noHiddenFees", label: "Top bar — Frais", fr: "🔒 Aucun Frais Caché FAQ Prix & Tarifs", en: "🔒 No Hidden Fees FAQ Pricing" },
  { key: "footer.description", label: "Footer — Description", fr: "E-commerce généraliste proposant mode, électronique, maison et bien plus.", en: "General e-commerce offering fashion, electronics, home and more." },
  { key: "footer.newsletter_cta", label: "Footer — Newsletter CTA", fr: "Inscrivez-vous à notre newsletter", en: "Subscribe to our newsletter" },
  { key: "home.hero_title", label: "Accueil — Titre hero", fr: "Découvrez les meilleures offres", en: "Discover the best deals" },
  { key: "home.hero_subtitle", label: "Accueil — Sous-titre hero", fr: "Des milliers de produits à prix réduit", en: "Thousands of products at reduced prices" },
];

export default function TextsTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [texts, setTexts] = useState<TextEntry[]>(DEFAULT_TEXTS);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "cms_texts")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value && Array.isArray(data.value)) {
          setTexts(data.value as unknown as TextEntry[]);
        }
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("platform_settings").upsert(
      { key: "cms_texts", value: texts as any, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Textes enregistrés" });
    }
    setSaving(false);
  };

  const updateText = (index: number, field: "fr" | "en" | "label" | "key", value: string) => {
    setTexts((prev) => prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)));
  };

  const addText = () => {
    setTexts((prev) => [...prev, { key: `custom.text_${Date.now()}`, label: "Nouveau texte", fr: "", en: "" }]);
  };

  const removeText = (index: number) => {
    setTexts((prev) => prev.filter((_, i) => i !== index));
  };

  const filtered = texts.filter(
    (t) =>
      !filter ||
      t.label.toLowerCase().includes(filter.toLowerCase()) ||
      t.key.toLowerCase().includes(filter.toLowerCase())
  );

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">Éditez les textes de la plateforme en français et anglais.</p>
        <div className="flex gap-2">
          <Input
            placeholder="Filtrer…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-9 w-48 text-sm"
          />
          <Button size="sm" variant="outline" onClick={addText} className="gap-1.5">
            <Plus size={14} /> Ajouter
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((entry, idx) => {
          const realIdx = texts.indexOf(entry);
          return (
            <div key={entry.key} className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Languages size={14} className="text-muted-foreground" />
                  <Input
                    value={entry.label}
                    onChange={(e) => updateText(realIdx, "label", e.target.value)}
                    className="h-7 text-xs font-semibold border-none bg-transparent p-0 w-auto"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground font-mono">{entry.key}</span>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeText(realIdx)}>
                    <Trash2 size={12} className="text-destructive" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] font-medium text-muted-foreground">🇫🇷 Français</span>
                  <Textarea
                    value={entry.fr}
                    onChange={(e) => updateText(realIdx, "fr", e.target.value)}
                    rows={2}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-medium text-muted-foreground">🇬🇧 English</span>
                  <Textarea
                    value={entry.en}
                    onChange={(e) => updateText(realIdx, "en", e.target.value)}
                    rows={2}
                    className="text-sm"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Button onClick={handleSave} disabled={saving} className="gap-2">
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        Enregistrer les textes
      </Button>
    </div>
  );
}
