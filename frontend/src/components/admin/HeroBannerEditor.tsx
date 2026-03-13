import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Image, Plus, Edit2, Trash2, Eye, EyeOff, Save, X, Upload, Loader2,
  ChevronLeft, ChevronRight, PanelLeft, Columns3, PanelRight,
} from "lucide-react";

type Zone = "hero_left" | "hero_slide" | "hero_right";

const ZONE_LABELS: Record<Zone, string> = {
  hero_left: "Colonne Gauche",
  hero_slide: "Carousel Central",
  hero_right: "Colonne Droite",
};

const ZONE_ICONS: Record<Zone, React.ElementType> = {
  hero_left: PanelLeft,
  hero_slide: Columns3,
  hero_right: PanelRight,
};

interface BannerItem {
  id: string;
  title: string;
  subtitle: string | null;
  cta: string | null;
  image_url: string | null;
  link: string | null;
  position: string;
  sort_order: number;
  is_active: boolean;
  bg_color?: string | null;
  text_color?: string | null;
}

export function HeroBannerEditor() {
  const { toast } = useToast();
  const [banners, setBanners] = useState<BannerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [editingBanner, setEditingBanner] = useState<BannerItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    title: "", subtitle: "", cta: "", link: "/", is_active: true,
    bg_color: "", text_color: "",
  });
  const [formImageFile, setFormImageFile] = useState<File | null>(null);
  const [formImagePreview, setFormImagePreview] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("cms_banners")
      .select("*")
      .in("position", ["hero_left", "hero_slide", "hero_right"])
      .order("sort_order");
    setBanners((data || []) as BannerItem[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const zoneBanners = (zone: Zone) => banners.filter((b) => b.position === zone);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, bannerId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `banners/${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from("cms-assets").upload(path, file);
    if (error) {
      toast({ title: "Erreur upload", description: error.message, variant: "destructive" });
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
    if (!form.title.trim() || !selectedZone) return;

    let imageUrl: string | null = null;
    if (formImageFile) {
      setUploading(true);
      const path = `banners/${Date.now()}_${formImageFile.name}`;
      const { error } = await supabase.storage.from("cms-assets").upload(path, formImageFile);
      if (error) {
        toast({ title: "Erreur upload", description: error.message, variant: "destructive" });
        setUploading(false);
        return;
      }
      const { data: urlData } = supabase.storage.from("cms-assets").getPublicUrl(path);
      imageUrl = urlData.publicUrl;
      setUploading(false);
    }

    const payload: any = {
      title: form.title,
      subtitle: form.subtitle || null,
      cta: form.cta || null,
      link: form.link || "/",
      is_active: form.is_active,
      position: selectedZone,
      bg_color: form.bg_color || null,
      text_color: form.text_color || null,
    };
    if (imageUrl) payload.image_url = imageUrl;
    if (editingBanner) {
      await supabase.from("cms_banners").update(payload).eq("id", editingBanner.id);
      toast({ title: "Bannière mise à jour" });
    } else {
      payload.sort_order = zoneBanners(selectedZone).length;
      await supabase.from("cms_banners").insert(payload);
      toast({ title: "Bannière ajoutée" });
    }
    resetForm();
    load();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("cms_banners").delete().eq("id", id);
    toast({ title: "Bannière supprimée" });
    load();
  };

  const handleToggle = async (id: string, active: boolean) => {
    await supabase.from("cms_banners").update({ is_active: !active }).eq("id", id);
    load();
  };

  const startEdit = (b: BannerItem) => {
    setSelectedZone(b.position as Zone);
    setEditingBanner(b);
    setForm({
      title: b.title,
      subtitle: b.subtitle || "",
      cta: b.cta || "",
      link: b.link || "/",
      is_active: b.is_active,
      bg_color: (b as any).bg_color || "",
      text_color: (b as any).text_color || "",
    });
    setFormImageFile(null);
    setFormImagePreview(b.image_url || null);
    setShowForm(true);
  };

  const startAdd = (zone: Zone) => {
    setSelectedZone(zone);
    setEditingBanner(null);
    setForm({ title: "", subtitle: "", cta: "", link: "/", is_active: true, bg_color: "", text_color: "" });
    setShowForm(true);
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingBanner(null);
    setForm({ title: "", subtitle: "", cta: "", link: "/", is_active: true, bg_color: "", text_color: "" });
    setFormImageFile(null);
    setFormImagePreview(null);
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Visual Preview */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Aperçu du Hero Banner</h3>
        <div className="grid grid-cols-[1fr_3fr_1fr] gap-2" style={{ minHeight: 200 }}>
          {/* Left Column */}
          <ZonePreview
            zone="hero_left"
            banners={zoneBanners("hero_left")}
            isSelected={selectedZone === "hero_left"}
            onSelect={() => setSelectedZone("hero_left")}
            onAdd={() => startAdd("hero_left")}
            onEdit={startEdit}
          />

          {/* Center Carousel */}
          <ZonePreview
            zone="hero_slide"
            banners={zoneBanners("hero_slide")}
            isSelected={selectedZone === "hero_slide"}
            onSelect={() => setSelectedZone("hero_slide")}
            onAdd={() => startAdd("hero_slide")}
            onEdit={startEdit}
            isCarousel
          />

          {/* Right Column */}
          <ZonePreview
            zone="hero_right"
            banners={zoneBanners("hero_right")}
            isSelected={selectedZone === "hero_right"}
            onSelect={() => setSelectedZone("hero_right")}
            onAdd={() => startAdd("hero_right")}
            onEdit={startEdit}
          />
        </div>
      </div>

      {/* Zone Detail + Form */}
      {selectedZone && (
        <div className="bg-card border-2 border-primary/30 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {React.createElement(ZONE_ICONS[selectedZone], { size: 18, className: "text-primary" })}
              <h3 className="text-sm font-semibold text-foreground">{ZONE_LABELS[selectedZone]}</h3>
              <span className="text-xs text-muted-foreground">({zoneBanners(selectedZone).length} image(s))</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => startAdd(selectedZone)} className="gap-1.5">
                <Plus size={14} /> Ajouter
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setSelectedZone(null); resetForm(); }}>
                <X size={14} />
              </Button>
            </div>
          </div>

          {/* Banners list for this zone */}
          <div className="space-y-2">
            {zoneBanners(selectedZone).map((b, idx) => (
              <div key={b.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${editingBanner?.id === b.id ? "border-primary bg-primary/5" : "border-border bg-muted/30"}`}>
                <span className="text-xs font-bold text-muted-foreground w-5">{idx + 1}</span>
                <div className="w-16 h-10 rounded bg-muted overflow-hidden shrink-0">
                  {b.image_url ? (
                    <img src={b.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Image size={14} className="text-muted-foreground/40" /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{b.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{b.link}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => handleToggle(b.id, b.is_active)} className={`p-1.5 rounded ${b.is_active ? "text-primary" : "text-muted-foreground"}`}>
                    {b.is_active ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <label className="p-1.5 rounded text-muted-foreground hover:bg-muted cursor-pointer">
                    <Upload size={14} />
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e, b.id)} />
                  </label>
                  <button onClick={() => startEdit(b)} className="p-1.5 rounded text-muted-foreground hover:bg-muted">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDelete(b.id)} className="p-1.5 rounded text-destructive hover:bg-destructive/10">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            {zoneBanners(selectedZone).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Aucune image dans cette zone</p>
            )}
          </div>

          {/* Edit/Add Form */}
          {showForm && (
            <div className="border-t border-border pt-4 space-y-3">
              <h4 className="text-sm font-semibold text-foreground">
                {editingBanner ? `Modifier — ${ZONE_LABELS[selectedZone]} #${zoneBanners(selectedZone).findIndex(b => b.id === editingBanner.id) + 1}` : `Nouvelle image — ${ZONE_LABELS[selectedZone]}`}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Titre</Label>
                  <Input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Titre de la bannière" className="h-9 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Lien (URL)</Label>
                  <Input value={form.link} onChange={(e) => setForm(f => ({ ...f, link: e.target.value }))} placeholder="/category/soldes" className="h-9 text-sm" />
              </div>
              {/* Image Upload */}
              <div className="space-y-1">
                <Label className="text-xs">Image</Label>
                <div className="flex items-center gap-3">
                  {(formImagePreview || (editingBanner?.image_url && !formImageFile)) && (
                    <div className="w-20 h-12 rounded border border-border overflow-hidden shrink-0">
                      <img src={formImagePreview || editingBanner?.image_url || ""} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <label className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-input bg-background text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors">
                    <Upload size={14} />
                    {formImageFile ? formImageFile.name : "Choisir une image"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setFormImageFile(file);
                          setFormImagePreview(URL.createObjectURL(file));
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
              </div>
              {selectedZone === "hero_slide" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Sous-titre</Label>
                    <Input value={form.subtitle} onChange={(e) => setForm(f => ({ ...f, subtitle: e.target.value }))} placeholder="Description courte" className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Bouton (CTA)</Label>
                    <Input value={form.cta} onChange={(e) => setForm(f => ({ ...f, cta: e.target.value }))} placeholder="ACHETER MAINTENANT" className="h-9 text-sm" />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Couleur de fond</Label>
                  <div className="flex gap-2">
                    <input type="color" value={form.bg_color || "#000000"} onChange={(e) => setForm(f => ({ ...f, bg_color: e.target.value }))} className="w-9 h-9 rounded border border-input cursor-pointer" />
                    <Input value={form.bg_color} onChange={(e) => setForm(f => ({ ...f, bg_color: e.target.value }))} placeholder="#000000" className="h-9 text-sm flex-1" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Couleur du texte</Label>
                  <div className="flex gap-2">
                    <input type="color" value={form.text_color || "#ffffff"} onChange={(e) => setForm(f => ({ ...f, text_color: e.target.value }))} className="w-9 h-9 rounded border border-input cursor-pointer" />
                    <Input value={form.text_color} onChange={(e) => setForm(f => ({ ...f, text_color: e.target.value }))} placeholder="#ffffff" className="h-9 text-sm flex-1" />
                  </div>
                </div>
                <div className="flex items-end gap-2 pb-0.5">
                  <Switch checked={form.is_active} onCheckedChange={(v) => setForm(f => ({ ...f, is_active: v }))} />
                  <span className="text-xs text-muted-foreground">Actif</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} className="gap-1.5">
                  <Save size={14} /> {editingBanner ? "Mettre à jour" : "Ajouter"}
                </Button>
                <Button size="sm" variant="ghost" onClick={resetForm}>
                  <X size={14} /> Annuler
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Mini visual preview for each zone
function ZonePreview({
  zone, banners, isSelected, onSelect, onAdd, onEdit, isCarousel,
}: {
  zone: Zone;
  banners: BannerItem[];
  isSelected: boolean;
  onSelect: () => void;
  onAdd: () => void;
  onEdit: (b: BannerItem) => void;
  isCarousel?: boolean;
}) {
  const [slideIdx, setSlideIdx] = useState(0);
  const Icon = ZONE_ICONS[zone];

  return (
    <div
      onClick={onSelect}
      className={`rounded-lg border-2 transition-all cursor-pointer overflow-hidden ${
        isSelected ? "border-primary shadow-md" : "border-border hover:border-primary/40"
      }`}
    >
      {/* Zone header */}
      <div className="bg-muted/50 px-2 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon size={12} className="text-primary" />
          <span className="text-[10px] font-semibold text-foreground">{ZONE_LABELS[zone]}</span>
        </div>
        <span className="text-[10px] text-muted-foreground">{banners.length}</span>
      </div>

      {/* Content */}
      <div className={`${isCarousel ? "" : "flex flex-col gap-1 p-1"}`} style={{ minHeight: 150 }}>
        {isCarousel ? (
          <div className="relative" style={{ height: 150 }}>
            {banners.length > 0 ? (
              <>
                <img
                  src={banners[slideIdx % banners.length]?.image_url || "/placeholder.svg"}
                  alt=""
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-foreground/30 flex flex-col items-center justify-center p-2">
                  <p className="text-card text-[10px] font-bold text-center truncate w-full">{banners[slideIdx % banners.length]?.title}</p>
                  {banners[slideIdx % banners.length]?.cta && (
                    <span className="mt-1 text-[8px] bg-card text-foreground px-2 py-0.5 rounded">{banners[slideIdx % banners.length]?.cta}</span>
                  )}
                </div>
                {banners.length > 1 && (
                  <>
                    <button onClick={(e) => { e.stopPropagation(); setSlideIdx(i => (i - 1 + banners.length) % banners.length); }} className="absolute left-0.5 top-1/2 -translate-y-1/2 w-5 h-5 bg-card/70 rounded-full flex items-center justify-center">
                      <ChevronLeft size={10} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setSlideIdx(i => (i + 1) % banners.length); }} className="absolute right-0.5 top-1/2 -translate-y-1/2 w-5 h-5 bg-card/70 rounded-full flex items-center justify-center">
                      <ChevronRight size={10} />
                    </button>
                  </>
                )}
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                  {banners.map((_, i) => (
                    <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === slideIdx % banners.length ? "bg-card" : "bg-card/40"}`} />
                  ))}
                </div>
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-muted/30">
                <Image size={20} className="text-muted-foreground/30 mb-1" />
                <span className="text-[9px] text-muted-foreground">Aucun slide</span>
              </div>
            )}
          </div>
        ) : (
          <>
            {banners.map((b, i) => (
              <div
                key={b.id}
                onClick={(e) => { e.stopPropagation(); onEdit(b); }}
                className="relative rounded overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
                style={{ flex: 1, minHeight: 40 }}
              >
                {b.image_url ? (
                  <img src={b.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <Image size={12} className="text-muted-foreground/30" />
                  </div>
                )}
                <div className="absolute inset-0 bg-foreground/30 flex items-center justify-center">
                  <span className="text-card text-[9px] font-bold truncate px-1">{b.title}</span>
                </div>
              </div>
            ))}
            {banners.length < 3 && (
              <button
                onClick={(e) => { e.stopPropagation(); onAdd(); }}
                className="flex items-center justify-center gap-1 rounded border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                style={{ flex: 1, minHeight: 40 }}
              >
                <Plus size={12} />
                <span className="text-[9px]">Ajouter</span>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
