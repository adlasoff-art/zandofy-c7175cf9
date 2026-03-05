import React, { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Image, Plus, Edit2, Trash2, Eye, EyeOff, GripVertical, Save, X,
  FileText, Menu, LayoutDashboard, Loader2, Upload, FootprintsIcon,
} from "lucide-react";

type Tab = "banners" | "menus" | "pages" | "sections" | "footer";

// ═══ BANNERS TAB ═══
function BannersTab() {
  const { toast } = useToast();
  const [banners, setBanners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ title: "", position: "hero_slide", link: "/", is_active: true, subtitle: "", cta: "" });
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("cms_banners").select("*").order("sort_order");
    setBanners(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.title.trim()) return;
    if (editing) {
      await supabase.from("cms_banners").update(form).eq("id", editing.id);
      toast({ title: "Bannière mise à jour" });
    } else {
      await supabase.from("cms_banners").insert({ ...form, sort_order: banners.length });
      toast({ title: "Bannière créée" });
    }
    setEditing(null);
    setForm({ title: "", position: "hero_slide", link: "/", is_active: true, subtitle: "", cta: "" });
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

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>, bannerId?: string) => {
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
    } else {
      setForm((f) => ({ ...f, image_url: urlData.publicUrl } as any));
    }
    setUploading(false);
    toast({ title: "Image uploadée" });
  };

  const startEdit = (b: any) => {
    setEditing(b);
    setForm({ title: b.title, position: b.position, link: b.link, is_active: b.is_active, subtitle: b.subtitle || "", cta: b.cta || "" });
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>;

  return (
    <div className="space-y-4">
      {/* Form */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{editing ? "Modifier la bannière" : "Ajouter une bannière"}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Titre</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Ex: Promo été" className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Position</Label>
              <select
                value={form.position}
                onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
                className="h-9 w-full px-3 text-sm border border-input bg-background rounded-md"
              >
                <option value="hero_slide">Slide principal</option>
                <option value="hero_left">Bannière gauche</option>
                <option value="hero_right">Bannière droite</option>
                <option value="secondary">Secondaire</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Lien</Label>
              <Input value={form.link} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))} placeholder="/category/soldes" className="h-9 text-sm" />
            </div>
          </div>
          {form.position === "hero_slide" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Sous-titre</Label>
                <Input value={form.subtitle} onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))} placeholder="Électronique, mode..." className="h-9 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Bouton (CTA)</Label>
                <Input value={form.cta} onChange={(e) => setForm((f) => ({ ...f, cta: e.target.value }))} placeholder="ACHETER MAINTENANT" className="h-9 text-sm" />
              </div>
            </div>
          )}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg cursor-pointer text-sm text-muted-foreground hover:bg-muted/80">
            <Upload size={14} />
            {uploading ? "Upload..." : "Image"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUploadImage(e)} disabled={uploading} />
          </label>
          <Button size="sm" onClick={handleSave} className="gap-1.5">
            <Save size={14} /> {editing ? "Mettre à jour" : "Ajouter"}
          </Button>
          {editing && (
            <Button size="sm" variant="ghost" onClick={() => { setEditing(null); setForm({ title: "", position: "hero_slide", link: "/", is_active: true, subtitle: "", cta: "" }); }}>
              <X size={14} /> Annuler
            </Button>
          )}
        </div>
      </div>

      {/* List */}
      <p className="text-sm text-muted-foreground">{banners.length} bannière(s)</p>
      {banners.map((b) => (
        <div key={b.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
          <GripVertical size={16} className="text-muted-foreground/40 cursor-grab shrink-0" />
          <div className="w-16 h-10 rounded-md bg-muted flex items-center justify-center shrink-0 overflow-hidden">
            {b.image_url ? (
              <img src={b.image_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <Image size={18} className="text-muted-foreground/40" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{b.title}</p>
            <p className="text-xs text-muted-foreground">{b.position} · {b.link}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => handleToggle(b.id, b.is_active)} className={`p-1.5 rounded-md transition-colors ${b.is_active ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:bg-muted"}`}>
              {b.is_active ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
            <label className="p-1.5 rounded-md text-muted-foreground hover:bg-muted cursor-pointer">
              <Upload size={16} />
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUploadImage(e, b.id)} />
            </label>
            <button onClick={() => startEdit(b)} className="p-1.5 rounded-md text-muted-foreground hover:bg-muted">
              <Edit2 size={16} />
            </button>
            <button onClick={() => handleDelete(b.id)} className="p-1.5 rounded-md text-destructive hover:bg-destructive/10">
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══ MENUS TAB ═══
function MenusTab() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ label: "", url: "/", is_visible: true, menu_group: "main" });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("cms_menu_items").select("*").order("sort_order");
    setItems(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.label.trim()) return;
    if (editing) {
      await supabase.from("cms_menu_items").update(form).eq("id", editing.id);
      toast({ title: "Menu mis à jour" });
    } else {
      await supabase.from("cms_menu_items").insert({ ...form, sort_order: items.length });
      toast({ title: "Élément ajouté" });
    }
    setEditing(null);
    setForm({ label: "", url: "/", is_visible: true, menu_group: "main" });
    load();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("cms_menu_items").delete().eq("id", id);
    toast({ title: "Élément supprimé" });
    load();
  };

  const handleToggle = async (id: string, visible: boolean) => {
    await supabase.from("cms_menu_items").update({ is_visible: !visible }).eq("id", id);
    load();
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>;

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{editing ? "Modifier l'élément" : "Ajouter un élément"}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Label</Label>
            <Input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="Accueil" className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">URL</Label>
            <Input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="/" className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Groupe</Label>
            <Input value={form.menu_group} onChange={(e) => setForm((f) => ({ ...f, menu_group: e.target.value }))} placeholder="main" className="h-9 text-sm" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={handleSave} className="gap-1.5"><Save size={14} /> {editing ? "Mettre à jour" : "Ajouter"}</Button>
          {editing && <Button size="sm" variant="ghost" onClick={() => { setEditing(null); setForm({ label: "", url: "/", is_visible: true, menu_group: "main" }); }}><X size={14} /> Annuler</Button>}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Navigation ({items.length})</h3>
        <div className="space-y-2">
          {items.map((m) => (
            <div key={m.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <GripVertical size={16} className="text-muted-foreground/40 cursor-grab" />
              <span className="text-sm text-foreground flex-1">{m.label}</span>
              <span className="text-xs text-muted-foreground font-mono">{m.url}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{m.menu_group}</span>
              <button onClick={() => handleToggle(m.id, m.is_visible)} className={`p-1 rounded ${m.is_visible ? "text-primary" : "text-muted-foreground"}`}>
                {m.is_visible ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
              <button onClick={() => { setEditing(m); setForm({ label: m.label, url: m.url, is_visible: m.is_visible, menu_group: m.menu_group }); }} className="p-1 rounded text-muted-foreground hover:bg-muted">
                <Edit2 size={14} />
              </button>
              <button onClick={() => handleDelete(m.id)} className="p-1 rounded text-destructive hover:bg-destructive/10">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Aucun élément de menu</p>}
        </div>
      </div>
    </div>
  );
}

// ═══ PAGES TAB ═══
function PagesTab() {
  const { toast } = useToast();
  const [pages, setPages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ slug: "", title: "", content: "", is_published: false });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("cms_pages").select("*").order("created_at", { ascending: false });
    setPages(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.slug.trim() || !form.title.trim()) return;
    if (editing) {
      await supabase.from("cms_pages").update(form).eq("id", editing.id);
      toast({ title: "Page mise à jour" });
    } else {
      await supabase.from("cms_pages").insert(form);
      toast({ title: "Page créée" });
    }
    setEditing(null);
    setForm({ slug: "", title: "", content: "", is_published: false });
    load();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("cms_pages").delete().eq("id", id);
    toast({ title: "Page supprimée" });
    load();
  };

  const handleToggle = async (id: string, published: boolean) => {
    await supabase.from("cms_pages").update({ is_published: !published }).eq("id", id);
    load();
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>;

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">{editing ? "Modifier la page" : "Créer une page"}</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Slug</Label>
            <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder="a-propos" className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Titre</Label>
            <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="À propos" className="h-9 text-sm" />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Contenu</Label>
          <Textarea value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} placeholder="Contenu de la page..." rows={6} className="text-sm" />
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch checked={form.is_published} onCheckedChange={(v) => setForm((f) => ({ ...f, is_published: v }))} />
            <span className="text-xs text-muted-foreground">Publié</span>
          </div>
          <Button size="sm" onClick={handleSave} className="gap-1.5"><Save size={14} /> {editing ? "Mettre à jour" : "Créer"}</Button>
          {editing && <Button size="sm" variant="ghost" onClick={() => { setEditing(null); setForm({ slug: "", title: "", content: "", is_published: false }); }}><X size={14} /> Annuler</Button>}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{pages.length} page(s)</p>
      {pages.map((p) => (
        <div key={p.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
          <FileText size={18} className="text-muted-foreground/40 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{p.title}</p>
            <p className="text-xs text-muted-foreground">/{p.slug} · {p.content.length} caractères</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${p.is_published ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
              {p.is_published ? "Publié" : "Brouillon"}
            </span>
            <button onClick={() => handleToggle(p.id, p.is_published)} className={`p-1.5 rounded-md transition-colors ${p.is_published ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:bg-muted"}`}>
              {p.is_published ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
            <button onClick={() => { setEditing(p); setForm({ slug: p.slug, title: p.title, content: p.content, is_published: p.is_published }); }} className="p-1.5 rounded-md text-muted-foreground hover:bg-muted">
              <Edit2 size={16} />
            </button>
            <button onClick={() => handleDelete(p.id)} className="p-1.5 rounded-md text-destructive hover:bg-destructive/10">
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══ SECTIONS TAB ═══
function SectionsTab() {
  const { toast } = useToast();
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("cms_homepage_sections").select("*").order("sort_order");
    setSections(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (id: string, active: boolean) => {
    await supabase.from("cms_homepage_sections").update({ is_active: !active }).eq("id", id);
    toast({ title: active ? "Section désactivée" : "Section activée" });
    load();
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Activez ou désactivez les blocs de la page d'accueil et réorganisez-les.</p>
      {sections.map((s) => (
        <div key={s.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
          <GripVertical size={16} className="text-muted-foreground/40 cursor-grab shrink-0" />
          <LayoutDashboard size={18} className="text-primary/60 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">{s.label}</p>
            <p className="text-xs text-muted-foreground font-mono">{s.section_key}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Switch checked={s.is_active} onCheckedChange={() => handleToggle(s.id, s.is_active)} />
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${s.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
              {s.is_active ? "Actif" : "Inactif"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══ FOOTER TAB ═══
function FooterTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    description: "E-commerce généraliste proposant mode, électronique, maison et bien plus.",
    social_links: { facebook: "#", instagram: "#", twitter: "#", youtube: "#", linkedin: "#" },
    newsletter_email: "newsletter@zandofy.com",
  });

  useEffect(() => {
    supabase.from("platform_settings").select("value").eq("key", "footer_config").maybeSingle().then(({ data }) => {
      if (data?.value) {
        const v = data.value as any;
        setConfig({
          description: v.description || config.description,
          social_links: { ...config.social_links, ...v.social_links },
          newsletter_email: v.newsletter_email || config.newsletter_email,
        });
      }
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("platform_settings").upsert({
      key: "footer_config",
      value: config as any,
      updated_at: new Date().toISOString(),
    }, { onConflict: "key" });
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Footer enregistré" });
    }
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>;

  const inputClass = "w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20";

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Texte de description</h3>
        <Textarea
          value={config.description}
          onChange={e => setConfig(prev => ({ ...prev, description: e.target.value }))}
          rows={3}
          className="text-sm"
        />
      </div>

      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Liens réseaux sociaux</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.entries(config.social_links).map(([key, value]) => (
            <div key={key} className="space-y-1">
              <label className="text-xs text-muted-foreground capitalize">{key}</label>
              <input
                type="text"
                value={value}
                onChange={e => setConfig(prev => ({ ...prev, social_links: { ...prev.social_links, [key]: e.target.value } }))}
                className={inputClass}
                placeholder={`https://${key}.com/...`}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Email newsletter</h3>
        <input
          type="email"
          value={config.newsletter_email}
          onChange={e => setConfig(prev => ({ ...prev, newsletter_email: e.target.value }))}
          className={inputClass}
          placeholder="newsletter@zandofy.com"
        />
      </div>

      <Button onClick={handleSave} disabled={saving} className="gap-2">
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        Enregistrer le footer
      </Button>
    </div>
  );
}

// ═══ MAIN PAGE ═══
const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "banners", label: "Bannières", icon: Image },
  { key: "menus", label: "Menus", icon: Menu },
  { key: "pages", label: "Pages", icon: FileText },
  { key: "sections", label: "Sections", icon: LayoutDashboard },
  { key: "footer", label: "Footer", icon: FileText },
];

const AdminCMSPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>("banners");

  return (
    <AdminLayout title="Bannières & CMS">
      <div className="flex gap-1.5 mb-4 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-full border transition-colors whitespace-nowrap ${
              tab === t.key
                ? "bg-foreground text-card border-foreground"
                : "bg-card text-foreground border-border hover:border-foreground"
            }`}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "banners" && <BannersTab />}
      {tab === "menus" && <MenusTab />}
      {tab === "pages" && <PagesTab />}
      {tab === "sections" && <SectionsTab />}
      {tab === "footer" && <FooterTab />}
    </AdminLayout>
  );
};

export default AdminCMSPage;
