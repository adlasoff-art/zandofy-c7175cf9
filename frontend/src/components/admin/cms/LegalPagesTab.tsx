import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Save, Loader2, Plus, Trash2, FileText } from "lucide-react";

interface Section {
  title: string;
  content: string;
}

interface PageData {
  fr: Section[];
  en: Section[];
}

const PAGES = [
  { key: "cms_faq", label: "FAQ (Centre d'aide)", isFaq: true },
  { key: "cms_privacy", label: "Politique de Confidentialité" },
  { key: "cms_terms", label: "Conditions Générales" },
  { key: "cms_about", label: "À Propos" },
];

export default function LegalPagesTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedPage, setSelectedPage] = useState("cms_faq");
  const [pagesData, setPagesData] = useState<Record<string, any>>({});

  useEffect(() => {
    supabase
      .from("platform_settings")
      .select("key, value")
      .in("key", PAGES.map((p) => p.key))
      .then(({ data }) => {
        const map: Record<string, any> = {};
        data?.forEach((row) => {
          map[row.key] = row.value;
        });
        setPagesData(map);
        setLoading(false);
      });
  }, []);

  const currentPage = PAGES.find((p) => p.key === selectedPage)!;
  const currentData = pagesData[selectedPage];

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("platform_settings").upsert(
      { key: selectedPage, value: pagesData[selectedPage] as any, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Page enregistrée" });
    }
    setSaving(false);
  };

  const updateSection = (lang: "fr" | "en", index: number, field: "title" | "content" | "q" | "a", value: string) => {
    setPagesData((prev) => {
      const data = { ...prev };
      const pageData = data[selectedPage] ? { ...data[selectedPage] } : { fr: [], en: [] };

      if (currentPage.isFaq) {
        // FAQ has categories with items
        const cats = [...(pageData[lang] || [])];
        if (field === "title") {
          cats[index] = { ...cats[index], title: value };
        }
        pageData[lang] = cats;
      } else if (selectedPage === "cms_about") {
        pageData[field === "title" ? `story_${lang}` : `story_${lang}`] = value;
      } else {
        const sections = [...(pageData[lang] || [])];
        sections[index] = { ...sections[index], [field]: value };
        pageData[lang] = sections;
      }

      data[selectedPage] = pageData;
      return data;
    });
  };

  const addSection = (lang: "fr" | "en") => {
    setPagesData((prev) => {
      const data = { ...prev };
      const pageData = data[selectedPage] ? { ...data[selectedPage] } : { fr: [], en: [] };

      if (currentPage.isFaq) {
        const cats = [...(pageData[lang] || [])];
        cats.push({ title: "Nouvelle catégorie", items: [{ q: "Question ?", a: "Réponse." }] });
        pageData[lang] = cats;
      } else {
        const sections = [...(pageData[lang] || [])];
        sections.push({ title: `${sections.length + 1}. Nouveau titre`, content: "Contenu..." });
        pageData[lang] = sections;
      }

      data[selectedPage] = pageData;
      return data;
    });
  };

  const removeSection = (lang: "fr" | "en", index: number) => {
    setPagesData((prev) => {
      const data = { ...prev };
      const pageData = { ...data[selectedPage] };
      const arr = [...(pageData[lang] || [])];
      arr.splice(index, 1);
      pageData[lang] = arr;
      data[selectedPage] = pageData;
      return data;
    });
  };

  // FAQ-specific helpers
  const addFaqItem = (lang: "fr" | "en", catIndex: number) => {
    setPagesData((prev) => {
      const data = { ...prev };
      const pageData = { ...data[selectedPage] };
      const cats = [...(pageData[lang] || [])];
      const cat = { ...cats[catIndex], items: [...cats[catIndex].items, { q: "Nouvelle question ?", a: "Réponse." }] };
      cats[catIndex] = cat;
      pageData[lang] = cats;
      data[selectedPage] = pageData;
      return data;
    });
  };

  const updateFaqItem = (lang: "fr" | "en", catIndex: number, itemIndex: number, field: "q" | "a", value: string) => {
    setPagesData((prev) => {
      const data = { ...prev };
      const pageData = { ...data[selectedPage] };
      const cats = [...(pageData[lang] || [])];
      const items = [...cats[catIndex].items];
      items[itemIndex] = { ...items[itemIndex], [field]: value };
      cats[catIndex] = { ...cats[catIndex], items };
      pageData[lang] = cats;
      data[selectedPage] = pageData;
      return data;
    });
  };

  const removeFaqItem = (lang: "fr" | "en", catIndex: number, itemIndex: number) => {
    setPagesData((prev) => {
      const data = { ...prev };
      const pageData = { ...data[selectedPage] };
      const cats = [...(pageData[lang] || [])];
      const items = [...cats[catIndex].items];
      items.splice(itemIndex, 1);
      cats[catIndex] = { ...cats[catIndex], items };
      pageData[lang] = cats;
      data[selectedPage] = pageData;
      return data;
    });
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>;

  const renderLangEditor = (lang: "fr" | "en") => {
    if (selectedPage === "cms_about") {
      const storyKey = `story_${lang}`;
      return (
        <div className="space-y-3">
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Notre histoire ({lang.toUpperCase()})</h4>
            <Textarea
              value={currentData?.[storyKey] || ""}
              onChange={(e) => {
                setPagesData((prev) => {
                  const data = { ...prev };
                  const pageData = { ...(data[selectedPage] || {}) };
                  pageData[storyKey] = e.target.value;
                  data[selectedPage] = pageData;
                  return data;
                });
              }}
              rows={6}
              className="text-sm"
              placeholder="Texte de présentation..."
            />
          </div>
        </div>
      );
    }

    const sections = currentData?.[lang] || [];

    if (currentPage.isFaq) {
      return (
        <div className="space-y-4">
          {sections.map((cat: any, ci: number) => (
            <div key={ci} className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Input
                  value={cat.title}
                  onChange={(e) => updateSection(lang, ci, "title", e.target.value)}
                  className="h-8 text-sm font-semibold flex-1 mr-2"
                />
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeSection(lang, ci)}>
                  <Trash2 size={12} className="text-destructive" />
                </Button>
              </div>
              {cat.items?.map((item: any, ii: number) => (
                <div key={ii} className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={item.q}
                      onChange={(e) => updateFaqItem(lang, ci, ii, "q", e.target.value)}
                      className="h-7 text-xs flex-1"
                      placeholder="Question"
                    />
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeFaqItem(lang, ci, ii)}>
                      <Trash2 size={10} className="text-destructive" />
                    </Button>
                  </div>
                  <Textarea
                    value={item.a}
                    onChange={(e) => updateFaqItem(lang, ci, ii, "a", e.target.value)}
                    rows={2}
                    className="text-xs"
                    placeholder="Réponse"
                  />
                </div>
              ))}
              <Button size="sm" variant="outline" onClick={() => addFaqItem(lang, ci)} className="text-xs gap-1">
                <Plus size={12} /> Question
              </Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => addSection(lang)} className="gap-1.5">
            <Plus size={14} /> Catégorie
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {sections.map((s: Section, i: number) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                value={s.title}
                onChange={(e) => {
                  const arr = [...sections];
                  arr[i] = { ...arr[i], title: e.target.value };
                  setPagesData((prev) => {
                    const data = { ...prev };
                    const pd = { ...data[selectedPage] };
                    pd[lang] = arr;
                    data[selectedPage] = pd;
                    return data;
                  });
                }}
                className="h-8 text-sm font-semibold flex-1"
              />
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeSection(lang, i)}>
                <Trash2 size={12} className="text-destructive" />
              </Button>
            </div>
            <Textarea
              value={s.content}
              onChange={(e) => {
                const arr = [...sections];
                arr[i] = { ...arr[i], content: e.target.value };
                setPagesData((prev) => {
                  const data = { ...prev };
                  const pd = { ...data[selectedPage] };
                  pd[lang] = arr;
                  data[selectedPage] = pd;
                  return data;
                });
              }}
              rows={3}
              className="text-sm"
            />
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={() => addSection(lang)} className="gap-1.5">
          <Plus size={14} /> Section
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex gap-2 flex-wrap">
        {PAGES.map((p) => (
          <button
            key={p.key}
            onClick={() => setSelectedPage(p.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
              selectedPage === p.key
                ? "bg-foreground text-card border-foreground"
                : "bg-card text-foreground border-border hover:border-foreground"
            }`}
          >
            <FileText size={12} />
            {p.label}
          </button>
        ))}
      </div>

      <Tabs defaultValue="fr">
        <TabsList>
          <TabsTrigger value="fr">🇫🇷 Français</TabsTrigger>
          <TabsTrigger value="en">🇬🇧 English</TabsTrigger>
        </TabsList>
        <TabsContent value="fr" className="mt-4">
          {renderLangEditor("fr")}
        </TabsContent>
        <TabsContent value="en" className="mt-4">
          {renderLangEditor("en")}
        </TabsContent>
      </Tabs>

      <Button onClick={handleSave} disabled={saving} className="gap-2">
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        Enregistrer {currentPage.label}
      </Button>
    </div>
  );
}
