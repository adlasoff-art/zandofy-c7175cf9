/**
 * OperatorSettingsPage — Lot 11B Phase B2 (Profil entreprise + lecture seule statut)
 */
import { useState } from "react";
import { useOperatorContext } from "@/hooks/use-operator-context";
import { fromTable } from "@/lib/supabase-helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Save, Building2, ShieldCheck, AlertCircle } from "lucide-react";

export default function OperatorSettingsPage() {
  const { operator, refetch } = useOperatorContext();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    contact_email: operator?.contact_email ?? "",
    contact_phone: operator?.contact_phone ?? "",
    headquarters_address: operator?.headquarters_address ?? "",
    logo_url: operator?.logo_url ?? "",
  });

  if (!operator) return null;

  const save = async () => {
    setSaving(true);
    const { error } = await fromTable("delivery_operators").update({
      contact_email: form.contact_email.trim(),
      contact_phone: form.contact_phone.trim(),
      headquarters_address: form.headquarters_address.trim() || null,
      logo_url: form.logo_url.trim() || null,
    }).eq("id", operator.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else { toast.success("Paramètres enregistrés"); refetch(); }
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <div><h1 className="text-2xl font-bold">Paramètres</h1><p className="text-sm text-muted-foreground">Gérez votre profil opérateur.</p></div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><ShieldCheck size={16} />Statut & contrat</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <ReadOnly label="Statut">
            <span className="text-emerald-500 font-medium">● {operator.status}</span>
          </ReadOnly>
          <ReadOnly label="Commission plateforme">{operator.platform_commission_pct}%</ReadOnly>
          <ReadOnly label="Quota livreurs">{operator.max_riders}</ReadOnly>
          <ReadOnly label="Activé le">{operator.approved_at ? new Date(operator.approved_at).toLocaleDateString() : "—"}</ReadOnly>
          <ReadOnly label="RCCM">{operator.registration_number ?? "—"}</ReadOnly>
          <ReadOnly label="NIF">{operator.tax_id ?? "—"}</ReadOnly>
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-md">
        <AlertCircle size={14} className="text-blue-600 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-800 dark:text-blue-200">
          Pour modifier RCCM, NIF, raison sociale ou nom commercial, contactez le support Zandofy
          (modifications soumises à validation).
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Building2 size={16} />Profil modifiable</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Email contact</Label><Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} /></div>
          <div><Label>Téléphone</Label><Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} /></div>
          <div><Label>Adresse siège</Label><Input value={form.headquarters_address} onChange={(e) => setForm({ ...form, headquarters_address: e.target.value })} /></div>
          <div><Label>URL logo (optionnel)</Label><Input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://..." /></div>
          <Button onClick={save} disabled={saving} style={{ background: "var(--operator-gradient)" }} className="text-white">
            {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />} Enregistrer
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ReadOnly({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{children}</p>
    </div>
  );
}