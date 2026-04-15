import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Loader2, Save, ChevronDown, ChevronUp } from "lucide-react";

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

const DEFAULT_WORKFLOW = {
  name: "",
  trigger_type: "visit_no_account",
  delay_days: 0,
  delay_minutes: 0,
  channel: "popup",
  condition_has_account: null as boolean | null,
  condition_has_order: null as boolean | null,
  condition_max_days_since_signup: null as number | null,
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
  max_displays: null as number | null,
};

export function AdminAutomationsTab() {
  const { toast } = useToast();
  const [workflows, setWorkflows] = useState<WorkflowRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...DEFAULT_WORKFLOW });

  const inputClass = "w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20";

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

  const showsPopup = (ch: string) => ["popup", "popup_push", "all"].includes(ch);
  const showsPush = (ch: string) => ["push", "popup_push", "push_email", "all"].includes(ch);
  const showsEmail = (ch: string) => ["email", "push_email", "all"].includes(ch);

  const handleCreate = async () => {
    if (!form.name) return;
    setSaving(true);
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
      is_active: false,
    };
    if (showsPopup(form.channel)) {
      payload.popup_title = form.popup_title || null;
      payload.popup_content = form.popup_content || null;
      payload.popup_image_url = form.popup_image_url || null;
      payload.popup_cta_label = form.popup_cta_label || null;
      payload.popup_cta_link = form.popup_cta_link || null;
    }
    if (showsPush(form.channel)) {
      payload.push_title = form.push_title || null;
      payload.push_body = form.push_body || null;
    }
    if (showsEmail(form.channel)) {
      payload.email_subject = form.email_subject || null;
      payload.email_html_content = form.email_html_content || null;
    }

    const { error } = await (supabase as any).from("automation_workflows").insert(payload);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Workflow créé" });
      setForm({ ...DEFAULT_WORKFLOW });
      setShowForm(false);
      await loadWorkflows();
    }
    setSaving(false);
  };

  const toggleWorkflow = async (id: string, active: boolean) => {
    await (supabase as any).from("automation_workflows").update({ is_active: active }).eq("id", id);
    setWorkflows((prev) => prev.map((w) => (w.id === id ? { ...w, is_active: active } : w)));
  };

  const deleteWorkflow = async (id: string) => {
    await (supabase as any).from("automation_workflows").delete().eq("id", id);
    setWorkflows((prev) => prev.filter((w) => w.id !== id));
    toast({ title: "Workflow supprimé" });
  };

  const renderFormFields = (values: typeof DEFAULT_WORKFLOW, onChange: (v: typeof DEFAULT_WORKFLOW) => void) => (
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

      {/* Conditions */}
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

      {/* Popup content */}
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

      {/* Push content */}
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

      {/* Email content */}
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
              <textarea value={values.email_html_content} onChange={(e) => onChange({ ...values, email_html_content: e.target.value })} className={inputClass + " min-h-[100px] resize-y font-mono text-xs"} />
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Create */}
      <section className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Plus size={16} /> Nouveau workflow
          </h2>
          <Button variant="ghost" size="sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </Button>
        </div>
        {showForm && (
          <>
            {renderFormFields(form, setForm)}
            <Button onClick={handleCreate} disabled={saving || !form.name} size="sm" className="gap-1.5">
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
          workflows.map((wf) => (
            <div key={wf.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="p-4 flex items-center gap-4">
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedId(expandedId === wf.id ? null : wf.id)}>
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
                <Switch checked={wf.is_active} onCheckedChange={(v) => toggleWorkflow(wf.id, v)} />
                <button onClick={() => deleteWorkflow(wf.id)} className="text-destructive hover:text-destructive/80">
                  <Trash2 size={16} />
                </button>
              </div>
              {expandedId === wf.id && (
                <div className="px-4 pb-4 border-t border-border pt-3 space-y-2 text-xs text-muted-foreground">
                  {wf.popup_title && <p><span className="font-medium">Popup :</span> {wf.popup_title}</p>}
                  {wf.push_title && <p><span className="font-medium">Push :</span> {wf.push_title}</p>}
                  {wf.email_subject && <p><span className="font-medium">Email :</span> {wf.email_subject}</p>}
                  {wf.condition_max_days_since_signup !== null && (
                    <p>Max jours : {wf.condition_max_days_since_signup}</p>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </section>

      <p className="text-[10px] text-muted-foreground">
        💡 Tous les workflows sont inactifs par défaut. Activez-les un par un quand vous êtes prêt. Les emails sont envoyés avec un décalage de 2-3 minutes entre chaque pour protéger la réputation du domaine.
      </p>
    </div>
  );
}
