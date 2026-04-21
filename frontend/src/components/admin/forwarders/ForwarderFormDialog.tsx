import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Upload, X } from "lucide-react";

export interface Forwarder {
  id?: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  description?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  website_url?: string | null;
  price_multiplier?: number;
  is_active?: boolean;
}

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  forwarder?: Forwarder | null;
}

export function ForwarderFormDialog({ open, onOpenChange, forwarder }: Props) {
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<Forwarder>({
    name: "", slug: "", logo_url: "", description: "",
    contact_email: "", contact_phone: "", website_url: "",
    price_multiplier: 1.0, is_active: true,
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (forwarder) setForm({ ...forwarder });
    else setForm({
      name: "", slug: "", logo_url: "", description: "",
      contact_email: "", contact_phone: "", website_url: "",
      price_multiplier: 1.0, is_active: true,
    });
  }, [forwarder, open]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${form.slug || slugify(form.name) || "fwd"}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("forwarder-logos").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("forwarder-logos").getPublicUrl(path);
      setForm((f) => ({ ...f, logo_url: data.publicUrl }));
      toast.success("Logo téléversé");
    } catch (e: any) {
      toast.error(e.message ?? "Échec du téléversement");
    } finally {
      setUploading(false);
    }
  };

  const save = useMutation({
    mutationFn: async (payload: Forwarder) => {
      const body = {
        name: payload.name.trim(),
        slug: (payload.slug || slugify(payload.name)).trim(),
        logo_url: payload.logo_url || null,
        description: payload.description || null,
        contact_email: payload.contact_email || null,
        contact_phone: payload.contact_phone || null,
        website_url: payload.website_url || null,
        price_multiplier: Number(payload.price_multiplier) || 1.0,
        is_active: !!payload.is_active,
      };
      if (payload.id) {
        const { error } = await supabase.from("forwarders").update(body).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("forwarders").insert(body);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(forwarder?.id ? "Transitaire mis à jour" : "Transitaire créé");
      qc.invalidateQueries({ queryKey: ["admin-forwarders"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erreur"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{forwarder?.id ? "Modifier le transitaire" : "Nouveau transitaire"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-sm">Nom *</Label>
            <Input
              value={form.name}
              onChange={(e) => {
                const name = e.target.value;
                setForm((f) => ({ ...f, name, slug: f.id ? f.slug : slugify(name) }));
              }}
              placeholder="Ex: DHL Express"
            />
          </div>

          <div>
            <Label className="text-sm">Slug *</Label>
            <Input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })}
              placeholder="dhl-express"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Identifiant unique (a-z, 0-9, tirets)</p>
          </div>

          <div>
            <Label className="text-sm">Logo</Label>
            <div className="flex items-center gap-3 mt-1">
              {form.logo_url && (
                <div className="relative w-16 h-16 rounded border border-border bg-muted/30 flex items-center justify-center overflow-hidden">
                  <img src={form.logo_url} alt="logo" className="max-w-full max-h-full object-contain" />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, logo_url: "" })}
                    className="absolute top-0 right-0 bg-destructive text-destructive-foreground p-0.5 rounded-bl"
                  ><X size={10} /></button>
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInput.current?.click()}
                disabled={uploading || !form.name}
              >
                {uploading ? <Loader2 className="animate-spin mr-2" size={14} /> : <Upload className="mr-2" size={14} />}
                {form.logo_url ? "Changer" : "Téléverser"}
              </Button>
              <input
                ref={fileInput}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUpload(f);
                  e.target.value = "";
                }}
              />
            </div>
          </div>

          <div>
            <Label className="text-sm">Description</Label>
            <Textarea
              rows={2}
              value={form.description ?? ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Présentation courte affichée au client"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sm">Email contact</Label>
              <Input
                type="email"
                value={form.contact_email ?? ""}
                onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-sm">Téléphone</Label>
              <Input
                value={form.contact_phone ?? ""}
                onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label className="text-sm">Site web</Label>
            <Input
              value={form.website_url ?? ""}
              onChange={(e) => setForm({ ...form, website_url: e.target.value })}
              placeholder="https://"
            />
          </div>

          <div>
            <Label className="text-sm">Multiplicateur de prix</Label>
            <Input
              type="number"
              step="0.01"
              min="0.1"
              max="10"
              value={form.price_multiplier ?? 1.0}
              onChange={(e) => setForm({ ...form, price_multiplier: parseFloat(e.target.value) })}
            />
            <p className="text-[11px] text-muted-foreground mt-1">1.0 = prix de base. 1.2 = +20%, 0.9 = −10%.</p>
          </div>

          <div className="flex items-center justify-between p-3 border border-border rounded-lg">
            <Label className="text-sm">Actif</Label>
            <Switch checked={!!form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={() => save.mutate(form)} disabled={save.isPending || !form.name || !form.slug}>
            {save.isPending && <Loader2 className="animate-spin mr-2" size={14} />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}