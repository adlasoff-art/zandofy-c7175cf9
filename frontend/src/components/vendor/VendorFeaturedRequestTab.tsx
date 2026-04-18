import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Sparkles, Plus, Clock, Loader2, ImagePlus, X, Link as LinkIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";

interface Props {
  storeId: string;
}

type RequestType = "product" | "custom";

const INTERNAL_LINK_SUGGESTIONS = [
  { label: "Page boutique", prefix: "/store/" },
  { label: "Catégorie", prefix: "/category/" },
  { label: "Produit", prefix: "/product/" },
  { label: "Promotions", prefix: "/deals" },
];

export function VendorFeaturedRequestTab({ storeId }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [requestType, setRequestType] = useState<RequestType>("product");
  const [message, setMessage] = useState("");
  const [durationDays, setDurationDays] = useState("7");
  const [internalLink, setInternalLink] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load vendor's PUBLISHED products
  const { data: products = [] } = useQuery({
    queryKey: ["vendor-products-for-featured", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name_fr, price")
        .eq("store_id", storeId)
        .eq("publish_status", "published")
        .order("name_fr");
      return data || [];
    },
  });

  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["vendor-featured-requests", storeId],
    queryFn: async () => {
      const { data } = await (supabase.from("featured_placement_requests" as any) as any)
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast.error("L'image ne doit pas dépasser 3 Mo");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile || !user) return null;
    const ext = imageFile.name.split(".").pop();
    const path = `featured/${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("cms-assets").upload(path, imageFile, { upsert: true, cacheControl: "31536000" });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from("cms-assets").getPublicUrl(path);
    return urlData.publicUrl;
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (requestType === "product" && selectedProductIds.length === 0) {
        throw new Error("Sélectionnez au moins un produit");
      }
      if (requestType === "custom" && !internalLink.trim()) {
        throw new Error("Veuillez renseigner un lien interne");
      }
      // Validate internal link starts with /
      if (requestType === "custom" && !internalLink.startsWith("/")) {
        throw new Error("Le lien doit être un lien interne (commençant par /)");
      }
      setUploading(true);
      let imageUrl: string | null = null;
      if (imageFile) {
        imageUrl = await uploadImage();
      }
      const { error } = await (supabase.from("featured_placement_requests" as any) as any).insert({
        store_id: storeId,
        requested_by: user?.id,
        product_ids: requestType === "product" ? selectedProductIds : [],
        message: message || null,
        desired_duration_days: parseInt(durationDays) || 7,
        image_url: imageUrl,
        request_type: requestType,
        internal_link: requestType === "custom" ? internalLink : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Demande envoyée avec succès !");
      queryClient.invalidateQueries({ queryKey: ["vendor-featured-requests", storeId] });
      resetForm();
    },
    onError: (err: any) => toast.error(err.message || "Erreur lors de l'envoi"),
    onSettled: () => setUploading(false),
  });

  const resetForm = () => {
    setShowForm(false);
    setRequestType("product");
    setMessage("");
    setDurationDays("7");
    setInternalLink("");
    setSelectedProductIds([]);
    setImageFile(null);
    setImagePreview(null);
  };

  const toggleProduct = (id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const statusColors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  };

  const statusLabels: Record<string, string> = {
    pending: "En attente",
    approved: "Approuvée",
    rejected: "Rejetée",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-primary" />
          <h2 className="text-sm font-bold text-foreground">Mise en avant</h2>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90"
        >
          <Plus size={14} /> Nouvelle demande
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Demandez la mise en avant de vos produits ou d'une annonce sur la page d'accueil. L'administration examinera votre demande et fixera un tarif.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-primary" size={20} />
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-10 space-y-2">
          <Sparkles size={32} className="mx-auto text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">Aucune demande pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map((r: any) => (
            <div key={r.id} className="bg-card border border-border rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">
                  {r.request_type === "custom" ? "Annonce libre" : `${r.product_ids?.length || 0} produit(s)`} • {r.desired_duration_days || 7}j
                </p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColors[r.status] || ""}`}>
                  {statusLabels[r.status] || r.status}
                </span>
              </div>
              {r.image_url && (
                <img src={r.image_url} alt="" className="w-20 h-10 object-cover rounded-md" />
              )}
              {r.internal_link && (
                <p className="text-[10px] text-primary flex items-center gap-1"><LinkIcon size={10} /> {r.internal_link}</p>
              )}
              {r.message && <p className="text-xs text-muted-foreground line-clamp-2">{r.message}</p>}
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <Clock size={10} />
                {format(new Date(r.created_at), "dd/MM/yyyy HH:mm")}
                {r.price_quoted != null && (
                  <span className="text-primary font-medium ml-2">Tarif : {r.price_quoted}$</span>
                )}
              </div>
              {r.admin_notes && (
                <p className="text-xs bg-muted/50 rounded-md px-2 py-1 text-muted-foreground">
                  💬 {r.admin_notes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Request Dialog */}
      <Dialog open={showForm} onOpenChange={(v) => { if (!v) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Demande de mise en avant</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Request type selector */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Type de demande</label>
              <div className="flex gap-2 mt-1.5">
                <button
                  onClick={() => setRequestType("product")}
                  className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                    requestType === "product"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  Produits approuvés
                </button>
                <button
                  onClick={() => setRequestType("custom")}
                  className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                    requestType === "custom"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  Annonce libre
                </button>
              </div>
            </div>

            {/* Product selection (only for product type) */}
            {requestType === "product" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Sélectionnez les produits à mettre en avant</label>
                {products.length === 0 ? (
                  <p className="text-xs text-muted-foreground mt-1">Aucun produit publié disponible.</p>
                ) : (
                  <div className="mt-1.5 max-h-40 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
                    {products.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedProductIds.includes(p.id)}
                          onChange={() => toggleProduct(p.id)}
                          className="rounded border-border text-primary focus:ring-primary"
                        />
                        <span className="text-sm text-foreground truncate flex-1">{p.name_fr}</span>
                        <span className="text-xs text-muted-foreground">${p.price}</span>
                      </label>
                    ))}
                  </div>
                )}
                {selectedProductIds.length > 0 && (
                  <p className="text-[10px] text-primary mt-1">{selectedProductIds.length} produit(s) sélectionné(s)</p>
                )}
              </div>
            )}

            {/* Internal link (only for custom type) */}
            {requestType === "custom" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground">Lien interne *</label>
                <Input
                  value={internalLink}
                  onChange={(e) => setInternalLink(e.target.value)}
                  placeholder="/store/ma-boutique ou /category/vetements"
                  className="mt-1"
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {INTERNAL_LINK_SUGGESTIONS.map((s) => (
                    <button
                      key={s.prefix}
                      type="button"
                      onClick={() => setInternalLink(s.prefix)}
                      className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Image upload */}
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

            {/* Duration */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Durée souhaitée (jours)</label>
              <Input type="number" min={1} value={durationDays} onChange={(e) => setDurationDays(e.target.value)} />
            </div>

            {/* Message */}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Message (optionnel)</label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Précisions sur votre demande..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <button onClick={resetForm} className="px-4 py-2 text-sm border border-border rounded-lg">
              Annuler
            </button>
            <button
              onClick={() => submitMutation.mutate()}
              disabled={
                (requestType === "product" && selectedProductIds.length === 0) ||
                (requestType === "custom" && !internalLink.trim()) ||
                submitMutation.isPending || uploading
              }
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg disabled:opacity-50"
            >
              {submitMutation.isPending || uploading ? "Envoi..." : "Envoyer la demande"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
