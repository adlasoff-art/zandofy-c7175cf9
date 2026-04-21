import { useEffect, useState } from "react";
import { z } from "zod";
import { Loader2, Upload, X, ImagePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const MAX_TOTAL_BYTES = 4 * 1024 * 1024; // 4 MB
const MAX_FILES = 2;
const DAILY_LIMIT = 5;

const requestSchema = z.object({
  product_name: z
    .string()
    .trim()
    .max(200, "Le nom du produit doit faire 200 caractères max")
    .optional()
    .or(z.literal("")),
  note: z
    .string()
    .trim()
    .max(500, "La note doit faire 500 caractères max")
    .optional()
    .or(z.literal("")),
});

interface Props {
  onSubmitted?: () => void;
}

export function SourcingRequestForm({ onSubmitted }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [productName, setProductName] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [todayCount, setTodayCount] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchCount = async () => {
      const since = new Date();
      since.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("product_sourcing_requests" as any)
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", since.toISOString());
      setTodayCount(count ?? 0);
    };
    fetchCount();
  }, [user]);

  const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
  const remaining = todayCount === null ? null : Math.max(0, DAILY_LIMIT - todayCount);
  const quotaReached = remaining !== null && remaining <= 0;

  const handleFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const next = [...files];
    for (const f of Array.from(incoming)) {
      if (next.length >= MAX_FILES) break;
      if (!f.type.startsWith("image/")) {
        toast({ title: "Format non supporté", description: `${f.name} n'est pas une image.`, variant: "destructive" });
        continue;
      }
      if (totalBytes + f.size > MAX_TOTAL_BYTES) {
        toast({ title: "Taille maximale dépassée", description: "Le cumul ne doit pas dépasser 4 Mo.", variant: "destructive" });
        continue;
      }
      next.push(f);
    }
    setFiles(next);
  };

  const removeFile = (idx: number) => setFiles(files.filter((_, i) => i !== idx));

  const reset = () => {
    setProductName("");
    setNote("");
    setFiles([]);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (quotaReached) {
      toast({ title: "Quota atteint", description: "Vous avez atteint la limite de 5 demandes pour aujourd'hui.", variant: "destructive" });
      return;
    }

    const parsed = requestSchema.safeParse({ product_name: productName, note });
    if (!parsed.success) {
      toast({ title: "Champs invalides", description: parsed.error.issues[0]?.message, variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      // Upload images to private bucket
      const uploaded: string[] = [];
      for (const file of files) {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("sourcing-images").upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (upErr) throw upErr;
        uploaded.push(path);
      }

      const { error } = await supabase
        .from("product_sourcing_requests" as any)
        .insert({
          user_id: user.id,
          product_name: productName.trim() || null,
          note: note.trim() || null,
          images: uploaded,
        });

      if (error) {
        if (error.message?.includes("sourcing_rate_limit_exceeded")) {
          toast({ title: "Quota atteint", description: "Maximum 5 demandes par jour.", variant: "destructive" });
        } else {
          throw error;
        }
      } else {
        toast({ title: "Demande envoyée", description: "Notre équipe va rechercher ce produit pour vous." });
        reset();
        setTodayCount((c) => (c ?? 0) + 1);
        onSubmitted?.();
      }
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message ?? "Échec de l'envoi", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        Demandes restantes aujourd'hui :{" "}
        <strong className="text-foreground">{remaining ?? "…"} / {DAILY_LIMIT}</strong>
      </div>

      <div>
        <Label htmlFor="product_name">Nom du produit (optionnel)</Label>
        <Input
          id="product_name"
          placeholder="Ex : Sneakers blanches taille 42"
          maxLength={200}
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
        />
      </div>

      <div>
        <Label htmlFor="note">Détails (optionnel)</Label>
        <Textarea
          id="note"
          placeholder="Marque, taille, couleur, lien d'inspiration…"
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
        />
        <p className="mt-1 text-xs text-muted-foreground">{note.length}/500</p>
      </div>

      <div>
        <Label>Images (max 2, cumul ≤ 4 Mo)</Label>
        <div className="grid grid-cols-2 gap-2 mt-1">
          {files.map((f, idx) => (
            <div key={idx} className="relative aspect-square rounded-lg border border-border overflow-hidden bg-muted">
              <img src={URL.createObjectURL(f)} alt={f.name} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeFile(idx)}
                className="absolute top-1 right-1 rounded-full bg-background/90 p-1 text-foreground hover:bg-background"
                aria-label="Retirer"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {files.length < MAX_FILES && (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border bg-muted/30 text-xs text-muted-foreground hover:bg-muted/50">
              <ImagePlus size={20} />
              Ajouter une image
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </label>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {(totalBytes / 1024 / 1024).toFixed(2)} Mo / 4 Mo
        </p>
      </div>

      <Button type="submit" disabled={submitting || quotaReached} className="w-full">
        {submitting ? <Loader2 className="animate-spin mr-2" size={16} /> : <Upload size={16} className="mr-2" />}
        Envoyer la demande
      </Button>
    </form>
  );
}