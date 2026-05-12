/**
 * ForwarderSettingsPage — Affinage UX /forwarder/* (Phase B2.2)
 *
 * Permet au transitaire d'éditer son identité opérationnelle
 * (contact, logo, description, adresse). Les champs légaux
 * (raison sociale, RCCM/NIF, statut KYB) restent en lecture seule
 * et sont protégés par le trigger trg_protect_forwarder_sensitive.
 */
import { useEffect, useState } from "react";
import { Loader2, Save, ShieldCheck, Lock, Globe2, Phone, Mail, MapPin, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { fromTable } from "@/lib/supabase-helpers";
import { useForwarderContext } from "@/hooks/use-forwarder-context";

export default function ForwarderSettingsPage() {
  const { forwarder, loading, refetch } = useForwarderContext();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    contact_email: "",
    contact_phone: "",
    website_url: "",
    description: "",
    headquarters_address: "",
    logo_url: "",
  });

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

  const handleSave = async () => {
    setSaving(true);
    const { error } = await fromTable("forwarders")
      .update({
        contact_email: form.contact_email || null,
        contact_phone: form.contact_phone || null,
        website_url: form.website_url || null,
        description: form.description || null,
        headquarters_address: form.headquarters_address || null,
        logo_url: form.logo_url || null,
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
          <p className="text-xs text-muted-foreground">Identité publique et coordonnées du transitaire.</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="animate-spin mr-2" size={14} /> : <Save size={14} className="mr-2" />}
          Enregistrer
        </Button>
      </header>

      {/* Identité publique éditable */}
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
            <Label className="text-xs flex items-center gap-1.5"><ImageIcon size={12} /> URL du logo</Label>
            <Input value={form.logo_url} onChange={update("logo_url")} placeholder="https://...png" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs flex items-center gap-1.5"><MapPin size={12} /> Adresse du siège</Label>
            <Input value={form.headquarters_address} onChange={update("headquarters_address")} placeholder="N° rue, ville" />
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

      {/* Identité légale verrouillée */}
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
          <ReadOnly label="Pays du siège" value={forwarder.headquarters_country} />
          <ReadOnly label="Ville du siège" value={forwarder.headquarters_city} />
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