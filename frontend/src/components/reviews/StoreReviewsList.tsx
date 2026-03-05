import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Star, ThumbsUp, ShieldCheck, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  storeId: string;
}

export function StoreReviewsList({ storeId }: Props) {
  const { data: reviews = [], isLoading, refetch } = useQuery({
    queryKey: ["store-reviews", storeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("store_reviews")
        .select("*")
        .eq("store_id", storeId)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : "0";

  const handleHelpful = async (reviewId: string) => {
    await supabase
      .from("store_reviews")
      .update({ helpful_count: reviews.find(r => r.id === reviewId)!.helpful_count + 1 })
      .eq("id", reviewId);
    toast.success("Merci pour votre retour !");
    refetch();
  };

  if (isLoading) {
    return <div className="flex justify-center py-6"><Loader2 className="animate-spin text-primary" size={20} /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <Star size={20} className="fill-amber-400 text-amber-400" />
          <span className="text-2xl font-bold text-foreground">{avgRating}</span>
        </div>
        <span className="text-sm text-muted-foreground">({reviews.length} avis boutique)</span>
      </div>

      {reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">Aucun avis pour cette boutique.</p>
      ) : (
        <div className="space-y-3">
          {reviews.map(r => (
            <div key={r.id} className="bg-card border border-border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} size={12} className={i < r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"} />
                  ))}
                  {r.is_verified_purchase && (
                    <span className="ml-2 flex items-center gap-0.5 text-[10px] text-emerald-600">
                      <ShieldCheck size={10} /> Achat vérifié
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {format(new Date(r.created_at), "dd MMM yyyy", { locale: fr })}
                </span>
              </div>
              {r.comment && <p className="text-xs text-foreground">{r.comment}</p>}
              <Button
                variant="ghost"
                size="sm"
                className="text-[11px] text-muted-foreground h-6 px-2"
                onClick={() => handleHelpful(r.id)}
              >
                <ThumbsUp size={10} className="mr-1" /> Utile ({r.helpful_count})
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
