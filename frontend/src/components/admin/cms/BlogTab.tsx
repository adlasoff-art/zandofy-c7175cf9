import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
const sb = supabase as any;
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Eye, EyeOff, Search, Star, Users, Shield, X, Video, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

type SubTab = "posts" | "categories" | "comments" | "editors";

const BlogTab: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [subTab, setSubTab] = useState<SubTab>("posts");

  return (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap">
        {([
          { key: "posts", label: "Articles", icon: Eye },
          { key: "categories", label: "Catégories", icon: Star },
          { key: "comments", label: "Commentaires", icon: Users },
          { key: "editors", label: "Rédacteurs", icon: Shield },
        ] as { key: SubTab; label: string; icon: React.ElementType }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-full border transition-colors ${
              subTab === t.key ? "bg-foreground text-card border-foreground" : "bg-card text-foreground border-border hover:border-foreground"
            }`}
          >
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {subTab === "posts" && <PostsManager />}
      {subTab === "categories" && <CategoriesManager />}
      {subTab === "comments" && <CommentsManager />}
      {subTab === "editors" && <EditorsManager />}
    </div>
  );
};

/* =================== POSTS =================== */
function PostsManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState("");

  const { data: categories = [] } = useQuery({
    queryKey: ["admin-blog-categories"],
    queryFn: async () => {
      const { data } = await sb.from("blog_categories").select("*").order("sort_order");
      return data || [];
    },
  });

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["admin-blog-posts"],
    queryFn: async () => {
      const { data } = await sb
        .from("blog_posts")
        .select("*, blog_categories(name, color)")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const filtered = posts.filter((p: any) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  const [form, setForm] = useState({
    title: "", slug: "", excerpt: "", content: "", cover_image_url: "",
    category_id: "", status: "draft", featured: false, tags: "",
    reading_time_min: 5, meta_title: "", meta_description: "", seo_keywords: "",
    og_image_url: "", canonical_url: "", schema_type: "BlogPosting",
    video_embeds: "[]",
  });

  useEffect(() => {
    if (editing) {
      setForm({
        title: editing.title || "",
        slug: editing.slug || "",
        excerpt: editing.excerpt || "",
        content: editing.content || "",
        cover_image_url: editing.cover_image_url || "",
        category_id: editing.category_id || "",
        status: editing.status || "draft",
        featured: editing.featured || false,
        tags: (editing.tags || []).join(", "),
        reading_time_min: editing.reading_time_min || 5,
        meta_title: editing.meta_title || "",
        meta_description: editing.meta_description || "",
        seo_keywords: (editing.seo_keywords || []).join(", "),
        og_image_url: editing.og_image_url || "",
        canonical_url: editing.canonical_url || "",
        schema_type: editing.schema_type || "BlogPosting",
        video_embeds: JSON.stringify(editing.video_embeds || [], null, 2),
      });
    } else {
      setForm({
        title: "", slug: "", excerpt: "", content: "", cover_image_url: "",
        category_id: "", status: "draft", featured: false, tags: "",
        reading_time_min: 5, meta_title: "", meta_description: "", seo_keywords: "",
        og_image_url: "", canonical_url: "", schema_type: "BlogPosting",
        video_embeds: "[]",
      });
    }
  }, [editing]);

  const autoSlug = (title: string) =>
    title.toLowerCase().replace(/[^a-z0-9àâäéèêëïîôùûüÿçœæ]+/g, "-").replace(/(^-|-$)/g, "");

  const save = async () => {
    if (!form.title.trim()) return toast({ title: "Titre requis", variant: "destructive" });
    const slug = form.slug || autoSlug(form.title);
    const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
    const seo_keywords = form.seo_keywords.split(",").map((t) => t.trim()).filter(Boolean);
    let video_embeds: any[] = [];
    try { video_embeds = JSON.parse(form.video_embeds); } catch {}

    // Calculate reading time from content
    const wordCount = form.content.split(/\s+/).filter(Boolean).length;
    const readingTime = Math.max(1, Math.ceil(wordCount / 200));

    const payload = {
      title: form.title,
      slug,
      excerpt: form.excerpt || null,
      content: form.content,
      cover_image_url: form.cover_image_url || null,
      category_id: form.category_id || null,
      status: form.status,
      featured: form.featured,
      tags,
      reading_time_min: readingTime,
      meta_title: form.meta_title || null,
      meta_description: form.meta_description || null,
      seo_keywords,
      og_image_url: form.og_image_url || null,
      canonical_url: form.canonical_url || null,
      schema_type: form.schema_type,
      video_embeds,
      published_at: form.status === "published" ? (editing?.published_at || new Date().toISOString()) : null,
    };

    if (editing) {
      const { error } = await sb.from("blog_posts").update(payload).eq("id", editing.id);
      if (error) return toast({ title: "Erreur", description: error.message, variant: "destructive" });
      toast({ title: "Article mis à jour" });
    } else {
      const { error } = await sb.from("blog_posts").insert({ ...payload, author_id: user!.id });
      if (error) return toast({ title: "Erreur", description: error.message, variant: "destructive" });
      toast({ title: "Article créé" });
    }
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["admin-blog-posts"] });
  };

  const deletePost = async (id: string) => {
    if (!confirm("Supprimer cet article ?")) return;
    await sb.from("blog_posts").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-blog-posts"] });
    toast({ title: "Article supprimé" });
  };

  // Upload cover image
  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return toast({ title: "Max 3MB", variant: "destructive" });
    const ext = file.name.split(".").pop();
    const path = `blog/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("cms-assets").upload(path, file);
    if (error) return toast({ title: "Erreur upload", variant: "destructive" });
    const { data: pub } = supabase.storage.from("cms-assets").getPublicUrl(path);
    setForm((f) => ({ ...f, cover_image_url: pub.publicUrl }));
    toast({ title: "Image téléversée" });
  };

  if (editing !== null || editing === null && false) {
    // We show form inline via a modal-like section
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Rechercher..." className="pl-9 h-9 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button onClick={() => setEditing({})} className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-foreground text-card rounded-full hover:bg-foreground/90">
          <Plus size={13} /> Nouvel article
        </button>
      </div>

      {/* Editor */}
      {editing !== null && (
        <div className="border border-border rounded-xl p-5 bg-card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">{editing?.id ? "Modifier l'article" : "Nouvel article"}</h3>
            <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Titre *</label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value, slug: f.slug || autoSlug(e.target.value) }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Slug</label>
              <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Catégorie</label>
              <select
                value={form.category_id}
                onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
                className="w-full h-9 rounded-md border border-border bg-card px-3 text-sm"
              >
                <option value="">— Aucune —</option>
                {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Statut</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className="w-full h-9 rounded-md border border-border bg-card px-3 text-sm"
              >
                <option value="draft">Brouillon</option>
                <option value="published">Publié</option>
                <option value="archived">Archivé</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Extrait</label>
            <textarea
              value={form.excerpt}
              onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm resize-none"
              rows={2}
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Contenu (HTML)</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm font-mono resize-y"
              rows={12}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Image de couverture</label>
              <div className="flex gap-2">
                <Input value={form.cover_image_url} onChange={(e) => setForm((f) => ({ ...f, cover_image_url: e.target.value }))} placeholder="URL ou upload" />
                <label className="shrink-0 px-3 py-2 text-xs font-medium bg-muted rounded-md cursor-pointer hover:bg-muted/80">
                  Upload
                  <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
                </label>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tags (séparés par virgule)</label>
              <Input value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder="mode, tendances, afrique" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={form.featured} onCheckedChange={(v) => setForm((f) => ({ ...f, featured: v }))} />
            <span className="text-xs text-muted-foreground">Article à la une</span>
          </div>

          {/* SEO Section */}
          <details className="border border-border rounded-lg p-4">
            <summary className="text-xs font-semibold text-foreground cursor-pointer flex items-center gap-2">
              🔍 Référencement SEO & AIO <ChevronDown size={12} />
            </summary>
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Meta Title</label>
                  <Input value={form.meta_title} onChange={(e) => setForm((f) => ({ ...f, meta_title: e.target.value }))} placeholder="Titre SEO (60 car. max)" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Schema Type</label>
                  <select
                    value={form.schema_type}
                    onChange={(e) => setForm((f) => ({ ...f, schema_type: e.target.value }))}
                    className="w-full h-9 rounded-md border border-border bg-card px-3 text-sm"
                  >
                    <option value="BlogPosting">BlogPosting</option>
                    <option value="Article">Article</option>
                    <option value="NewsArticle">NewsArticle</option>
                    <option value="HowTo">HowTo</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Meta Description</label>
                <textarea
                  value={form.meta_description}
                  onChange={(e) => setForm((f) => ({ ...f, meta_description: e.target.value }))}
                  className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm resize-none"
                  rows={2}
                  placeholder="Description SEO (160 car. max)"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Mots-clés SEO</label>
                  <Input value={form.seo_keywords} onChange={(e) => setForm((f) => ({ ...f, seo_keywords: e.target.value }))} placeholder="mot1, mot2, mot3" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">URL canonique</label>
                  <Input value={form.canonical_url} onChange={(e) => setForm((f) => ({ ...f, canonical_url: e.target.value }))} placeholder="https://..." />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Image OG (Open Graph)</label>
                <Input value={form.og_image_url} onChange={(e) => setForm((f) => ({ ...f, og_image_url: e.target.value }))} placeholder="URL de l'image OG" />
              </div>
            </div>
          </details>

          {/* Video embeds */}
          <details className="border border-border rounded-lg p-4">
            <summary className="text-xs font-semibold text-foreground cursor-pointer flex items-center gap-2">
              <Video size={13} /> Vidéos intégrées (YouTube, Facebook…) <ChevronDown size={12} />
            </summary>
            <div className="mt-4">
              <p className="text-[11px] text-muted-foreground mb-2">
                {"Format JSON : [{\"url\": \"...\", \"title\": \"...\", \"showControls\": true, \"showInfo\": false}]"}
              </p>
              <textarea
                value={form.video_embeds}
                onChange={(e) => setForm((f) => ({ ...f, video_embeds: e.target.value }))}
                className="w-full rounded-md border border-border bg-card px-3 py-2 text-xs font-mono resize-y"
                rows={5}
              />
            </div>
          </details>

          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setEditing(null)} className="px-4 py-2 text-xs border border-border rounded-full hover:bg-muted">Annuler</button>
            <button onClick={save} className="px-5 py-2 text-xs font-medium bg-foreground text-card rounded-full hover:bg-foreground/90">
              {editing?.id ? "Sauvegarder" : "Créer"}
            </button>
          </div>
        </div>
      )}

      {/* Posts table */}
      {editing === null && (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="text-left p-3">Titre</th>
                <th className="text-left p-3 hidden md:table-cell">Catégorie</th>
                <th className="text-center p-3">Statut</th>
                <th className="text-center p-3 hidden md:table-cell">Vues</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Chargement…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Aucun article</td></tr>
              ) : (
                filtered.map((p: any) => (
                  <tr key={p.id} className="border-t border-border hover:bg-muted/30">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {p.featured && <Star size={12} className="text-yellow-500 fill-yellow-500" />}
                        <span className="font-medium text-foreground truncate max-w-[250px]">{p.title}</span>
                      </div>
                    </td>
                    <td className="p-3 hidden md:table-cell">
                      {p.blog_categories ? (
                        <span className="px-2 py-0.5 text-[10px] rounded-full text-card font-medium" style={{ backgroundColor: (p.blog_categories as any).color }}>
                          {(p.blog_categories as any).name}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${
                        p.status === "published" ? "bg-green-100 text-green-700" :
                        p.status === "archived" ? "bg-gray-100 text-gray-600" :
                        "bg-yellow-100 text-yellow-700"
                      }`}>
                        {p.status === "published" ? "Publié" : p.status === "archived" ? "Archivé" : "Brouillon"}
                      </span>
                    </td>
                    <td className="p-3 text-center hidden md:table-cell text-muted-foreground">{p.views_count}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => setEditing(p)} className="p-1.5 rounded hover:bg-muted"><Pencil size={13} /></button>
                        <button onClick={() => deletePost(p.id)} className="p-1.5 rounded hover:bg-destructive/10 text-destructive"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* =================== CATEGORIES =================== */
function CategoriesManager() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [color, setColor] = useState("#10b981");

  const { data: categories = [] } = useQuery({
    queryKey: ["admin-blog-categories"],
    queryFn: async () => {
      const { data } = await sb.from("blog_categories").select("*").order("sort_order");
      return data || [];
    },
  });

  const save = async () => {
    if (!name.trim()) return;
    const s = slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const { error } = await sb.from("blog_categories").insert({ name, slug: s, color });
    if (error) return toast({ title: "Erreur", description: error.message, variant: "destructive" });
    setName(""); setSlug(""); setColor("#10b981");
    qc.invalidateQueries({ queryKey: ["admin-blog-categories"] });
    toast({ title: "Catégorie ajoutée" });
  };

  const remove = async (id: string) => {
    await sb.from("blog_categories").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-blog-categories"] });
    toast({ title: "Supprimée" });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground mb-1 block">Nom</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Tendances" />
        </div>
        <div className="w-32">
          <label className="text-xs text-muted-foreground mb-1 block">Couleur</label>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-full h-9 rounded border border-border cursor-pointer" />
        </div>
        <button onClick={save} className="px-4 py-2 text-xs font-medium bg-foreground text-card rounded-full shrink-0">
          <Plus size={13} />
        </button>
      </div>
      <div className="space-y-2">
        {categories.map((c: any) => (
          <div key={c.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: c.color }} />
              <span className="text-sm font-medium">{c.name}</span>
              <span className="text-[11px] text-muted-foreground">/{c.slug}</span>
            </div>
            <button onClick={() => remove(c.id)} className="text-destructive hover:bg-destructive/10 p-1 rounded"><Trash2 size={13} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =================== COMMENTS =================== */
function CommentsManager() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["admin-blog-comments"],
    queryFn: async () => {
      const { data } = await sb
        .from("blog_comments")
        .select("*, blog_posts(title), profiles:user_id(first_name, last_name)")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  const toggleApproval = async (id: string, current: boolean) => {
    await sb.from("blog_comments").update({ is_approved: !current }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-blog-comments"] });
  };

  const remove = async (id: string) => {
    await sb.from("blog_comments").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-blog-comments"] });
    toast({ title: "Commentaire supprimé" });
  };

  return (
    <div className="space-y-2">
      {isLoading ? <p className="text-sm text-muted-foreground">Chargement…</p> : comments.length === 0 ? <p className="text-sm text-muted-foreground">Aucun commentaire</p> : (
        comments.map((c: any) => (
          <div key={c.id} className={`p-3 border rounded-lg text-sm ${c.is_approved ? "border-border" : "border-yellow-300 bg-yellow-50/50"}`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">
                  {c.profiles ? `${c.profiles.first_name || ""} ${c.profiles.last_name || ""}`.trim() : "Anonyme"}
                </span>
                <span className="text-[11px] text-muted-foreground">sur « {(c.blog_posts as any)?.title || "?"} »</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => toggleApproval(c.id, c.is_approved)} className="p-1.5 rounded hover:bg-muted" title={c.is_approved ? "Masquer" : "Approuver"}>
                  {c.is_approved ? <EyeOff size={13} /> : <Eye size={13} className="text-green-600" />}
                </button>
                <button onClick={() => remove(c.id)} className="p-1.5 rounded hover:bg-destructive/10 text-destructive"><Trash2 size={13} /></button>
              </div>
            </div>
            <p className="text-muted-foreground text-xs">{c.content}</p>
          </div>
        ))
      )}
    </div>
  );
}

/* =================== EDITORS =================== */
function EditorsManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");

  const { data: editors = [] } = useQuery({
    queryKey: ["admin-blog-editors"],
    queryFn: async () => {
      const { data } = await sb
        .from("blog_editors")
        .select("*, profiles:user_id(first_name, last_name, email)")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const addEditor = async () => {
    if (!email.trim()) return;
    // Find user by email
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();
    if (!profile) return toast({ title: "Utilisateur introuvable", variant: "destructive" });
    const { error } = await sb.from("blog_editors").insert({ user_id: profile.id, granted_by: user!.id });
    if (error) return toast({ title: "Erreur", description: error.message, variant: "destructive" });
    setEmail("");
    qc.invalidateQueries({ queryKey: ["admin-blog-editors"] });
    toast({ title: "Rédacteur ajouté" });
  };

  const removeEditor = async (id: string) => {
    await sb.from("blog_editors").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-blog-editors"] });
    toast({ title: "Rédacteur retiré" });
  };

  const toggleActive = async (id: string, current: boolean) => {
    await sb.from("blog_editors").update({ is_active: !current }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-blog-editors"] });
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Ajoutez des rédacteurs qui pourront créer et modifier des articles de blog.</p>
      <div className="flex gap-2">
        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email de l'utilisateur" className="max-w-xs" />
        <button onClick={addEditor} className="px-4 py-2 text-xs font-medium bg-foreground text-card rounded-full">
          <Plus size={13} />
        </button>
      </div>
      <div className="space-y-2">
        {editors.map((e: any) => (
          <div key={e.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
            <div>
              <span className="text-sm font-medium text-foreground">
                {e.profiles ? `${e.profiles.first_name || ""} ${e.profiles.last_name || ""}`.trim() || e.profiles.email : "—"}
              </span>
              <span className="ml-2 text-[11px] text-muted-foreground">{e.profiles?.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={e.is_active} onCheckedChange={() => toggleActive(e.id, e.is_active)} />
              <button onClick={() => removeEditor(e.id)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded"><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default BlogTab;
