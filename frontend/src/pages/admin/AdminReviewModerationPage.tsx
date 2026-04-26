import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, X, Star, ImageIcon, Loader2, Eye } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useAuth } from "@/contexts/AuthContext";

type ReviewFilter = "pending" | "approved" | "all";

export default function AdminReviewModerationPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [filter, setFilter] = useState<ReviewFilter>("pending");
  const [previewImages, setPreviewImages] = useState<string[] | null>(null);

  const { data: bonusPct = 0.10 } = useQuery({
    queryKey: ["review-bonus-pct"],
    queryFn: async () => {
      const { data } = await supabase.from("platform_settings").select("value").eq("key", "review_bonus").maybeSingle();
      return Number((data?.value as any)?.bonus_pct) || 0.10;
    },
  });

  const { data: reviews, isLoading } = useQuery({
    queryKey: ["admin-reviews", filter],
    queryFn: async () => {
      let query = (supabase as any)
        .from("reviews")
        .select("*, profiles:user_id(first_name, last_name, email, avatar_url), products:product_id(name, slug)")
        .order("created_at", { ascending: false })
        .limit(200);

      if (filter === "pending") {
        query = query.eq("is_approved", false);
      } else if (filter === "approved") {
        query = query.eq("is_approved", true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      if (!user?.id) throw new Error("Session admin non chargée");
      const { data, error } = await (supabase as any)
        .from("reviews")
        .update({
          is_approved: true,
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
        })
        .eq("id", reviewId)
        .select("id, is_approved")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Mise à jour bloquée (permission ou avis introuvable)");
      return data;
    },
    onSuccess: async () => {
      toast.success("Avis approuvé. Points bonus crédités si éligible.");
      await queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
      await queryClient.refetchQueries({ queryKey: ["admin-reviews"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erreur lors de l'approbation"),
  });

  const rejectMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      const { error } = await (supabase as any)
        .from("reviews")
        .delete()
        .eq("id", reviewId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Avis supprimé");
      queryClient.invalidateQueries({ queryKey: ["admin-reviews"] });
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  const filterTabs: { key: ReviewFilter; label: string }[] = [
    { key: "pending", label: "En attente" },
    { key: "approved", label: "Approuvés" },
    { key: "all", label: "Tous" },
  ];

  const pendingCount = reviews?.filter((r: any) => !r.is_approved).length ?? 0;

  return (
    <AdminLayout title="Modération des avis">
      <div className="p-4 md:p-6 space-y-4 max-w-5xl">
        {/* Info banner */}
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm text-foreground">
          <strong>Bonus avis :</strong> Lorsque vous approuvez un avis contenant des photos, le client reçoit automatiquement <strong>{bonusPct}%</strong> du sous-total de sa commande en ZandoPoints.
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                filter === tab.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {tab.key === "pending" && pendingCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full bg-destructive text-destructive-foreground">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Reviews list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-primary" size={24} />
          </div>
        ) : !reviews || reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Aucun avis à afficher.</p>
        ) : (
          <div className="space-y-3">
            {reviews.map((review: any) => {
              const profile = review.profiles;
              const product = review.products;
              const hasImages = review.images && review.images.length > 0;
              const userName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.email || "Anonyme";

              return (
                <div
                  key={review.id}
                  className="p-4 bg-card border border-border rounded-xl space-y-3"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">{userName}</span>
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              size={12}
                              className={i < review.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}
                            />
                          ))}
                        </div>
                        {review.is_verified_purchase && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-600 font-medium">
                            Achat vérifié
                          </span>
                        )}
                        {review.is_approved && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                            Approuvé
                          </span>
                        )}
                        {review.reward_granted && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-medium">
                            Points crédités
                          </span>
                        )}
                      </div>
                      {product && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Produit : <strong>{product.name}</strong>
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {review.created_at && format(new Date(review.created_at), "dd MMM yyyy à HH:mm", { locale: fr })}
                      </p>
                    </div>

                    {/* Actions */}
                    {!review.is_approved && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => approveMutation.mutate(review.id)}
                          disabled={approveMutation.isPending}
                          className="p-2 rounded-lg bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors"
                          title="Approuver"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm("Supprimer cet avis définitivement ?")) {
                              rejectMutation.mutate(review.id);
                            }
                          }}
                          disabled={rejectMutation.isPending}
                          className="p-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                          title="Supprimer"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Comment */}
                  {review.comment && (
                    <p className="text-sm text-foreground leading-relaxed">{review.comment}</p>
                  )}

                  {/* Images */}
                  {hasImages && (
                    <div className="flex gap-2 flex-wrap">
                      {review.images.map((img: string, i: number) => (
                        <button
                          key={i}
                          onClick={() => setPreviewImages(review.images)}
                          className="w-16 h-16 rounded-lg overflow-hidden border border-border hover:border-primary transition-colors"
                        >
                          <img src={img} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <ImageIcon size={12} />
                        {review.images.length} photo{review.images.length > 1 ? "s" : ""}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Image preview modal */}
        {previewImages && (
          <div
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setPreviewImages(null)}
          >
            <div className="max-w-2xl w-full max-h-[80vh] overflow-auto bg-card rounded-xl border border-border p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Photos de l'avis</span>
                <button onClick={() => setPreviewImages(null)} className="p-1 rounded hover:bg-muted">
                  <X size={16} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {previewImages.map((img, i) => (
                  <img key={i} src={img} alt={`Photo ${i + 1}`} className="w-full rounded-lg object-cover" />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
