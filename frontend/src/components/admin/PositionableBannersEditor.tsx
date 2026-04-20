import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Image, Plus, Edit2, Trash2, Eye, EyeOff, Save, X, Upload, Loader2, MapPin,
} from "lucide-react";
import { sanitizeFilename } from "@/utils/sanitize-filename";

const POSITIONS = [
  { value: "above_categories", label: "Au-dessus des catégories" },
  { value: "below_categories", label: "Sous les catégories" },
  { value: "between_sections", label: "Entre les sections" },
  { value: "above_footer", label: "Au-dessus du footer" },
  { value: "secondary", label: "Bannière secondaire" },
  { value: "sidebar", label: "Barre latérale" },
  { value: "popup_banner", label: "Bannière popup" },
];

const PAGES = [
  { value: "home", label: "Page d'accueil" },
  { value: "category", label: "Pages catégories" },
  { value: "product", label: "Pages produits" },
  { value: "cart", label: "Panier" },
  { value: "checkout", label: "Checkout" },
  { value: "all", label: "Toutes les pages" },
];

interface Banner {
  id: string;
  title: string;
  subtitle: string | null;
  cta: string | null;
  image_url: string | null;
  link: string | null;
  position: string;
  target_page: string;
  sort_order: number;
  is_active: boolean;
  bg_color: string | null;
  text_color: string | null;
}

export function PositionableBannersEditor() {
  const { toast } = useToast();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    title: "", subtitle: "", cta: "", link: "/", position: "above_categories",
    target_page: "home", is_active: true, bg_color: "", text_color: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("cms_banners")
      .select("*")
      .not("position", "in", '("hero_left","hero_slide","hero_right")')
      .order("sort_order");
    setBanners((data || []) as unknown as Banner[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, bannerId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `banners/${Date.now()}_${sanitizeFilename(file.name)}`;
    const { error } = await supabase.storage.from("cms-assets").upload(path, file, { cacheControl: "31536000" });
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("cms-assets").getPublicUrl(path);
    if (bannerId) {
      await supabase.from("cms_banners").update({ image_url: urlData.publicUrl }).eq("id", bannerId);
      load();
    }
    setUploading(false);
    toast({ title: "Image uploadée" });
    return urlData.publicUrl;
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    const payload: any = {
      title: form.title, subtitle: form.subtitle || null, cta: form.cta || null,
      link: form.link || "/", position: form.position, target_page: form.target_page,
      is_active: form.is_active, bg_color: form.bg_color || null, text_color: form.text_color || null,
    };
    if (editing) {
      await supabase.from("cms_banners").update(payload).eq("id", editing.id);
      toast({ title: "Bannière mise à jour" });
    } else {
      payload.sort_order = banners.length;
      await supabase.from("cms_banners").insert(payload);
      toast({ title: "Bannière créée" });
    }
    resetForm();
    load();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("cms_banners").delete().eq("id", id);
    toast({ title: "Supprimée" });
    load();
  };

  const handleToggle = async (id: string, active: boolean) => {
    await supabase.from("cms_banners").update({ is_active: !active }).eq("id", id);
    load();
  };

  const startEdit = (b: Banner) => {
    setEditing(b);
    setForm({
      title: b.title, subtitle: b.subtitle || "", cta: b.cta || "", link: b.link || "/",
      position: b.position, target_page: b.target_page || "home",
      is_active: b.is_active, bg_color: b.bg_color || "", text_color: b.text_color || "",
    });
    setShowForm(true);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm({ title: "", subtitle: "", cta: "", link: "/", position: "above_categories", target_page: "home", is_active: true, bg_color: "", text_color: "" });
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Créez des bannières et placez-les sur n'importe quelle page.</p>
        <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }} className="gap-1.5">
          <Plus size={14} /> Nouvelle bannière
        </Button>
      </div>

      {showForm && (
        <div className="bg-card border-2 border-primary/30 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">{editing ? "Modifier" : "Créer une bannière"}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Titre</Label>
              <Input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Position</Label>
              <select value={form.position} onChange={(e) => setForm(f => ({ ...f, position: e.target.value }))} className="h-9 w-full px-3 text-sm border border-input bg-background rounded-md">
                {POSITIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Page cible</Label>
              <select value={form.target_page} onChange={(e) => setForm(f => ({ ...f, target_page: e.target.value }))} className="h-9 w-full px-3 text-sm border border-input bg-background rounded-md">
                {PAGES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Lien</Label>
              <Input value={form.link} onChange={(e) => setForm(f => ({ ...f, link: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Sous-titre</Label>
              <Input value={form.subtitle} onChange={(e) => setForm(f => ({ ...f, subtitle: e.target.value }))} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">CTA</Label>
              <Input value={form.cta} onChange={(e) => setForm(f => ({ ...f, cta: e.target.value }))} className="h-9 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Couleur fond</Label>
              <div className="flex gap-2">
                <input type="color" value={form.bg_color || "#1e293b"} onChange={(e) => setForm(f => ({ ...f, bg_color: e.target.value }))} className="w-9 h-9 rounded border border-input cursor-pointer" />
                <Input value={form.bg_color} onChange={(e) => setForm(f => ({ ...f, bg_color: e.target.value }))} className="h-9 text-sm flex-1" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Couleur texte</Label>
              <div className="flex gap-2">
                <input type="color" value={form.text_color || "#ffffff"} onChange={(e) => setForm(f => ({ ...f, text_color: e.target.value }))} className="w-9 h-9 rounded border border-input cursor-pointer" />
                <Input value={form.text_color} onChange={(e) => setForm(f => ({ ...f, text_color: e.target.value }))} className="h-9 text-sm flex-1" />
              </div>
            </div>
            <div className="flex items-end gap-2 pb-0.5">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm(f => ({ ...f, is_active: v }))} />
              <span className="text-xs text-muted-foreground">Actif</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} className="gap-1.5"><Save size={14} /> {editing ? "Mettre à jour" : "Créer"}</Button>
            <Button size="sm" variant="ghost" onClick={resetForm}><X size={14} /> Annuler</Button>
          </div>
        </div>
      )}

      {/* Group by position */}
      {POSITIONS.map(pos => {
        const items = banners.filter(b => b.position === pos.value);
        if (items.length === 0) return null;
        return (
          <div key={pos.value} className="space-y-2">
            <div className="flex items-center gap-2">
              <MapPin size={14} className="text-primary" />
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">{pos.label}</h4>
              <span className="text-[10px] text-muted-foreground">({items.length})</span>
            </div>
            {items.map(b => (
              <div key={b.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                <div className="w-16 h-10 rounded bg-muted overflow-hidden shrink-0">
                  {b.image_url ? <img src={b.image_url} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Image size={14} className="text-muted-foreground/30" /></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{b.title}</p>
                  <p className="text-xs text-muted-foreground">{PAGES.find(p => p.value === b.target_page)?.label || b.target_page} · {b.link}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => handleToggle(b.id, b.is_active)} className={`p-1.5 rounded ${b.is_active ? "text-primary" : "text-muted-foreground"}`}>
                    {b.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <label className="p-1.5 rounded text-muted-foreground hover:bg-muted cursor-pointer">
                    <Upload size={14} />
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e, b.id)} />
                  </label>
                  <button onClick={() => startEdit(b)} className="p-1.5 rounded text-muted-foreground hover:bg-muted"><Edit2 size={14} /></button>
                  <button onClick={() => handleDelete(b.id)} className="p-1.5 rounded text-destructive hover:bg-destructive/10"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        );
      })}

      {banners.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground text-center py-8">Aucune bannière positionnée. Cliquez sur « Nouvelle bannière » pour commencer.</p>
      )}
    </div>
  );
}
