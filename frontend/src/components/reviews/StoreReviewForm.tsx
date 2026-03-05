import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Star, Loader2 } from "lucide-react";

interface Props {
  storeId: string;
  orderId?: string;
  onSuccess: () => void;
}

export function StoreReviewForm({ storeId, orderId, onSuccess }: Props) {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!user || rating === 0) return;
    setLoading(true);

    const { error } = await supabase.from("store_reviews").insert({
      store_id: storeId,
      user_id: user.id,
      order_id: orderId || null,
      rating,
      comment: comment.trim(),
      is_verified_purchase: !!orderId,
    });

    if (error) {
      if (error.message.includes("duplicate")) {
        toast.error("Vous avez déjà laissé un avis pour cette boutique");
      } else {
        toast.error("Erreur lors de l'envoi de l'avis");
      }
    } else {
      toast.success("Avis envoyé !");
      setRating(0);
      setComment("");
      onSuccess();
    }
    setLoading(false);
  };

  if (!user) return null;

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <h4 className="text-sm font-bold text-foreground">Évaluer cette boutique</h4>

      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(s => (
          <button
            key={s}
            onClick={() => setRating(s)}
            onMouseEnter={() => setHover(s)}
            onMouseLeave={() => setHover(0)}
            className="transition-transform hover:scale-110"
          >
            <Star
              size={24}
              className={`${(hover || rating) >= s ? "fill-amber-400 text-amber-400" : "text-muted-foreground"} transition-colors`}
            />
          </button>
        ))}
      </div>

      <Textarea
        placeholder="Partagez votre expérience avec cette boutique..."
        value={comment}
        onChange={e => setComment(e.target.value)}
        className="text-sm min-h-[60px]"
        maxLength={500}
      />

      <Button size="sm" disabled={rating === 0 || loading} onClick={handleSubmit}>
        {loading && <Loader2 size={14} className="animate-spin mr-1" />}
        Envoyer l'avis
      </Button>
    </div>
  );
}
