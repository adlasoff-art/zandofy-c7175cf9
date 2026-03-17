import { useState, useRef } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Sparkles, Plus, Trash2, Check, X, Eye, Loader2, Clock, ImagePlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

// ─── Active Placements Tab ────────────────────────────────────
function PlacementsTab() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [showAdd, setShowAdd] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    placement_type: "product" as string,
    title: "",
    cta_text: "Voir",
    cta_link: "",
    bg_color: "#ffffff",
    text_color: "#000000",
    start_date: new Date().toISOString().slice(0, 16),
    end_date: "",
    price_charged: "0",
    is_active: true,
    sort_order: 0,
    show_timer: false,
    timer_color: "#ffffff",
  });

  const { data: placements = [], isLoading } = useQuery({
    queryKey: ["admin-featured-placements"],
    queryFn: async () => {
      const { data } = await (supabase.from("featured_placements" as any) as any).select("*").order("sort_order");
      return (data || []) as any[];
    },
  });

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile || !user) return null;
    const ext = imageFile.name.split(".").pop();
    const path = `featured/admin/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("cms-assets").upload(path, imageFile, { upsert: true });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from("cms-assets").getPublicUrl(path);
    return urlData.publicUrl;
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { toast.error("Max 3 Mo"); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      setUploading(true);
      let imageUrl: string | null = null;
      if (imageFile) imageUrl = await uploadImage();
      const { error } = await (supabase.from("featured_placements" as any) as any).insert({
        placement_type: form.placement_type,
        title: form.title || null,
        image_url: imageUrl,
        cta_text: form.cta_text || "Voir",
        cta_link: form.cta_link || null,
        bg_color: form.bg_color,
        text_color: form.text_color,
        start_date: form.start_date,
        end_date: form.end_date,
        price_charged: parseFloat(form.price_charged) || 0,
        is_active: form.is_active,
        sort_order: form.sort_order,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Emplacement ajouté");
      queryClient.invalidateQueries({ queryKey: ["admin-featured-placements"] });
      setShowAdd(false);
      setImageFile(null);
      setImagePreview(null);
    },
    onError: () => toast.error("Erreur lors de l'ajout"),
    onSettled: () => setUploading(false),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      await (supabase.from("featured_placements" as any) as any).update({ is_active: !active }).eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-featured-placements"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await (supabase.from("featured_placements" as any) as any).delete().eq("id", id);
    },
    onSuccess: () => {
      toast.success("Supprimé");
      queryClient.invalidateQueries({ queryKey: ["admin-featured-placements"] });
    },
  });

  const typeLabels: Record<string, string> = { product: "Produit", store: "Boutique", ad: "Publicité" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Gérez les emplacements sponsorisés visibles sur la page d'accueil.</p>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90">
          <Plus size={14} /> Ajouter
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>
      ) : placements.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">Aucun emplacement configuré.</p>
      ) : (
        <div className="space-y-2">
          {placements.map((p: any) => (
            <div key={p.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
              {p.image_url && <img src={p.image_url} alt="" className="w-12 h-16 object-cover rounded-md shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{p.title || "Sans titre"}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{typeLabels[p.placement_type] || p.placement_type}</span>
                  {p.price_charged > 0 && <span className="text-[10px] text-primary font-medium">{p.price_charged}$</span>}
                  <span className="text-[10px] text-muted-foreground">{format(new Date(p.start_date), "dd/MM")} → {format(new Date(p.end_date), "dd/MM")}</span>
                </div>
              </div>
              <Switch checked={p.is_active} onCheckedChange={() => toggleMutation.mutate({ id: p.id, active: p.is_active })} />
              <button onClick={() => deleteMutation.mutate(p.id)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded-md">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nouvel emplacement sponsorisé</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Type</label>
              <select value={form.placement_type} onChange={(e) => setForm({ ...form, placement_type: e.target.value })} className="w-full mt-1 border border-border rounded-lg px-3 py-2 text-sm bg-background">
                <option value="product">Produit</option>
                <option value="store">Boutique</option>
                <option value="ad">Publicité / Annonce</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Titre</label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Soldes d'été -40%" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Image de l'annonce <span className="text-muted-foreground/60">(300×600 recommandé · Max 3 Mo)</span>
              </label>
              {imagePreview ? (
                <div className="relative mt-1.5 w-[150px] h-[300px] rounded-lg overflow-hidden border border-border">
                  <img src={imagePreview} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => { setImageFile(null); setImagePreview(null); }}
                    className="absolute top-1 right-1 p-1 bg-card/90 rounded-full hover:bg-destructive/20"
                  >
                    <X size={12} className="text-destructive" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="mt-1.5 w-full border-2 border-dashed border-border rounded-lg py-8 flex flex-col items-center gap-2 hover:border-primary/40 transition-colors"
                >
                  <ImagePlus size={24} className="text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Cliquez pour importer une image</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageSelect} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Texte CTA</label>
                <Input value={form.cta_text} onChange={(e) => setForm({ ...form, cta_text: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Lien CTA</label>
                <Input value={form.cta_link} onChange={(e) => setForm({ ...form, cta_link: e.target.value })} placeholder="/category/soldes" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Début</label>
                <Input type="datetime-local" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Fin</label>
                <Input type="datetime-local" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Couleur fond</label>
                <Input type="color" value={form.bg_color} onChange={(e) => setForm({ ...form, bg_color: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Couleur texte</label>
                <Input type="color" value={form.text_color} onChange={(e) => setForm({ ...form, text_color: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Prix facturé ($)</label>
                <Input type="number" value={form.price_charged} onChange={(e) => setForm({ ...form, price_charged: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Ordre</label>
                <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <span className="text-sm">Actif immédiatement</span>
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm border border-border rounded-lg">Annuler</button>
            <button onClick={() => addMutation.mutate()} disabled={!form.end_date || addMutation.isPending} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg disabled:opacity-50">
              {addMutation.isPending ? "..." : "Créer"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Requests Tab ────────────────────────────────────────────
function RequestsTab() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [priceQuoted, setPriceQuoted] = useState("");

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["admin-featured-requests"],
    queryFn: async () => {
      const { data } = await (supabase.from("featured_placement_requests" as any) as any).select("*").order("created_at", { ascending: false });
      return (data || []) as any[];
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await (supabase.from("featured_placement_requests" as any) as any).update({
        status,
        admin_notes: adminNotes || null,
        price_quoted: priceQuoted ? parseFloat(priceQuoted) : null,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      }).eq("id", id);
    },
    onSuccess: (_, { status }) => {
      toast.success(status === "approved" ? "Demande approuvée" : "Demande rejetée");
      queryClient.invalidateQueries({ queryKey: ["admin-featured-requests"] });
      setReviewId(null);
      setAdminNotes("");
      setPriceQuoted("");
    },
  });

  const statusColors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    approved: "bg-emerald-100 text-emerald-800",
    rejected: "bg-red-100 text-red-800",
    expired: "bg-muted text-muted-foreground",
  };

  const statusLabels: Record<string, string> = {
    pending: "En attente",
    approved: "Approuvée",
    rejected: "Rejetée",
    expired: "Expirée",
  };

  const reviewItem = requests.find((r: any) => r.id === reviewId);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Demandes des vendeurs pour la mise en avant de produits.</p>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>
      ) : requests.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">Aucune demande reçue.</p>
      ) : (
        <div className="space-y-2">
          {requests.map((r: any) => (
            <div key={r.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
              {r.image_url && <img src={r.image_url} alt="" className="w-12 h-16 object-cover rounded-md shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {r.product_ids?.length || 0} produit(s) • Boutique: <span className="text-primary">{r.store_id?.slice(0, 8)}…</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{r.message || "Pas de message"}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Clock size={10} className="text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">{format(new Date(r.created_at), "dd/MM/yyyy HH:mm")}</span>
                  {r.desired_duration_days && <span className="text-[10px] text-muted-foreground">• {r.desired_duration_days}j souhaités</span>}
                </div>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColors[r.status] || ""}`}>
                {statusLabels[r.status] || r.status}
              </span>
              {r.status === "pending" && (
                <button onClick={() => setReviewId(r.id)} className="p-1.5 text-primary hover:bg-primary/10 rounded-md">
                  <Eye size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={!!reviewId} onOpenChange={() => setReviewId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Examiner la demande</DialogTitle></DialogHeader>
          {reviewItem && (
            <div className="space-y-3">
              <div className="text-sm">
                <p><strong>Produits :</strong> {reviewItem.product_ids?.length || 0}</p>
                <p><strong>Durée souhaitée :</strong> {reviewItem.desired_duration_days || "—"} jours</p>
                <p><strong>Message :</strong> {reviewItem.message || "—"}</p>
              </div>
              {reviewItem.image_url && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Image soumise</label>
                  <img src={reviewItem.image_url} alt="" className="mt-1 w-[100px] h-[200px] object-cover rounded-lg border border-border" />
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Prix à facturer ($)</label>
                <Input type="number" value={priceQuoted} onChange={(e) => setPriceQuoted(e.target.value)} placeholder="0" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Notes admin</label>
                <Textarea value={adminNotes} onChange={(e) => setAdminNotes(e.target.value)} placeholder="Raison du refus ou conditions..." rows={3} />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <button onClick={() => reviewMutation.mutate({ id: reviewId!, status: "rejected" })} className="flex items-center gap-1 px-4 py-2 text-sm border border-destructive text-destructive rounded-lg hover:bg-destructive/10">
              <X size={14} /> Refuser
            </button>
            <button onClick={() => reviewMutation.mutate({ id: reviewId!, status: "approved" })} className="flex items-center gap-1 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:opacity-90">
              <Check size={14} /> Approuver
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function AdminFeaturedPlacementsPage() {
  return (
    <AdminLayout title="Mises en avant">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary/10 rounded-xl"><Sparkles className="text-primary" size={20} /></div>
          <div>
            <h1 className="text-lg font-bold text-foreground">Mises en avant</h1>
            <p className="text-xs text-muted-foreground">Gérez les emplacements sponsorisés et les demandes vendeurs</p>
          </div>
        </div>

        <Tabs defaultValue="placements">
          <TabsList className="mb-4">
            <TabsTrigger value="placements">Emplacements actifs</TabsTrigger>
            <TabsTrigger value="requests">Demandes vendeurs</TabsTrigger>
          </TabsList>
          <TabsContent value="placements"><PlacementsTab /></TabsContent>
          <TabsContent value="requests"><RequestsTab /></TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
