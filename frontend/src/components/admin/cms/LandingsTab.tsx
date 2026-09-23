import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Save, Trash2, LayoutTemplate } from "lucide-react";
import {
  BECOME_VENDOR_SEED,
  DISCOVER_SEED,
  sanitizeCmsText,
  type CmsLandingDocument,
  type CmsLandingKey,
  type LandingFaqItem,
  type LandingLocaleContent,
  type LandingTextItem,
} from "@/lib/cms-marketing-landings";

const PAGES: { key: CmsLandingKey; label: string; seed: CmsLandingDocument }[] = [
  { key: "cms_discover", label: "Découvrir Zandofy", seed: DISCOVER_SEED },
  { key: "cms_become_vendor_landing", label: "Devenir vendeur", seed: BECOME_VENDOR_SEED },
];

function ensureDoc(raw: unknown, seed: CmsLandingDocument): CmsLandingDocument {
  if (!raw || typeof raw !== "object") return structuredClone(seed);
  const r = raw as Record<string, unknown>;
  return {
    fr: mergePartialLocale(r.fr, seed.fr),
    en: mergePartialLocale(r.en, seed.en),
  };
}

function mergePartialLocale(raw: unknown, seed: LandingLocaleContent): LandingLocaleContent {
  if (!raw || typeof raw !== "object") return structuredClone(seed);
  const c = raw as Record<string, any>;
  return {
    seo: { ...seed.seo, ...(c.seo || {}) },
    hero: { ...seed.hero, ...(c.hero || {}) },
    why: { ...seed.why, ...(c.why || {}) },
    benefits: Array.isArray(c.benefits) ? c.benefits : structuredClone(seed.benefits),
    how: { ...seed.how, ...(c.how || {}) },
    steps: Array.isArray(c.steps) ? c.steps : structuredClone(seed.steps),
    trust: {
      title: c.trust?.title ?? seed.trust.title,
      subtitle: c.trust?.subtitle ?? seed.trust.subtitle,
      items: Array.isArray(c.trust?.items) ? c.trust.items : structuredClone(seed.trust.items),
    },
    faq: {
      title: c.faq?.title ?? seed.faq.title,
      items: Array.isArray(c.faq?.items) ? c.faq.items : structuredClone(seed.faq.items),
      moreLabel: c.faq?.moreLabel ?? seed.faq.moreLabel,
    },
    final: { ...seed.final, ...(c.final || {}) },
    sections: { ...seed.sections, ...(c.sections || {}) },
  };
}

/** Normalize locale content before persist (strip tags, cap length). */
function sanitizeLocale(locale: LandingLocaleContent): LandingLocaleContent {
  const s = (v: string) => sanitizeCmsText(v || "");
  return {
    seo: { title: s(locale.seo.title), description: s(locale.seo.description) },
    hero: {
      eyebrow: s(locale.hero.eyebrow),
      title: s(locale.hero.title),
      highlight: s(locale.hero.highlight),
      subtitle: s(locale.hero.subtitle),
      ctaPrimary: s(locale.hero.ctaPrimary),
      ctaSecondary: s(locale.hero.ctaSecondary),
    },
    why: { title: s(locale.why.title), subtitle: s(locale.why.subtitle) },
    benefits: (locale.benefits || []).map((b) => ({ title: s(b.title), desc: s(b.desc) })),
    how: { title: s(locale.how.title), subtitle: s(locale.how.subtitle) },
    steps: (locale.steps || []).map((b) => ({ title: s(b.title), desc: s(b.desc) })),
    trust: {
      title: s(locale.trust.title),
      subtitle: s(locale.trust.subtitle),
      items: (locale.trust.items || []).map((b) => ({ title: s(b.title), desc: s(b.desc) })),
    },
    faq: {
      title: s(locale.faq.title),
      moreLabel: s(locale.faq.moreLabel),
      items: (locale.faq.items || []).map((f) => ({ q: s(f.q), a: s(f.a) })),
    },
    final: {
      title: s(locale.final.title),
      subtitle: s(locale.final.subtitle),
      ctaPrimary: s(locale.final.ctaPrimary),
      ctaSecondary: s(locale.final.ctaSecondary),
    },
    sections: {
      why: Boolean(locale.sections.why),
      how: Boolean(locale.sections.how),
      trust: Boolean(locale.sections.trust),
      faq: Boolean(locale.sections.faq),
      final: Boolean(locale.sections.final),
    },
  };
}

function Field({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {multiline ? (
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className="text-sm" />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="text-sm" />
      )}
    </div>
  );
}

function TextItemsEditor({
  label,
  items,
  onChange,
}: {
  label: string;
  items: LandingTextItem[];
  onChange: (items: LandingTextItem[]) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">{label}</h4>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...items, { title: "", desc: "" }])}
        >
          <Plus size={14} className="mr-1" /> Ajouter
        </Button>
      </div>
      {items.map((item, i) => (
        <div key={i} className="border border-border rounded-lg p-3 space-y-2 relative">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute top-1 right-1 text-destructive"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            <Trash2 size={14} />
          </Button>
          <Field label="Titre" value={item.title} onChange={(v) => {
            const next = [...items];
            next[i] = { ...next[i], title: v };
            onChange(next);
          }} />
          <Field label="Description" value={item.desc} multiline onChange={(v) => {
            const next = [...items];
            next[i] = { ...next[i], desc: v };
            onChange(next);
          }} />
        </div>
      ))}
    </div>
  );
}

function FaqEditor({
  items,
  onChange,
}: {
  items: LandingFaqItem[];
  onChange: (items: LandingFaqItem[]) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">FAQ</h4>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...items, { q: "", a: "" }])}
        >
          <Plus size={14} className="mr-1" /> Ajouter
        </Button>
      </div>
      {items.map((item, i) => (
        <div key={i} className="border border-border rounded-lg p-3 space-y-2 relative">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute top-1 right-1 text-destructive"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            <Trash2 size={14} />
          </Button>
          <Field label="Question" value={item.q} onChange={(v) => {
            const next = [...items];
            next[i] = { ...next[i], q: v };
            onChange(next);
          }} />
          <Field label="Réponse" value={item.a} multiline onChange={(v) => {
            const next = [...items];
            next[i] = { ...next[i], a: v };
            onChange(next);
          }} />
        </div>
      ))}
    </div>
  );
}

function LocaleEditor({
  locale,
  onChange,
  showTrust,
}: {
  locale: LandingLocaleContent;
  onChange: (next: LandingLocaleContent) => void;
  showTrust: boolean;
}) {
  const set = <K extends keyof LandingLocaleContent>(key: K, value: LandingLocaleContent[K]) => {
    onChange({ ...locale, [key]: value });
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">SEO</h3>
        <Field label="Title" value={locale.seo.title} onChange={(v) => set("seo", { ...locale.seo, title: v })} />
        <Field
          label="Description"
          value={locale.seo.description}
          multiline
          onChange={(v) => set("seo", { ...locale.seo, description: v })}
        />
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Hero</h3>
        <Field label="Eyebrow" value={locale.hero.eyebrow} onChange={(v) => set("hero", { ...locale.hero, eyebrow: v })} />
        <Field label="Titre" value={locale.hero.title} onChange={(v) => set("hero", { ...locale.hero, title: v })} />
        <Field label="Highlight" value={locale.hero.highlight} onChange={(v) => set("hero", { ...locale.hero, highlight: v })} />
        <Field label="Sous-titre" value={locale.hero.subtitle} multiline onChange={(v) => set("hero", { ...locale.hero, subtitle: v })} />
        <Field label="CTA primaire" value={locale.hero.ctaPrimary} onChange={(v) => set("hero", { ...locale.hero, ctaPrimary: v })} />
        <Field label="CTA secondaire" value={locale.hero.ctaSecondary} onChange={(v) => set("hero", { ...locale.hero, ctaSecondary: v })} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Pourquoi</h3>
          <div className="flex items-center gap-2">
            <Switch
              checked={locale.sections.why}
              onCheckedChange={(v) => set("sections", { ...locale.sections, why: v })}
            />
            <span className="text-xs text-muted-foreground">Visible</span>
          </div>
        </div>
        <Field label="Titre" value={locale.why.title} onChange={(v) => set("why", { ...locale.why, title: v })} />
        <Field label="Sous-titre" value={locale.why.subtitle} multiline onChange={(v) => set("why", { ...locale.why, subtitle: v })} />
        <TextItemsEditor label="Bénéfices" items={locale.benefits} onChange={(benefits) => set("benefits", benefits)} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Comment</h3>
          <div className="flex items-center gap-2">
            <Switch
              checked={locale.sections.how}
              onCheckedChange={(v) => set("sections", { ...locale.sections, how: v })}
            />
            <span className="text-xs text-muted-foreground">Visible</span>
          </div>
        </div>
        <Field label="Titre" value={locale.how.title} onChange={(v) => set("how", { ...locale.how, title: v })} />
        <Field label="Sous-titre" value={locale.how.subtitle} multiline onChange={(v) => set("how", { ...locale.how, subtitle: v })} />
        <TextItemsEditor label="Étapes" items={locale.steps} onChange={(steps) => set("steps", steps)} />
      </section>

      {showTrust && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Confiance</h3>
            <div className="flex items-center gap-2">
              <Switch
                checked={locale.sections.trust}
                onCheckedChange={(v) => set("sections", { ...locale.sections, trust: v })}
              />
              <span className="text-xs text-muted-foreground">Visible</span>
            </div>
          </div>
          <Field label="Titre" value={locale.trust.title} onChange={(v) => set("trust", { ...locale.trust, title: v })} />
          <Field label="Sous-titre" value={locale.trust.subtitle} multiline onChange={(v) => set("trust", { ...locale.trust, subtitle: v })} />
          <TextItemsEditor
            label="Items"
            items={locale.trust.items}
            onChange={(items) => set("trust", { ...locale.trust, items })}
          />
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">FAQ</h3>
          <div className="flex items-center gap-2">
            <Switch
              checked={locale.sections.faq}
              onCheckedChange={(v) => set("sections", { ...locale.sections, faq: v })}
            />
            <span className="text-xs text-muted-foreground">Visible</span>
          </div>
        </div>
        <Field label="Titre section" value={locale.faq.title} onChange={(v) => set("faq", { ...locale.faq, title: v })} />
        <Field label="Lien FAQ (optionnel)" value={locale.faq.moreLabel} onChange={(v) => set("faq", { ...locale.faq, moreLabel: v })} />
        <FaqEditor items={locale.faq.items} onChange={(items) => set("faq", { ...locale.faq, items })} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Bandeau final</h3>
          <div className="flex items-center gap-2">
            <Switch
              checked={locale.sections.final}
              onCheckedChange={(v) => set("sections", { ...locale.sections, final: v })}
            />
            <span className="text-xs text-muted-foreground">Visible</span>
          </div>
        </div>
        <Field label="Titre" value={locale.final.title} onChange={(v) => set("final", { ...locale.final, title: v })} />
        <Field label="Sous-titre" value={locale.final.subtitle} multiline onChange={(v) => set("final", { ...locale.final, subtitle: v })} />
        <Field label="CTA primaire" value={locale.final.ctaPrimary} onChange={(v) => set("final", { ...locale.final, ctaPrimary: v })} />
        <Field label="CTA secondaire" value={locale.final.ctaSecondary} onChange={(v) => set("final", { ...locale.final, ctaSecondary: v })} />
      </section>
    </div>
  );
}

export default function LandingsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedPage, setSelectedPage] = useState<CmsLandingKey>("cms_discover");
  const [pagesData, setPagesData] = useState<Record<string, CmsLandingDocument>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("key, value")
        .in(
          "key",
          PAGES.map((p) => p.key)
        );
      if (cancelled) return;
      if (error) {
        toast({ title: "Erreur chargement", description: error.message, variant: "destructive" });
      }
      const map: Record<string, CmsLandingDocument> = {};
      for (const page of PAGES) {
        const row = data?.find((r) => r.key === page.key);
        map[page.key] = ensureDoc(row?.value, page.seed);
      }
      setPagesData(map);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const currentMeta = PAGES.find((p) => p.key === selectedPage)!;
  const current = pagesData[selectedPage] ?? ensureDoc(null, currentMeta.seed);

  const handleSave = async () => {
    setSaving(true);
    const raw = pagesData[selectedPage] ?? ensureDoc(null, currentMeta.seed);
    const payload: CmsLandingDocument = {
      fr: sanitizeLocale(raw.fr),
      en: sanitizeLocale(raw.en),
    };
    const { error } = await supabase.from("platform_settings").upsert(
      {
        key: selectedPage,
        value: payload as any,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      setPagesData((prev) => ({ ...prev, [selectedPage]: payload }));
      await queryClient.invalidateQueries({ queryKey: ["cms-marketing-landing", selectedPage] });
      toast({ title: "Landing enregistrée" });
    }
    setSaving(false);
  };

  const updateLocale = (lang: "fr" | "en", locale: LandingLocaleContent) => {
    setPagesData((prev) => {
      const base = prev[selectedPage] ?? ensureDoc(null, currentMeta.seed);
      return {
        ...prev,
        [selectedPage]: {
          ...base,
          [lang]: locale,
        },
      };
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-primary" size={20} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LayoutTemplate size={16} />
          Landings marketing (FR / EN) — hors wizard candidature
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Save size={14} className="mr-1" />}
          Enregistrer
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {PAGES.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setSelectedPage(p.key)}
            className={`px-3 py-1.5 text-sm rounded-full border ${
              selectedPage === p.key
                ? "bg-foreground text-card border-foreground"
                : "bg-card border-border hover:border-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <Tabs defaultValue="fr">
        <TabsList>
          <TabsTrigger value="fr">Français</TabsTrigger>
          <TabsTrigger value="en">English</TabsTrigger>
        </TabsList>
        <TabsContent value="fr" className="mt-4">
          <LocaleEditor
            locale={current.fr}
            showTrust={selectedPage === "cms_discover"}
            onChange={(locale) => updateLocale("fr", locale)}
          />
        </TabsContent>
        <TabsContent value="en" className="mt-4">
          <LocaleEditor
            locale={current.en}
            showTrust={selectedPage === "cms_discover"}
            onChange={(locale) => updateLocale("en", locale)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
