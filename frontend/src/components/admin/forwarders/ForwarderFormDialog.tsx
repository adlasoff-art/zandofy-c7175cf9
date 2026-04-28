import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
const sb = supabase as any;
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Upload, X, Plus, Trash2, Plane, Ship, Truck, TramFront, Route } from "lucide-react";
import { z } from "zod";
import { TransporterUserPicker } from "./TransporterUserPicker";

type TransportMode = "air" | "sea" | "road" | "rail";

interface CoverageRoute {
  origin_country: string;
  destination_country: string;
}

const MODES: { key: TransportMode; label: string; Icon: typeof Plane }[] = [
  { key: "air", label: "Aérien", Icon: Plane },
  { key: "sea", label: "Maritime", Icon: Ship },
  { key: "road", label: "Routier", Icon: Truck },
  { key: "rail", label: "Ferroviaire", Icon: TramFront },
];

export interface Forwarder {
  id?: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  description?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  is_active?: boolean;
  linked_transporter_user_id?: string | null;
  supported_modes?: string[] | null;
  coverage_routes?: CoverageRoute[] | null;
}

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);

// S1 — Zod schema (defense in depth; RLS already admin-only)
const forwarderSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(100),
  slug: z.string().trim().regex(/^[a-z0-9-]+$/, "Slug invalide (a-z, 0-9, -)").min(1).max(50),
  logo_url: z.string().trim().max(500).nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
  contact_email: z.string().trim().email("Email invalide").max(255).or(z.literal("")).nullable().optional(),
  contact_phone: z.string().trim().max(32).nullable().optional(),
  linked_transporter_user_id: z.string().uuid().nullable().optional(),
  supported_modes: z.array(z.enum(["air", "sea", "road", "rail"])).default([]),
  coverage_routes: z
    .array(
      z.object({
        origin_country: z.string().trim().length(2, "ISO 2 lettres").regex(/^[A-Z]{2}$/, "Majuscules ISO"),
        destination_country: z.string().trim().length(2, "ISO 2 lettres").regex(/^[A-Z]{2}$/, "Majuscules ISO"),
      }),
    )
    .default([]),
});

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
    contact_email: "", contact_phone: "", is_active: true,
    linked_transporter_user_id: null,
    supported_modes: [],
    coverage_routes: [],
  });
  const [uploading, setUploading] = useState(false);
  const [newOrigin, setNewOrigin] = useState("");
  const [newDest, setNewDest] = useState("CD");

  useEffect(() => {
    if (forwarder) setForm({
      ...forwarder,
      supported_modes: Array.isArray(forwarder.supported_modes) ? forwarder.supported_modes : [],
      coverage_routes: Array.isArray(forwarder.coverage_routes) ? forwarder.coverage_routes : [],
    });
    else setForm({
      name: "", slug: "", logo_url: "", description: "",
      contact_email: "", contact_phone: "", is_active: true,
      linked_transporter_user_id: null,
      supported_modes: [],
      coverage_routes: [],
    });
  }, [forwarder, open]);

  const handleUpload = async (file: File) => {
    // S2 — server-safe MIME + size + extension sanitization
    const ALLOWED = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
    if (!ALLOWED.includes(file.type)) {
      toast.error("Format non supporté (PNG, JPEG, SVG, WebP uniquement)");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Fichier trop volumineux (max 2 Mo)");
      return;
    }
    setUploading(true);
    try {
      const rawExt = (file.name.split(".").pop() || "png").toLowerCase();
      const ext = /^[a-z0-9]{1,5}$/.test(rawExt) ? rawExt : "png";
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
      const parsed = forwarderSchema.safeParse({
        name: payload.name,
        slug: payload.slug || slugify(payload.name),
        logo_url: payload.logo_url || null,
        description: payload.description || null,
        contact_email: payload.contact_email || null,
        contact_phone: payload.contact_phone || null,
        linked_transporter_user_id: payload.linked_transporter_user_id || null,
        supported_modes: payload.supported_modes ?? [],
        coverage_routes: payload.coverage_routes ?? [],
      });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Données invalides");
      }
      const body = {
        ...parsed.data,
        contact_email: parsed.data.contact_email === "" ? null : parsed.data.contact_email,
        is_active: !!payload.is_active,
      };
      if (payload.id) {
        const { error } = await sb.from("forwarders").update(body).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("forwarders").insert(body);
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

  const toggleMode = (mode: TransportMode) => {
    const current = new Set(form.supported_modes ?? []);
    if (current.has(mode)) current.delete(mode);
    else current.add(mode);
    setForm({ ...form, supported_modes: [...current] });
  };

  const addRoute = () => {
    const origin = newOrigin.trim().toUpperCase();
    const dest = newDest.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(origin) || !/^[A-Z]{2}$/.test(dest)) {
      toast.error("Codes ISO 2 lettres requis (ex: CN, TR, AE → CD)");
      return;
    }
    const routes = form.coverage_routes ?? [];
    if (routes.some((r) => r.origin_country === origin && r.destination_country === dest)) {
      toast.error("Cette route existe déjà");
      return;
    }
    setForm({
      ...form,
      coverage_routes: [...routes, { origin_country: origin, destination_country: dest }],
    });
    setNewOrigin("");
  };

  const removeRoute = (idx: number) => {
    const routes = [...(form.coverage_routes ?? [])];
    routes.splice(idx, 1);
    setForm({ ...form, coverage_routes: routes });
  };

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

          <div className="text-[11px] text-muted-foreground px-1">
            Le multiplicateur de prix est configuré par palier tarifaire (modes air/sea × tiers express/standard/vip) depuis l'icône <span className="font-semibold">$</span> de la liste.
          </div>

          <div className="space-y-1.5 p-3 border border-border rounded-lg bg-muted/20">
            <Label className="text-sm">Compte transporteur lié (optionnel)</Label>
            <TransporterUserPicker
              value={form.linked_transporter_user_id ?? null}
              onChange={(uid) => setForm({ ...form, linked_transporter_user_id: uid })}
              placeholder="Rechercher un utilisateur…"
            />
            <p className="text-[11px] text-muted-foreground">
              Si renseigné, le compte associé verra et gérera automatiquement les commandes assignées
              à ce transitaire dans son espace transporteur.
            </p>
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