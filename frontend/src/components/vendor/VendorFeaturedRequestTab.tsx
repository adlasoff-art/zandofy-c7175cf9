import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Sparkles, Plus, Clock, Loader2, ImagePlus, X, Link as LinkIcon, RotateCcw, CalendarPlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { sanitizeExtension } from "@/utils/sanitize-filename";

interface Props {
  storeId: string;
}

type ContentType = "product" | "custom";
type FormMode = "new" | "relaunch" | "extend";

const MIN_DAYS = 1;
const MAX_DAYS = 90;

const INTERNAL_LINK_SUGGESTIONS = [
  { label: "Page boutique", prefix: "/store/" },
  { label: "Catégorie", prefix: "/category/" },
  { label: "Produit", prefix: "/product/" },
  { label: "Promotions", prefix: "/deals" },
];

function clampDays(raw: string, fallback = 7): number {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MAX_DAYS, Math.max(MIN_DAYS, n));
}

function friendlyInsertError(err: { message?: string; code?: string }): string {
  const msg = err.message || "";
  if (err.code === "23505" || /idx_featured_req_one_pending_extend/i.test(msg)) {
    return "Une demande de prolongation est déjà en attente pour cet emplacement";
  }
  if (/desired_duration_days/i.test(msg)) {
    return `La durée doit être entre ${MIN_DAYS} et ${MAX_DAYS} jours`;
  }
  if (/cannot extend|cannot relaunch|product_ids must belong|parent request|target placement/i.test(msg)) {
    return "Demande refusée : données invalides ou emplacement non lié à votre boutique";
  }
  if (/can_access_store|policy|permission|RLS|row-level/i.test(msg)) {
    return "Vous n'avez pas l'autorisation d'envoyer une demande pour cette boutique";
  }
  return msg || "Erreur lors de l'envoi";
}

export function VendorFeaturedRequestTab({ storeId }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("new");
  const [requestType, setRequestType] = useState<ContentType>("product");
  const [message, setMessage] = useState("");
  const [durationDays, setDurationDays] = useState("7");
  const [internalLink, setInternalLink] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [parentRequestId, setParentRequestId] = useState<string | null>(null);
  const [targetPlacementId, setTargetPlacementId] = useState<string | null>(null);
  const [extendPlacementLabel, setExtendPlacementLabel] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: products = [], isLoading: productsLoading } = useQuery({
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

  const publishedProductIds = new Set(products.map((p) => p.id));
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["vendor-featured-requests", storeId],
    queryFn: async () => {
      const { data, error } = await (supabase.from("featured_placement_requests" as any) as any)
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: activePlacements = [] } = useQuery({
    queryKey: ["vendor-active-featured-placements", storeId],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await (supabase.from("featured_placements" as any) as any)
        .select("id, title, image_url, end_date, is_active, store_id, source_request_id, cta_link")
        .eq("store_id", storeId)
        .eq("is_active", true)
        .gte("end_date", nowIso)
        .order("end_date", { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const pendingExtendPlacementIds = new Set(
    requests
      .filter((r: any) => r.status === "pending" && r.action_type === "extend" && r.target_placement_id)
      .map((r: any) => r.target_placement_id as string)
  );

  const activeSourceRequestIds = new Set(
    activePlacements
      .map((p: any) => p.source_request_id as string | null)
      .filter(Boolean)
  );

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast.error("L'image ne doit pas dépasser 3 Mo");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setExistingImageUrl(null);
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile || !user) return null;
    const ext = sanitizeExtension(imageFile.name, "jpg");
    const path = `featured/${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("cms-assets").upload(path, imageFile, { upsert: true, cacheControl: "31536000" });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from("cms-assets").getPublicUrl(path);
    return urlData.publicUrl;
  };

  const clearFormFields = () => {
    setFormMode("new");
    setRequestType("product");
    setMessage("");
    setDurationDays("7");
    setInternalLink("");
    setSelectedProductIds([]);
    setImageFile(null);
    setImagePreview(null);
    setExistingImageUrl(null);
    setParentRequestId(null);
    setTargetPlacementId(null);
    setExtendPlacementLabel("");
  };

  const resetForm = () => {
    setShowForm(false);
    clearFormFields();
  };

  const openNew = () => {
    clearFormFields();
    setFormMode("new");
    setShowForm(true);
  };

  const openRelaunch = (r: any) => {
    if (r.status === "approved" && activeSourceRequestIds.has(r.id)) {
      const placement = activePlacements.find((p: any) => p.source_request_id === r.id);
      toast.message("Cette mise en avant est encore active", {
        description: "Utilisez « Prolonger » pour étendre la durée via le circuit admin.",
        action: placement
          ? {
              label: "Prolonger",
              onClick: () => openExtend(placement),
            }
          : undefined,
      });
      return;
    }

    const originalIds: string[] = Array.isArray(r.product_ids) ? r.product_ids : [];
    // Avoid wiping selection while products query is still loading
    const keptProducts = productsLoading
      ? originalIds
      : originalIds.filter((id) => publishedProductIds.has(id));

    setFormMode("relaunch");
    setParentRequestId(r.id);
    setTargetPlacementId(null);
    setExtendPlacementLabel("");
    setRequestType(r.request_type === "custom" ? "custom" : "product");
    setSelectedProductIds(keptProducts);
    setMessage(r.message || "");
    setDurationDays(String(clampDays(String(r.desired_duration_days || 7))));
    setInternalLink(r.internal_link || "");
    setImageFile(null);
    setExistingImageUrl(r.image_url || null);
    setImagePreview(r.image_url || null);
    setShowForm(true);

    if (
      !productsLoading &&
      r.request_type !== "custom" &&
      originalIds.length > keptProducts.length
    ) {
      toast.message("Certains produits ne sont plus publiés", {
        description: "Ils ont été retirés de la sélection. Vérifiez avant d'envoyer.",
      });
    }
  };

  const openExtend = (placement: any) => {
    if (pendingExtendPlacementIds.has(placement.id)) {
      toast.error("Une demande de prolongation est déjà en attente pour cet emplacement");
      return;
    }
    if (placement.store_id !== storeId) {
      toast.error("Cet emplacement n'appartient pas à votre boutique");
      return;
    }
    setFormMode("extend");
    setParentRequestId(placement.source_request_id || null);
    setTargetPlacementId(placement.id);
    setExtendPlacementLabel(placement.title || "Mise en avant active");
    setRequestType("product");
    setSelectedProductIds([]);
    setMessage("");
    setDurationDays("7");
    setInternalLink("");
    setImageFile(null);
    setImagePreview(placement.image_url || null);
    setExistingImageUrl(placement.image_url || null);
    setShowForm(true);
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Session expirée — reconnectez-vous");

      if (formMode === "extend") {
        if (!targetPlacementId) throw new Error("Emplacement manquant");
        const days = clampDays(durationDays, 0);
        if (days < MIN_DAYS) throw new Error(`Indiquez entre ${MIN_DAYS} et ${MAX_DAYS} jours à ajouter`);

        const { error } = await (supabase.from("featured_placement_requests" as any) as any).insert({
          store_id: storeId,
          requested_by: user.id,
          product_ids: [],
          message: message.trim() || null,
          desired_duration_days: days,
          image_url: existingImageUrl,
          request_type: "product",
          internal_link: null,
          action_type: "extend",
          parent_request_id: parentRequestId,
          target_placement_id: targetPlacementId,
        });
        if (error) throw error;
        return;
      }

      if (requestType === "product" && selectedProductIds.length === 0) {
        throw new Error("Sélectionnez au moins un produit");
      }
      if (requestType === "product") {
        const foreign = selectedProductIds.filter((id) => !publishedProductIds.has(id));
        if (foreign.length > 0) {
          throw new Error("Un ou plusieurs produits ne sont plus publiés sur cette boutique");
        }
      }
      if (requestType === "custom" && !internalLink.trim()) {
        throw new Error("Veuillez renseigner un lien interne");
      }
      if (requestType === "custom" && !internalLink.startsWith("/")) {
        throw new Error("Le lien doit être un lien interne (commençant par /)");
      }
      if (formMode === "relaunch" && !parentRequestId) {
        throw new Error("Demande d'origine manquante");
      }

      const days = clampDays(durationDays);
      setUploading(true);
      let imageUrl: string | null = existingImageUrl;
      if (imageFile) {
        imageUrl = await uploadImage();
      }

      const { error } = await (supabase.from("featured_placement_requests" as any) as any).insert({
        store_id: storeId,
        requested_by: user.id,
        product_ids: requestType === "product" ? selectedProductIds : [],
        message: message.trim() || null,
        desired_duration_days: days,
        image_url: imageUrl,
        request_type: requestType,
        internal_link: requestType === "custom" ? internalLink.trim() : null,
        action_type: formMode === "relaunch" ? "relaunch" : "new",
        parent_request_id: formMode === "relaunch" ? parentRequestId : null,
        target_placement_id: null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      const msg =
        formMode === "extend"
          ? "Demande de prolongation envoyée"
          : formMode === "relaunch"
            ? "Relance envoyée — en attente d'examen"
            : "Demande envoyée avec succès !";
      toast.success(msg);
      queryClient.invalidateQueries({ queryKey: ["vendor-featured-requests", storeId] });
      queryClient.invalidateQueries({ queryKey: ["vendor-active-featured-placements", storeId] });
      resetForm();
    },
    onError: (err: any) => toast.error(friendlyInsertError(err)),
    onSettled: () => setUploading(false),
  });

  const toggleProduct = (id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const statusColors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
    rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    expired: "bg-muted text-muted-foreground",
  };

  const statusLabels: Record<string, string> = {
    pending: "En attente",
    approved: "Approuvée",
    rejected: "Rejetée",
    expired: "Expirée",
  };

  const actionLabels: Record<string, string> = {
    new: "Nouvelle",
    relaunch: "Relance",
    extend: "Prolongation",
  };

  const formTitle =
    formMode === "extend"
      ? "Prolonger une mise en avant"
      : formMode === "relaunch"
        ? "Relancer une demande"
        : "Demande de mise en avant";

  /** Relancer: past/rejected/expired, or approved once the linked placement is no longer active. Never for pending/extend. */
  const canRelaunch = (r: any) => {
    if (r.status === "pending") return false;
    if (r.action_type === "extend") return false;
    if (r.status === "approved" && activeSourceRequestIds.has(r.id)) return false;
    return true;
  };

  const linkedActivePlacement = (r: any) =>
    activePlacements.find((p: any) => p.source_request_id === r.id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Sparkles size={16} className="text-primary shrink-0" />
          <h2 className="text-sm font-bold text-foreground truncate">Mise en avant</h2>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 shrink-0"
        >
          <Plus size={14} /> Nouvelle demande
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Demandez une mise en avant, relancez une demande passée (avec ou sans modification), ou demandez une prolongation pendant qu&apos;elle est en cours. L&apos;administration examine chaque demande et fixe le tarif.
      </p>

      {activePlacements.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-foreground">En cours — prolongation</p>
          {activePlacements.map((p: any) => {
            const pending = pendingExtendPlacementIds.has(p.id);
            return (
              <div key={p.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                {p.image_url && (
                  <img src={p.image_url} alt="" className="w-10 h-14 object-cover rounded-md shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{p.title || "Sans titre"}</p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock size={10} />
                    Jusqu&apos;au {format(new Date(p.end_date), "dd/MM/yyyy HH:mm")}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => openExtend(p)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium border border-border rounded-lg hover:border-primary/40 hover:text-primary disabled:opacity-50"
                  title={pending ? "Demande déjà en attente" : "Demander une prolongation"}
                >
                  <CalendarPlus size={12} />
                  {pending ? "En attente" : "Prolonger"}
                </button>
              </div>
            );
          })}
        </div>
      )}

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
          <p className="text-xs font-medium text-foreground">Historique des demandes</p>
          {requests.map((r: any) => {
            const activeLinked = linkedActivePlacement(r);
            return (
              <div key={r.id} className="bg-card border border-border rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground min-w-0">
                    {r.action_type === "extend"
                      ? "Prolongation"
                      : r.request_type === "custom"
                        ? "Annonce libre"
                        : `${r.product_ids?.length || 0} produit(s)`}
                    {" · "}
                    {r.desired_duration_days || 7}j
                  </p>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {r.action_type && r.action_type !== "new" && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary">
                        {actionLabels[r.action_type] || r.action_type}
                      </span>
                    )}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColors[r.status] || ""}`}>
                      {statusLabels[r.status] || r.status}
                    </span>
                  </div>
                </div>
                {r.image_url && (
                  <img src={r.image_url} alt="" className="w-20 h-10 object-cover rounded-md" />
                )}
                {r.internal_link && (
                  <p className="text-[10px] text-primary flex items-center gap-1"><LinkIcon size={10} /> {r.internal_link}</p>
                )}
                {r.message && <p className="text-xs text-muted-foreground line-clamp-2">{r.message}</p>}
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
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
                <div className="pt-1 flex flex-wrap gap-2">
                  {activeLinked && (
                    <button
                      type="button"
                      disabled={pendingExtendPlacementIds.has(activeLinked.id)}
                      onClick={() => openExtend(activeLinked)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium border border-border rounded-lg hover:border-primary/40 hover:text-primary disabled:opacity-50"
                    >
                      <CalendarPlus size={12} /> Prolonger
                    </button>
                  )}
                  {canRelaunch(r) && (
                    <button
                      type="button"
                      onClick={() => openRelaunch(r)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium border border-border rounded-lg hover:border-primary/40 hover:text-primary"
                    >
                      <RotateCcw size={12} /> Relancer
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={(v) => { if (!v) resetForm(); }}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="pr-10 text-base leading-snug">{formTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 min-w-0">
            {formMode === "relaunch" && (
              <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                Formulaire prérempli depuis votre demande précédente. Modifiez ce que vous voulez, puis renvoyez — l&apos;admin réexaminera.
              </p>
            )}

            {formMode === "extend" ? (
              <>
                <div className="rounded-lg border border-border p-3 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Emplacement</p>
                  <p className="text-sm font-medium text-foreground">{extendPlacementLabel}</p>
                  {imagePreview && (
                    <img src={imagePreview} alt="" className="mt-2 w-16 h-24 object-cover rounded-md" />
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Jours à ajouter * <span className="text-muted-foreground/60">({MIN_DAYS}–{MAX_DAYS})</span>
                  </label>
                  <Input
                    type="number"
                    min={MIN_DAYS}
                    max={MAX_DAYS}
                    value={durationDays}
                    onChange={(e) => setDurationDays(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Message (optionnel)</label>
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Ex. : article très cliqué, souhaitons prolonger…"
                    rows={3}
                    className="mt-1"
                  />
                </div>
              </>
            ) : (
              <>
                <div className="min-w-0">
                  <label className="text-xs font-medium text-muted-foreground">Type de demande</label>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    <button
                      type="button"
                      onClick={() => setRequestType("product")}
                      className={`flex-1 min-w-[8rem] px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                        requestType === "product"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      Produits approuvés
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequestType("custom")}
                      className={`flex-1 min-w-[8rem] px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                        requestType === "custom"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      Annonce libre
                    </button>
                  </div>
                </div>

                {requestType === "product" && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Sélectionnez les produits à mettre en avant</label>
                    {products.length === 0 ? (
                      <p className="text-xs text-muted-foreground mt-1">Aucun produit publié disponible.</p>
                    ) : (
                      <div className="mt-1.5 max-h-40 overflow-y-auto space-y-1 border border-border rounded-lg p-2 min-w-0">
                        {products.map((p) => (
                          <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer min-w-0">
                            <input
                              type="checkbox"
                              checked={selectedProductIds.includes(p.id)}
                              onChange={() => toggleProduct(p.id)}
                              className="rounded border-border text-primary focus:ring-primary shrink-0"
                            />
                            <span className="text-sm text-foreground truncate flex-1 min-w-0">{p.name_fr}</span>
                            <span className="text-xs text-muted-foreground shrink-0 tabular-nums">${p.price}</span>
                          </label>
                        ))}
                      </div>
                    )}
                    {selectedProductIds.length > 0 && (
                      <p className="text-[10px] text-primary mt-1">{selectedProductIds.length} produit(s) sélectionné(s)</p>
                    )}
                  </div>
                )}

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

                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Image de l&apos;annonce <span className="text-muted-foreground/60">(300×600 recommandé · Max 3 Mo)</span>
                  </label>
                  {imagePreview ? (
                    <div className="relative mt-1.5 w-[150px] h-[300px] rounded-lg overflow-hidden border border-border">
                      <img src={imagePreview} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => { setImageFile(null); setImagePreview(null); setExistingImageUrl(null); }}
                        className="absolute top-1 right-1 p-1 bg-card/90 rounded-full hover:bg-destructive/20"
                      >
                        <X size={12} className="text-destructive" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="mt-1.5 w-full border-2 border-dashed border-border rounded-lg py-8 flex flex-col items-center gap-2 hover:border-primary/40 transition-colors"
                    >
                      <ImagePlus size={24} className="text-muted-foreground" />
                      <span className="text-xs text-muted-foreground text-center px-2 break-words">
                        Cliquez pour importer une image
                      </span>
                    </button>
                  )}
                  {imagePreview && !imageFile && (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="mt-1.5 text-[11px] text-primary hover:underline"
                    >
                      Remplacer l&apos;image
                    </button>
                  )}
                  <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageSelect} />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Durée souhaitée (jours) <span className="text-muted-foreground/60">({MIN_DAYS}–{MAX_DAYS})</span>
                  </label>
                  <Input
                    type="number"
                    min={MIN_DAYS}
                    max={MAX_DAYS}
                    value={durationDays}
                    onChange={(e) => setDurationDays(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground">Message (optionnel)</label>
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Précisions sur votre demande..."
                    rows={3}
                    className="mt-1"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <button type="button" onClick={resetForm} className="px-4 py-2 text-sm border border-border rounded-lg">
              Annuler
            </button>
            <button
              type="button"
              onClick={() => submitMutation.mutate()}
              disabled={
                formMode === "extend"
                  ? !targetPlacementId || !durationDays || submitMutation.isPending
                  : (requestType === "product" && selectedProductIds.length === 0) ||
                    (requestType === "custom" && !internalLink.trim()) ||
                    submitMutation.isPending ||
                    uploading
              }
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg disabled:opacity-50"
            >
              {submitMutation.isPending || uploading
                ? "Envoi..."
                : formMode === "extend"
                  ? "Demander la prolongation"
                  : formMode === "relaunch"
                    ? "Relancer"
                    : "Envoyer la demande"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
