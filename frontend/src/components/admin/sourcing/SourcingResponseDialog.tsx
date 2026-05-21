import { useEffect, useState } from "react";
import { Loader2, Send, Upload, X } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { SOURCING_COLOR_PALETTE, SOURCING_CURRENCIES, SOURCING_COLOR_KEYS } from "@/lib/sourcing-palette";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  request: { id: string; user_id: string; product_name: string | null } | null;
  existing?: any;
  onSaved: () => void;
}

const responseSchema = z.object({
  product_name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  price: z.number().min(0).optional().nullable(),
  currency: z.enum(SOURCING_CURRENCIES),
  min_quantity: z.number().int().min(1).optional().nullable(),
  colors: z.array(z.enum(SOURCING_COLOR_KEYS as [string, ...string[]])).max(10),
});

export function SourcingResponseDialog({ open, onOpenChange, request, existing, onSaved }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState<string>("USD");
  const [moq, setMoq] = useState("");
  const [colors, setColors] = useState<string[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(existing?.product_name || request?.product_name || "");
      setDesc(existing?.description || "");
      setPrice(existing?.price != null ? String(existing.price) : "");
      setCurrency(existing?.currency || "USD");
      setMoq(existing?.min_quantity != null ? String(existing.min_quantity) : "");
      setColors(existing?.colors || []);
      setImagePath(existing?.image_url || null);
      setImageFile(null);
      setNotifyEmail(false);
    }
  }, [open, existing, request]);

  const toggleColor = (key: string) => {
    setColors((prev) => (prev.includes(key) ? prev.filter((c) => c !== key) : [...prev, key]));
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Format invalide", description: "Image uniquement.", variant: "destructive" });
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      toast({ title: "Trop volumineux", description: "Max 4 Mo.", variant: "destructive" });
      return;
    }
    setImageFile(file);
  };

  const onSave = async () => {
    if (!request || !user) return;
    const parsed = responseSchema.safeParse({
      product_name: name,
      description: desc,
      price: price ? Number(price) : null,
      currency,
      min_quantity: moq ? Number(moq) : null,
      colors,
    });
    if (!parsed.success) {
      toast({ title: "Champs invalides", description: parsed.error.issues[0]?.message, variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      let finalPath = imagePath;
      if (imageFile) {
        const ext = (imageFile.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
        // Admin/manager response images live under `responses/{request_id}/` for clear audit trail.
        const path = `responses/${request.id}/response-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("sourcing-images").upload(path, imageFile, {
          contentType: imageFile.type,
          upsert: true,
        });
        if (upErr) throw upErr;
        finalPath = path;
      }

      const payload = {
        request_id: request.id,
        responder_id: user.id,
        product_name: name.trim(),
        description: desc.trim() || null,
        price: price ? Number(price) : null,
        currency,
        min_quantity: moq ? Number(moq) : null,
        colors,
        image_url: finalPath,
      };

      if (existing?.id) {
        const { error } = await supabase.from("product_sourcing_responses" as any).update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("product_sourcing_responses" as any).insert(payload);
        if (error) throw error;
      }

      // Optionally notify by email via edge function
      if (notifyEmail) {
        try {
          await supabase.functions.invoke("notify-sourcing-response", { body: { request_id: request.id } });
        } catch (err) {
          console.warn("notify-sourcing-response failed", err);
        }
      }

      toast({ title: "Réponse enregistrée" });
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Répondre à la demande</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>Nom du produit *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={2000} rows={3} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Label>Prix</Label>
              <Input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div>
              <Label>Devise</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SOURCING_CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Quantité minimum</Label>
            <Input type="number" min="1" step="1" value={moq} onChange={(e) => setMoq(e.target.value)} />
          </div>

          <div>
            <Label>Couleurs disponibles</Label>
            <div className="grid grid-cols-5 gap-2 mt-1">
              {SOURCING_COLOR_PALETTE.map((c) => {
                const active = colors.includes(c.key);
                return (
                  <button
                    type="button"
                    key={c.key}
                    onClick={() => toggleColor(c.key)}
                    title={c.label}
                    className={`flex flex-col items-center gap-1 p-1 rounded-lg border transition-all ${
                      active ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"
                    }`}
                  >
                    <span
                      className="block w-7 h-7 rounded-full border border-border"
                      style={{ background: `hsl(${c.hsl})` }}
                    />
                    <span className="text-[10px] text-muted-foreground truncate w-full text-center">{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label>Image de référence</Label>
            <div className="flex items-center gap-2">
              <label className="flex-1 cursor-pointer flex items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-3 py-3 text-sm text-muted-foreground hover:bg-muted/50">
                <Upload size={16} />
                {imageFile ? imageFile.name : imagePath ? "Remplacer l'image" : "Choisir une image"}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
              </label>
              {(imageFile || imagePath) && (
                <button
                  type="button"
                  onClick={() => { setImageFile(null); setImagePath(null); }}
                  className="rounded-lg border border-border p-2 text-muted-foreground hover:text-destructive"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <Checkbox checked={notifyEmail} onCheckedChange={(v) => setNotifyEmail(!!v)} />
            Notifier le client par email
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="animate-spin mr-2" size={16} /> : <Send size={16} className="mr-2" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}