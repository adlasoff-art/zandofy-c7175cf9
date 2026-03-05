import { useState } from "react";
import { Star, ThumbsUp, BadgeCheck } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

export interface ReviewData {
  id: string;
  rating: number;
  comment: string;
  images: string[];
  is_verified_purchase: boolean;
  helpful_count: number;
  created_at: string;
  user_id: string;
  profiles?: { first_name: string | null; last_name: string | null; avatar_url: string | null } | null;
}

interface ReviewListProps {
  reviews: ReviewData[];
  isLoading: boolean;
}

function anonymize(first?: string | null, last?: string | null): string {
  const f = first || "U";
  const l = last ? `${last[0]}***` : "";
  return `${f} ${l}`.trim();
}

export function ReviewList({ reviews, isLoading }: ReviewListProps) {
  const [helpedIds, setHelpedIds] = useState<Set<string>>(new Set());
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const toggleHelpful = async (reviewId: string) => {
    if (helpedIds.has(reviewId)) return;
    setHelpedIds((prev) => new Set(prev).add(reviewId));
    await supabase.rpc("increment_helpful", { review_id: reviewId });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 bg-card border border-border rounded-sm space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="w-8 h-8 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        ))}
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        Aucun avis pour ce filtre.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {reviews.map((review) => {
          const name = anonymize(
            review.profiles?.first_name,
            review.profiles?.last_name
          );
          const initial = (review.profiles?.first_name || "U")[0].toUpperCase();
          const helped = helpedIds.has(review.id);

          return (
            <div
              key={review.id}
              className="p-4 bg-card border border-border rounded-sm"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {review.profiles?.avatar_url ? (
                    <img
                      src={review.profiles.avatar_url}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                      {initial}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {name}
                    </span>
                    {review.is_verified_purchase && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-primary font-medium">
                        <BadgeCheck size={12} /> Achat vérifié
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(review.created_at).toLocaleDateString("fr-FR")}
                </span>
              </div>

              <div className="flex gap-0.5 mb-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    size={12}
                    className={
                      s <= review.rating
                        ? "fill-accent text-accent"
                        : "text-border"
                    }
                  />
                ))}
              </div>

              <p className="text-sm text-foreground mb-2">{review.comment}</p>

              {review.images && review.images.length > 0 && (
                <div className="flex gap-2 mb-3">
                  {review.images.map((url, i) => (
                    <button
                      key={i}
                      onClick={() => setLightboxUrl(url)}
                      className="w-16 h-16 rounded-sm overflow-hidden border border-border hover:opacity-80 transition-opacity"
                    >
                      <img
                        src={url}
                        alt="Photo avis"
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}

              <button
                onClick={() => toggleHelpful(review.id)}
                className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-sm border transition-colors ${
                  helped
                    ? "border-primary text-primary bg-primary/5"
                    : "border-border text-muted-foreground hover:text-primary hover:border-primary"
                }`}
              >
                <ThumbsUp size={12} /> Utile (
                {review.helpful_count + (helped ? 1 : 0)})
              </button>
            </div>
          );
        })}
      </div>

      {/* Lightbox */}
      <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
        <DialogContent className="max-w-2xl p-2">
          {lightboxUrl && (
            <img
              src={lightboxUrl}
              alt="Photo agrandie"
              className="w-full h-auto rounded-sm"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
