import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Loader2, Save, ChevronDown, ChevronUp, Pencil, Eye } from "lucide-react";

interface WorkflowRow {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  trigger_type: string;
  delay_days: number;
  delay_minutes: number;
  channel: string;
  condition_has_account: boolean | null;
  condition_has_order: boolean | null;
  condition_max_days_since_signup: number | null;
  popup_title: string | null;
  popup_content: string | null;
  popup_image_url: string | null;
  popup_cta_label: string | null;
  popup_cta_link: string | null;
  push_title: string | null;
  push_body: string | null;
  email_subject: string | null;
  email_html_content: string | null;
  display_frequency: string;
  max_displays: number | null;
}

const TRIGGER_LABELS: Record<string, string> = {
  visit_no_account: "Visite sans compte",
  account_created: "Création de compte",
  visit_no_order: "Visite sans commande",
  product_viewed_no_order: "Produit vu sans achat",
  no_order_delay: "Pas de commande (délai)",
  referral_prompt: "Incitation au parrainage",
  custom: "Personnalisé",
};

const CHANNEL_LABELS: Record<string, string> = {
  popup: "Popup",
  push: "Push",
  email: "Email",
  popup_push: "Popup + Push",
  push_email: "Push + Email",
  all: "Tous",
};

const FREQUENCY_LABELS: Record<string, string> = {
  every_visit: "Chaque visite",
  once: "Une seule fois",
  daily: "Quotidien",
  once_per_session: "1x par session",
};

type FormShape = {
  name: string;
  trigger_type: string;
  delay_days: number;
  delay_minutes: number;
  channel: string;
  condition_has_account: boolean | null;
  condition_has_order: boolean | null;
  condition_max_days_since_signup: number | null;
  popup_title: string;
  popup_content: string;
  popup_image_url: string;
  popup_cta_label: string;
  popup_cta_link: string;
  push_title: string;
  push_body: string;
  email_subject: string;
  email_html_content: string;
  display_frequency: string;
  max_displays: number | null;
};

const DEFAULT_WORKFLOW: FormShape = {
  name: "",
  trigger_type: "visit_no_account",
  delay_days: 0,
  delay_minutes: 0,
  channel: "popup",
  condition_has_account: null,
  condition_has_order: null,
  condition_max_days_since_signup: null,
  popup_title: "",
  popup_content: "",
  popup_image_url: "",
  popup_cta_label: "En savoir plus",
  popup_cta_link: "",
  push_title: "",
  push_body: "",
  email_subject: "",
  email_html_content: "",
  display_frequency: "once",
  max_displays: null,
};

const showsPopup = (ch: string) => ["popup", "popup_push", "all"].includes(ch);
const showsPush = (ch: string) => ["push", "popup_push", "push_email", "all"].includes(ch);
const showsEmail = (ch: string) => ["email", "push_email", "all"].includes(ch);

const inputClass = "w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20";

function workflowToForm(wf: WorkflowRow): FormShape {
  return {
    name: wf.name,
    trigger_type: wf.trigger_type,
    delay_days: wf.delay_days,
    delay_minutes: wf.delay_minutes,
    channel: wf.channel,
    condition_has_account: wf.condition_has_account,
    condition_has_order: wf.condition_has_order,
    condition_max_days_since_signup: wf.condition_max_days_since_signup,
    popup_title: wf.popup_title || "",
    popup_content: wf.popup_content || "",
    popup_image_url: wf.popup_image_url || "",
    popup_cta_label: wf.popup_cta_label || "En savoir plus",
    popup_cta_link: wf.popup_cta_link || "",
    push_title: wf.push_title || "",
    push_body: wf.push_body || "",
    email_subject: wf.email_subject || "",
    email_html_content: wf.email_html_content || "",
    display_frequency: wf.display_frequency,
    max_displays: wf.max_displays,
  };
}

function formToPayload(form: FormShape) {
  const payload: any = {
    name: form.name,
    trigger_type: form.trigger_type,
    delay_days: form.delay_days,
    delay_minutes: form.delay_minutes,
    channel: form.channel,
    condition_has_account: form.condition_has_account,
    condition_has_order: form.condition_has_order,
    condition_max_days_since_signup: form.condition_max_days_since_signup,
    display_frequency: form.display_frequency,
    max_displays: form.max_displays,
    popup_title: showsPopup(form.channel) ? form.popup_title || null : null,
    popup_content: showsPopup(form.channel) ? form.popup_content || null : null,
    popup_image_url: showsPopup(form.channel) ? form.popup_image_url || null : null,
    popup_cta_label: showsPopup(form.channel) ? form.popup_cta_label || null : null,
    popup_cta_link: showsPopup(form.channel) ? form.popup_cta_link || null : null,
    push_title: showsPush(form.channel) ? form.push_title || null : null,
    push_body: showsPush(form.channel) ? form.push_body || null : null,
    email_subject: showsEmail(form.channel) ? form.email_subject || null : null,
    email_html_content: showsEmail(form.channel) ? form.email_html_content || null : null,
  };
  return payload;
}

function FormFields({ values, onChange }: { values: FormShape; onChange: (v: FormShape) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground block mb-1">Nom du workflow</label>
          <input value={values.name} onChange={(e) => onChange({ ...values, name: e.target.value })} className={inputClass} placeholder="Ex: Bienvenue J0" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Déclencheur</label>
          <select value={values.trigger_type} onChange={(e) => onChange({ ...values, trigger_type: e.target.value })} className={inputClass}>
            {Object.entries(TRIGGER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Canal</label>
          <select value={values.channel} onChange={(e) => onChange({ ...values, channel: e.target.value })} className={inputClass}>
            {Object.entries(CHANNEL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Délai (jours)</label>
          <input type="number" min={0} value={values.delay_days} onChange={(e) => onChange({ ...values, delay_days: parseInt(e.target.value) || 0 })} className={inputClass} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Délai (minutes)</label>
          <input type="number" min={0} value={values.delay_minutes} onChange={(e) => onChange({ ...values, delay_minutes: parseInt(e.target.value) || 0 })} className={inputClass} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Fréquence</label>
          <select value={values.display_frequency} onChange={(e) => onChange({ ...values, display_frequency: e.target.value })} className={inputClass}>
            {Object.entries(FREQUENCY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Max affichages (vide = illimité)</label>
          <input type="number" min={1} value={values.max_displays ?? ""} onChange={(e) => onChange({ ...values, max_displays: e.target.value ? parseInt(e.target.value) : null })} className={inputClass} />
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Conditions</h4>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">A un compte ?</label>
            <select
              value={values.condition_has_account === null ? "" : values.condition_has_account ? "true" : "false"}
              onChange={(e) => onChange({ ...values, condition_has_account: e.target.value === "" ? null : e.target.value === "true" })}
              className={inputClass}
            >
              <option value="">Indifférent</option>
              <option value="true">Oui</option>
              <option value="false">Non</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">A commandé ?</label>
            <select
              value={values.condition_has_order === null ? "" : values.condition_has_order ? "true" : "false"}
              onChange={(e) => onChange({ ...values, condition_has_order: e.target.value === "" ? null : e.target.value === "true" })}
              className={inputClass}
            >
              <option value="">Indifférent</option>
              <option value="true">Oui</option>
              <option value="false">Non</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Max jours depuis inscription</label>
            <input
              type="number"
              min={0}
              value={values.condition_max_days_since_signup ?? ""}
              onChange={(e) => onChange({ ...values, condition_max_days_since_signup: e.target.value ? parseInt(e.target.value) : null })}
              className={inputClass}
              placeholder="∞"
            />
          </div>
        </div>
      </div>

      {showsPopup(values.channel) && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contenu Popup</h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground block mb-1">Titre</label>
              <input value={values.popup_title} onChange={(e) => onChange({ ...values, popup_title: e.target.value })} className={inputClass} />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-muted-foreground block mb-1">Contenu</label>
              <textarea value={values.popup_content} onChange={(e) => onChange({ ...values, popup_content: e.target.value })} className={inputClass + " min-h-[60px] resize-y"} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">URL image</label>
              <input value={values.popup_image_url} onChange={(e) => onChange({ ...values, popup_image_url: e.target.value })} className={inputClass} placeholder="https://..." />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Lien CTA</label>
              <input value={values.popup_cta_link} onChange={(e) => onChange({ ...values, popup_cta_link: e.target.value })} className={inputClass} placeholder="/register" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Libellé CTA</label>
              <input value={values.popup_cta_label} onChange={(e) => onChange({ ...values, popup_cta_label: e.target.value })} className={inputClass} />
            </div>
          </div>
        </div>
      )}

      {showsPush(values.channel) && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contenu Push</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Titre push</label>
              <input value={values.push_title} onChange={(e) => onChange({ ...values, push_title: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Corps push</label>
              <input value={values.push_body} onChange={(e) => onChange({ ...values, push_body: e.target.value })} className={inputClass} />
            </div>
          </div>
        </div>
      )}

      {showsEmail(values.channel) && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contenu Email</h4>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Sujet</label>
              <input value={values.email_subject} onChange={(e) => onChange({ ...values, email_subject: e.target.value })} className={inputClass} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Contenu HTML</label>
              <textarea value={values.email_html_content} onChange={(e) => onChange({ ...values, email_html_content: e.target.value })} className={inputClass + " min-h-[160px] resize-y font-mono text-xs"} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PopupPreview({ form }: { form: FormShape }) {
  if (!showsPopup(form.channel)) return null;
  return (
    <div className="border border-border rounded-xl overflow-hidden bg-background max-w-sm mx-auto">
      {form.popup_image_url && (
        <img src={form.popup_image_url} alt="" className="w-full h-40 object-cover" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
      )}
      <div className="p-4 space-y-2">
        <h4 className="text-base font-semibold text-foreground">{form.popup_title || form.name || "Titre"}</h4>
        {form.popup_content && <p className="text-sm text-muted-foreground">{form.popup_content}</p>}
        <div className="flex gap-2 pt-1">
          {form.popup_cta_link && (
            <Button size="sm" className="flex-1 text-xs">{form.popup_cta_label || "En savoir plus"}</Button>
          )}
          <Button size="sm" variant="outline" className="text-xs">Fermer</Button>
        </div>
      </div>
    </div>
  );
}

function EmailPreview({ form }: { form: FormShape }) {
  if (!showsEmail(form.channel)) return null;
  return (
    <div className="border border-border rounded-xl overflow-hidden bg-background">
      <div className="px-4 py-2 border-b border-border bg-muted/40">
        <p className="text-xs text-muted-foreground">Sujet</p>
        <p className="text-sm font-medium text-foreground">{form.email_subject || "(Sujet vide)"}</p>
      </div>
      <div className="p-4 max-h-[300px] overflow-y-auto bg-white text-black" dangerouslySetInnerHTML={{ __html: form.email_html_content || "<p style='color:#888'>(Contenu HTML vide)</p>" }} />
    </div>
  );
}

export function AdminAutomationsTab() {
  const { toast } = useToast();
  const [workflows, setWorkflows] = useState<WorkflowRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormShape>(DEFAULT_WORKFLOW);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<FormShape>({ ...DEFAULT_WORKFLOW });

  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    const { data } = await (supabase as any)
      .from("automation_workflows")
      .select("*")
      .order("sort_order", { ascending: true });
    setWorkflows(data || []);
  };

  const handleCreate = async () => {
    if (!createForm.name) return;
    setSaving(true);
    const payload = { ...formToPayload(createForm), is_active: false };
    const { error } = await (supabase as any).from("automation_workflows").insert(payload);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Workflow créé" });
      setCreateForm({ ...DEFAULT_WORKFLOW });
      setShowCreateForm(false);
      await loadWorkflows();
    }
    setSaving(false);
  };

  const startEditing = (wf: WorkflowRow) => {
    setEditingId(wf.id);
    setEditForm(workflowToForm(wf));
    setPreviewId(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from("automation_workflows")
      .update(formToPayload(editForm))
      .eq("id", editingId);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Workflow mis à jour" });
      await loadWorkflows();
      setEditingId(null);
    }
    setSaving(false);
  };

  const toggleWorkflow = async (id: string, active: boolean) => {
    await (supabase as any).from("automation_workflows").update({ is_active: active }).eq("id", id);
    setWorkflows((prev) => prev.map((w) => (w.id === id ? { ...w, is_active: active } : w)));
  };

  const deleteWorkflow = async (id: string) => {
    if (!confirm("Supprimer définitivement ce workflow ?")) return;
    await (supabase as any).from("automation_workflows").delete().eq("id", id);
    setWorkflows((prev) => prev.filter((w) => w.id !== id));
    toast({ title: "Workflow supprimé" });
  };

  return (
    <div className="space-y-6">
      {/* Create */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Plus size={16} /> Nouveau workflow
          </h2>
          <Button variant="ghost" size="sm" onClick={() => setShowCreateForm(!showCreateForm)}>
            {showCreateForm ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </Button>
        </div>
        {showCreateForm && (
          <>
            <FormFields values={createForm} onChange={setCreateForm} />
            <Button onClick={handleCreate} disabled={saving || !createForm.name} size="sm" className="gap-1.5">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Créer
            </Button>
          </>
        )}
      </section>

      {/* List */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Workflows ({workflows.length})</h2>
        {workflows.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Aucun workflow créé.</p>
        ) : (
          workflows.map((wf) => {
            const isEditing = editingId === wf.id;
            const isPreview = previewId === wf.id;
            return (
              <div key={wf.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="p-4 flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{wf.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {TRIGGER_LABELS[wf.trigger_type] || wf.trigger_type} · {CHANNEL_LABELS[wf.channel] || wf.channel} · {FREQUENCY_LABELS[wf.display_frequency] || wf.display_frequency}
                    </p>
                    {(wf.delay_days > 0 || wf.delay_minutes > 0) && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Délai : {wf.delay_days > 0 ? `${wf.delay_days}j` : ""}{wf.delay_minutes > 0 ? ` ${wf.delay_minutes}min` : ""}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setPreviewId(isPreview ? null : wf.id)}
                    className="text-muted-foreground hover:text-foreground p-1"
                    title="Aperçu"
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    onClick={() => isEditing ? cancelEditing() : startEditing(wf)}
                    className="text-muted-foreground hover:text-foreground p-1"
                    title={isEditing ? "Annuler" : "Modifier"}
                  >
                    {isEditing ? <ChevronUp size={16} /> : <Pencil size={16} />}
                  </button>
                  <Switch checked={wf.is_active} onCheckedChange={(v) => toggleWorkflow(wf.id, v)} />
                  <button onClick={() => deleteWorkflow(wf.id)} className="text-destructive hover:text-destructive/80 p-1">
                    <Trash2 size={16} />
                  </button>
                </div>

                {isPreview && !isEditing && (
                  <div className="px-4 pb-4 border-t border-border pt-4 space-y-3">
                    <PopupPreview form={workflowToForm(wf)} />
                    <EmailPreview form={workflowToForm(wf)} />
                    {showsPush(wf.channel) && (wf.push_title || wf.push_body) && (
                      <div className="border border-border rounded-xl p-3 bg-background max-w-sm">
                        <p className="text-xs text-muted-foreground mb-1">Notification push</p>
                        <p className="text-sm font-medium text-foreground">{wf.push_title}</p>
                        <p className="text-xs text-muted-foreground">{wf.push_body}</p>
                      </div>
                    )}
                  </div>
                )}

                {isEditing && (
                  <div className="px-4 pb-4 border-t border-border pt-4 space-y-3">
                    <FormFields values={editForm} onChange={setEditForm} />
                    <div className="flex gap-2">
                      <Button onClick={handleSaveEdit} disabled={saving} size="sm" className="gap-1.5">
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Enregistrer
                      </Button>
                      <Button onClick={cancelEditing} disabled={saving} size="sm" variant="outline">
                        Annuler
                      </Button>
                      <Button onClick={() => setPreviewId(isPreview ? null : wf.id)} size="sm" variant="ghost" className="gap-1.5 ml-auto">
                        <Eye size={14} /> Aperçu
                      </Button>
                    </div>
                    {isPreview && (
                      <div className="space-y-3 pt-3 border-t border-border">
                        <PopupPreview form={editForm} />
                        <EmailPreview form={editForm} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>

      <p className="text-[10px] text-muted-foreground">
        💡 Tous les workflows sont inactifs par défaut. Activez-les un par un quand vous êtes prêt. Les emails sont envoyés avec un décalage de 2-3 minutes entre chaque pour protéger la réputation du domaine.
      </p>
    </div>
  );
}
