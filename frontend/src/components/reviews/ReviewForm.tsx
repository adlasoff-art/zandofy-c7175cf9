import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { StarRatingInput } from "./StarRatingInput";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ImagePlus, X, Loader2, BadgeCheck, ShieldAlert } from "lucide-react";
import { sanitizeExtension } from "@/utils/sanitize-filename";

interface ReviewFormProps {
  productId: string;
  onSuccess?: () => void;
}

export function ReviewForm({ productId, onSuccess }: ReviewFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  // Check if user has a delivered order for this product
  const { data: hasVerifiedPurchase, isLoading: checkingPurchase } = useQuery({
    queryKey: ["verified-purchase", productId, user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await supabase
        .from("order_items")
        .select("id, orders!inner(status, user_id)")
        .eq("product_id", productId)
        .eq("orders.user_id", user.id)
        .eq("orders.status", "delivered")
        .limit(1);
      if (error) return false;
      return (data?.length ?? 0) > 0;
    },
    enabled: !!user,
  });

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).slice(0, 5 - images.length);
    const newPreviews = newFiles.map((f) => URL.createObjectURL(f));
    setImages((prev) => [...prev, ...newFiles]);
    setPreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setImages((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Non connecté");
      if (rating === 0) throw new Error("Veuillez sélectionner une note");
      if (comment.trim().length < 10)
        throw new Error("Le commentaire doit faire au moins 10 caractères");

      // Upload images
      const imageUrls: string[] = [];
      for (const file of images) {
        const ext = sanitizeExtension(file.name, "jpg");
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("review-images")
          .upload(path, file, { upsert: false });
        if (uploadErr) throw uploadErr;
        const { data: urlData } = supabase.storage
          .from("review-images")
          .getPublicUrl(path);
        imageUrls.push(urlData.publicUrl);
      }

      const { error } = await supabase.from("reviews").insert({
        product_id: productId,
        user_id: user.id,
        rating,
        comment: comment.trim(),
        images: imageUrls,
        is_verified_purchase: !!hasVerifiedPurchase,
      });
      if (error) {
        if (error.code === "23505")
          throw new Error("Vous avez déjà donné votre avis sur ce produit");
        throw error;
      }
    },
    onSuccess: () => {
      toast({ title: "Merci !", description: "Votre avis a été publié." });
      setRating(0);
      setComment("");
      previews.forEach(URL.revokeObjectURL);
      setImages([]);
      setPreviews([]);
      queryClient.invalidateQueries({ queryKey: ["reviews", productId] });
      queryClient.invalidateQueries({ queryKey: ["rating-summary", productId] });
      onSuccess?.();
    },
    onError: (err: any) => {
      toast({
        title: "Erreur",
        description: err.message || "Impossible de publier l'avis",
        variant: "destructive",
      });
    },
  });

  if (!user) {
    return (
      <div className="p-4 bg-muted/50 rounded-sm text-center text-sm text-muted-foreground">
        Connectez-vous pour donner votre avis
      </div>
    );
  }

  return (
    <div className="p-4 bg-card border border-border rounded-sm space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Donner mon avis</h3>
        {hasVerifiedPurchase && (
          <span className="inline-flex items-center gap-1 text-xs text-primary font-medium bg-primary/10 px-2 py-1 rounded">
            <BadgeCheck size={12} /> Achat vérifié
          </span>
        )}
      </div>

      {!hasVerifiedPurchase && !checkingPurchase && (
        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-sm text-xs text-muted-foreground">
          <ShieldAlert size={14} className="shrink-0 mt-0.5" />
          <span>Vous n'avez pas encore acheté ce produit. Votre avis sera publié sans le badge "Achat vérifié".</span>
        </div>
      )}

      <div>
        <label className="text-sm text-muted-foreground mb-1 block">Note</label>
        <StarRatingInput value={rating} onChange={setRating} />
      </div>

      <div>
        <label className="text-sm text-muted-foreground mb-1 block">
          Commentaire (min. 10 caractères)
        </label>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Partagez votre expérience avec ce produit..."
          className="resize-none"
          rows={4}
        />
      </div>

      <div>
        <label className="text-sm text-muted-foreground mb-1 block">
          Photos ({images.length}/5)
        </label>
        <div className="flex gap-2 flex-wrap">
          {previews.map((src, i) => (
            <div key={i} className="relative w-20 h-20 rounded-sm overflow-hidden border border-border">
              <img src={src} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeImage(i)}
                className="absolute top-0.5 right-0.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
              >
                <X size={12} />
              </button>
            </div>
          ))}
          {images.length < 5 && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-20 h-20 rounded-sm border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
            >
              <ImagePlus size={20} />
              <span className="text-[10px] mt-1">Ajouter</span>
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      <Button
        onClick={() => submitMutation.mutate()}
        disabled={submitMutation.isPending}
        className="w-full"
      >
        {submitMutation.isPending && <Loader2 size={16} className="animate-spin mr-2" />}
        Publier mon avis
      </Button>
    </div>
  );
}
