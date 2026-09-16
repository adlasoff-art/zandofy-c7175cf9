/**
 * ForwarderSettingsPage — identité publique (upload logo + géo siège) + templates WhatsApp.
 */
import { useEffect, useState } from "react";
import { Loader2, Save, ShieldCheck, Lock, Globe2, Phone, Mail, MapPin, Image as ImageIcon, MessageCircle, Bell } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { fromTable } from "@/lib/supabase-helpers";
import { useForwarderContext } from "@/hooks/use-forwarder-context";
import { GeoFieldsRow, type GeoFieldsValue } from "@/components/address/GeoFieldsRow";
import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_WA_TEMPLATES, resolveWaTemplates, type WaTemplateKey } from "@/lib/forwarder-wa";
import { usePushNotifications } from "@/hooks/use-push-notifications";

export default function ForwarderSettingsPage() {
  const { forwarder, loading, refetch } = useForwarderContext();
  const push = usePushNotifications();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hqGeo, setHqGeo] = useState<GeoFieldsValue>({ country: "", city: "" });
  const [form, setForm] = useState({
    contact_email: "",
    contact_phone: "",
    website_url: "",
    description: "",
    headquarters_address: "",
    logo_url: "",
  });
  const [wa, setWa] = useState<Record<WaTemplateKey, string>>({ ...DEFAULT_WA_TEMPLATES });

  useEffect(() => {
    if (!forwarder) return;
    setForm({
      contact_email: forwarder.contact_email ?? "",
      contact_phone: forwarder.contact_phone ?? "",
      website_url: forwarder.website_url ?? "",
      description: forwarder.description ?? "",
      headquarters_address: forwarder.headquarters_address ?? "",
      logo_url: forwarder.logo_url ?? "",
    });
    setHqGeo({
      country: forwarder.headquarters_country ?? "",
      city: forwarder.headquarters_city ?? "",
    });
    setWa(resolveWaTemplates(forwarder.wa_templates as Record<string, string> | undefined));
  }, [forwarder]);

  if (loading || !forwarder) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const uploadLogo = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${forwarder.id}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("forwarder-logos").upload(path, file, {
        contentType: file.type,
        upsert: true,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("forwarder-logos").getPublicUrl(path);
      setForm((f) => ({ ...f, logo_url: data.publicUrl }));
      toast.success("Logo téléversé");
    } catch (e: any) {
      toast.error(e.message || "Échec upload logo");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await fromTable("forwarders")
      .update({
        contact_email: form.contact_email || null,
        contact_phone: form.contact_phone || null,
        website_url: form.website_url || null,
        description: form.description || null,
        headquarters_address: form.headquarters_address || null,
        headquarters_country: hqGeo.country?.toUpperCase() || null,
        headquarters_city: hqGeo.city?.trim() || null,
        logo_url: form.logo_url || null,
        wa_templates: wa,
      })
      .eq("id", forwarder.id);
    setSaving(false);
    if (error) {
      toast.error("Échec de l'enregistrement", { description: error.message });
      return;
    }
    toast.success("Paramètres mis à jour");
    refetch();
  };

  const statusColor =
    forwarder.status === "approved" ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" :
    forwarder.status === "pending"  ? "bg-amber-500/10 text-amber-600 border-amber-500/30" :
    "bg-destructive/10 text-destructive border-destructive/30";

  return (
    <div className="space-y-6 max-w-3xl">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Paramètres</h1>
          <p className="text-xs text-muted-foreground">Identité publique, siège et messages WhatsApp.</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="animate-spin mr-2" size={14} /> : <Save size={14} className="mr-2" />}
          Enregistrer
        </Button>
      </header>

      <section className="rounded-lg border border-border bg-card p-4 space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Identité publique</h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5"><Mail size={12} /> Email de contact</Label>
            <Input type="email" value={form.contact_email} onChange={update("contact_email")} placeholder="contact@transitaire.com" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5"><Phone size={12} /> Téléphone</Label>
            <Input value={form.contact_phone} onChange={update("contact_phone")} placeholder="+243..." />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5"><Globe2 size={12} /> Site web</Label>
            <Input value={form.website_url} onChange={update("website_url")} placeholder="https://..." />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1.5"><ImageIcon size={12} /> Logo</Label>
            <Input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadLogo(f);
              }}
            />
            {form.logo_url && (
              <img src={form.logo_url} alt="Logo" className="h-12 w-12 object-contain rounded border border-border mt-1" />
            )}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs flex items-center gap-1.5"><MapPin size={12} /> Siège (pays / ville)</Label>
            <GeoFieldsRow
              value={hqGeo}
              onChange={(patch) => setHqGeo((g) => ({ ...g, ...patch }))}
              levels={["country", "city"]}
              labels={{ country: "Pays du siège", city: "Ville du siège" }}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Adresse (ligne)</Label>
            <Input value={form.headquarters_address} onChange={update("headquarters_address")} placeholder="N° rue, quartier…" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Description</Label>
            <Textarea
              rows={4}
              value={form.description}
              onChange={update("description")}
              placeholder="Présentation, spécialités, zones desservies..."
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4 space-y-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <MessageCircle size={14} /> Templates WhatsApp
        </h2>
        <p className="text-[11px] text-muted-foreground">
          Variables : {"{{company}}"}, {"{{awb}}"}, {"{{status}}"}, {"{{tracking_url}}"}, {"{{weight}}"}, {"{{amount}}"}
        </p>
        {(["arrived", "reminder", "urgent"] as WaTemplateKey[]).map((key) => (
          <div key={key} className="space-y-1">
            <Label className="text-xs capitalize">{key === "arrived" ? "Arrivée" : key === "reminder" ? "Rappel" : "Urgent"}</Label>
            <Textarea
              rows={2}
              value={wa[key]}
              onChange={(e) => setWa((w) => ({ ...w, [key]: e.target.value }))}
            />
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-border bg-card p-4 space-y-4">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Bell size={14} /> Notifications web push
        </h2>
        <p className="text-[11px] text-muted-foreground">
          Recevez des alertes navigateur (handoffs, mises à jour). Utilise le service worker PWA existant.
        </p>
        {!push.supported ? (
          <p className="text-xs text-muted-foreground">Non supporté sur ce navigateur.</p>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline">
              {push.isSubscribed ? "Activé" : push.permission === "denied" ? "Bloqué" : "Désactivé"}
            </Badge>
            {!push.isSubscribed && push.permission !== "denied" && (
              <Button
                size="sm"
                variant="outline"
                disabled={push.loading}
                onClick={async () => {
                  const ok = await push.subscribe();
                  if (ok) toast.success("Notifications activées");
                  else toast.error("Impossible d'activer les notifications");
                }}
              >
                {push.loading ? <Loader2 className="animate-spin" size={14} /> : "Activer"}
              </Button>
            )}
            {push.isSubscribed && (
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await push.unsubscribe();
                  toast.success("Notifications désactivées");
                }}
              >
                Désactiver
              </Button>
            )}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Lock size={14} /> Identité légale
          </h2>
          <Badge variant="outline" className={statusColor}>
            <ShieldCheck size={12} className="mr-1" />
            KYB : {forwarder.status}
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Ces champs sont verrouillés après validation du KYB. Pour toute modification, contactez le support Zandofy.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          <ReadOnly label="Raison sociale" value={forwarder.legal_name} />
          <ReadOnly label="N° d'enregistrement (RCCM)" value={forwarder.registration_number} />
          <ReadOnly label="N° fiscal (NIF)" value={forwarder.tax_id} />
          <ReadOnly label="Slug public" value={forwarder.slug} />
        </div>
      </section>
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="h-10 px-3 flex items-center rounded-md border border-dashed border-border bg-muted/30 text-sm text-foreground">
        {value || <span className="text-muted-foreground italic">—</span>}
      </div>
    </div>
  );
}
