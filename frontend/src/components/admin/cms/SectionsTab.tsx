import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LayoutDashboard, Loader2, Plus, Save, ChevronUp, ChevronDown } from "lucide-react";

type SectionRow = {
  id: string;
  label: string;
  section_key: string;
  is_active: boolean;
  sort_order: number;
  config: { entity_id?: string; limit?: number; href?: string } | null;
};

type CatOpt = { id: string; name: string; name_fr: string | null };
type StoreOpt = { id: string; name: string };

export default function SectionsTab() {
  const { toast } = useToast();
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<CatOpt[]>([]);
  const [stores, setStores] = useState<StoreOpt[]>([]);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftType, setDraftType] = useState<"category_rail" | "store_rail">("category_rail");
  const [draftEntity, setDraftEntity] = useState("");
  const [draftLimit, setDraftLimit] = useState("12");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data }, cats, storesRes] = await Promise.all([
      supabase.from("cms_homepage_sections").select("*").order("sort_order"),
      supabase
        .from("categories")
        .select("id, name, name_fr")
        .is("parent_id", null)
        .order("name_fr")
        .limit(200),
      supabase.from("stores").select("id, name").order("name").limit(200),
    ]);
    setSections((data as SectionRow[]) || []);
    setCategories((cats.data as CatOpt[]) || []);
    setStores((storesRes.data as StoreOpt[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = async (id: string, active: boolean) => {
    await supabase.from("cms_homepage_sections").update({ is_active: !active }).eq("id", id);
    toast({ title: active ? "Section désactivée" : "Section activée" });
    load();
  };

  const moveSection = async (id: string, direction: -1 | 1) => {
    const idx = sections.findIndex((s) => s.id === id);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= sections.length) return;
    const a = sections[idx];
    const b = sections[swapIdx];
    const orderA = a.sort_order;
    const orderB = b.sort_order;
    await Promise.all([
      supabase.from("cms_homepage_sections").update({ sort_order: orderB }).eq("id", a.id),
      supabase.from("cms_homepage_sections").update({ sort_order: orderA }).eq("id", b.id),
    ]);
    load();
  };

  const handleSaveConfig = async (section: SectionRow) => {
    const { error } = await supabase
      .from("cms_homepage_sections")
      .update({
        label: section.label,
        config: section.config,
        updated_at: new Date().toISOString(),
      })
      .eq("id", section.id);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Section enregistrée" });
    load();
  };

  const handleAddRail = async () => {
    if (!draftLabel.trim() || !draftEntity) {
      toast({ title: "Label et entité requis", variant: "destructive" });
      return;
    }
    setSaving(true);
    const maxOrder = sections.reduce((m, s) => Math.max(m, s.sort_order ?? 0), 0);
    const { error } = await supabase.from("cms_homepage_sections").insert({
      label: draftLabel.trim(),
      section_key: draftType,
      is_active: true,
      sort_order: maxOrder + 1,
      config: {
        entity_id: draftEntity,
        limit: Math.min(Math.max(Number(draftLimit) || 12, 4), 24),
      },
    });
    setSaving(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Rail ajouté" });
    setDraftLabel("");
    setDraftEntity("");
    load();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="animate-spin text-primary" size={20} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Activez les blocs d&apos;accueil. Les rails catégorie / boutique s&apos;affichent avant le feed
        Tendance (mobile + desktop).
      </p>

      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <p className="text-sm font-medium text-foreground flex items-center gap-2">
          <Plus size={16} /> Nouveau rail CMS
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Titre affiché</Label>
            <Input value={draftLabel} onChange={(e) => setDraftLabel(e.target.value)} placeholder="Ex. Mode femme" />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select
              value={draftType}
              onValueChange={(v) => {
                setDraftType(v as "category_rail" | "store_rail");
                setDraftEntity("");
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="category_rail">Rail catégorie</SelectItem>
                <SelectItem value="store_rail">Rail boutique</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{draftType === "category_rail" ? "Catégorie" : "Boutique"}</Label>
            <Select value={draftEntity} onValueChange={setDraftEntity}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir…" />
              </SelectTrigger>
              <SelectContent>
                {draftType === "category_rail"
                  ? categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name_fr || c.name}
                      </SelectItem>
                    ))
                  : stores.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Limite produits</Label>
            <Input
              type="number"
              min={4}
              max={24}
              value={draftLimit}
              onChange={(e) => setDraftLimit(e.target.value)}
            />
          </div>
        </div>
        <Button type="button" size="sm" onClick={handleAddRail} disabled={saving}>
          {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : <Plus size={14} className="mr-1" />}
          Ajouter
        </Button>
      </div>

      <div className="space-y-3">
        {sections.map((s, idx) => {
          const isRail = s.section_key === "category_rail" || s.section_key === "store_rail";
          return (
            <div key={s.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-muted disabled:opacity-30"
                    disabled={idx === 0}
                    onClick={() => moveSection(s.id, -1)}
                    aria-label="Monter"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-muted disabled:opacity-30"
                    disabled={idx === sections.length - 1}
                    onClick={() => moveSection(s.id, 1)}
                    aria-label="Descendre"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
                <LayoutDashboard size={18} className="text-primary/60 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{s.label}</p>
                  <p className="text-xs text-muted-foreground font-mono">{s.section_key}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Switch checked={s.is_active} onCheckedChange={() => handleToggle(s.id, s.is_active)} />
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      s.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {s.is_active ? "Actif" : "Inactif"}
                  </span>
                </div>
              </div>

              {isRail && (
                <div className="grid sm:grid-cols-3 gap-3 pl-10">
                  <div className="space-y-1">
                    <Label className="text-xs">Titre</Label>
                    <Input
                      value={s.label}
                      onChange={(e) =>
                        setSections((prev) =>
                          prev.map((x) => (x.id === s.id ? { ...x, label: e.target.value } : x)),
                        )
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Entité</Label>
                    <Select
                      value={s.config?.entity_id || ""}
                      onValueChange={(v) =>
                        setSections((prev) =>
                          prev.map((x) =>
                            x.id === s.id
                              ? { ...x, config: { ...(x.config || {}), entity_id: v } }
                              : x,
                          ),
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choisir…" />
                      </SelectTrigger>
                      <SelectContent>
                        {s.section_key === "category_rail"
                          ? categories.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name_fr || c.name}
                              </SelectItem>
                            ))
                          : stores.map((st) => (
                              <SelectItem key={st.id} value={st.id}>
                                {st.name}
                              </SelectItem>
                            ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Limite</Label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min={4}
                        max={24}
                        value={s.config?.limit ?? 12}
                        onChange={(e) =>
                          setSections((prev) =>
                            prev.map((x) =>
                              x.id === s.id
                                ? {
                                    ...x,
                                    config: {
                                      ...(x.config || {}),
                                      limit: Number(e.target.value) || 12,
                                    },
                                  }
                                : x,
                            ),
                          )
                        }
                      />
                      <Button type="button" size="icon" variant="outline" onClick={() => handleSaveConfig(s)}>
                        <Save size={14} />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
