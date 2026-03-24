import { useState } from "react";
import { Star, X, Loader2, Banknote } from "lucide-react";
import { fromTable } from "@/lib/supabase-helpers";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RiderRatingModalProps {
  orderId: string;
  riderId: string;
  riderName: string;
  userId: string;
  deliveryId?: string | null;
  tippingEnabled?: boolean;
  maxTip?: number;
  onClose: () => void;
}

export function RiderRatingModal({ orderId, riderId, riderName, userId, deliveryId, tippingEnabled = false, maxTip = 20, onClose }: RiderRatingModalProps) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [tip, setTip] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (rating === 0) { toast.error("Veuillez sélectionner une note"); return; }
    setSubmitting(true);
    try {
      // Insert rating
      const payload: any = {
        order_id: orderId,
        rider_id: riderId,
        user_id: userId,
        rating,
        comment: comment.trim() || null,
      };
      if (deliveryId) payload.delivery_id = deliveryId;
      const { error } = await fromTable("rider_ratings").insert(payload);
      if (error) throw error;

      // Save tip if enabled and > 0
      if (tippingEnabled && tip > 0) {
        await supabase.from("orders").update({ tip_amount: tip } as any).eq("id", orderId);
      }

      toast.success("Merci pour votre évaluation !");
      onClose();
    } catch (e: any) {
      if (e?.code === "23505") {
        toast.info("Vous avez déjà noté cette livraison");
        onClose();
      } else {
        toast.error(e.message || "Erreur lors de l'envoi");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card rounded-t-2xl sm:rounded-xl w-full max-w-md p-5 space-y-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Notez votre livreur</h3>
          <button onClick={onClose} className="text-muted-foreground"><X size={18} /></button>
        </div>

        <p className="text-xs text-muted-foreground">Comment s'est passée la livraison avec <span className="font-medium text-foreground">{riderName}</span> ?</p>

        {/* Stars */}
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(n)}
              className="active:scale-110 transition-transform touch-manipulation"
            >
              <Star
                size={32}
                className={`transition-colors ${(hover || rating) >= n ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30"}`}
              />
            </button>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          {rating === 1 && "Mauvais"}{rating === 2 && "Moyen"}{rating === 3 && "Correct"}{rating === 4 && "Bien"}{rating === 5 && "Excellent !"}
        </p>

        {/* Comment */}
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Un commentaire ? (optionnel)"
          className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-primary/20"
        />

        {/* Tip section */}
        {tippingEnabled && (
          <div className="border-t border-border pt-3">
            <p className="text-xs font-medium text-foreground flex items-center gap-1.5 mb-2">
              <Banknote size={14} className="text-primary" /> Laisser un pourboire
            </p>
            <div className="flex gap-2">
              {[1, 2, 5].map((amount) => (
                <button
                  key={amount}
                  onClick={() => setTip(tip === amount ? 0 : amount)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${tip === amount ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-foreground border-border"}`}
                >
                  ${amount}
                </button>
              ))}
              <input
                type="number"
                min={0}
                max={maxTip}
                value={tip || ""}
                onChange={(e) => setTip(Math.min(Number(e.target.value) || 0, maxTip))}
                placeholder="Libre"
                className="flex-1 px-2 py-2 bg-muted border border-border rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        )}

        <button
          onClick={submit}
          disabled={rating === 0 || submitting}
          className="w-full py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium flex items-center justify-center gap-2 active:scale-95 touch-manipulation disabled:opacity-50"
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
          {submitting ? "Envoi..." : "Envoyer mon évaluation"}
        </button>
      </div>
    </div>
  );
}
