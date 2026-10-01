import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_CTA_URL,
  interpolateOutreach,
  OUTREACH_CHANNEL_LABELS,
  type OutreachChannel,
  type UtilityMessageTemplate,
} from "@/lib/outreach-templates";

const ALL_CHANNELS: OutreachChannel[] = [
  "email",
  "push",
  "in_app",
  "whatsapp_me",
  "whatsapp_cloud",
];

type FormState = {
  id?: string;
  slug: string;
  label: string;
  audience: "customer" | "vendor" | "all";
  category: "utility" | "marketing" | "auth";
  channels: OutreachChannel[];
  email_subject: string;
  email_html: string;
  push_title: string;
  push_body: string;
  in_app_title: string;
  in_app_message: string;
  whatsapp_body: string;
  whatsapp_cloud_template_name: string;
  whatsapp_cloud_language: string;
  is_active: boolean;
  sort_order: number;
};

const EMPTY: FormState = {
  slug: "",
  label: "",
  audience: "all",
  category: "utility",
  channels: ["email", "push", "in_app", "whatsapp_me"],
  email_subject: "",
  email_html: "",
  push_title: "",
  push_body: "",
  in_app_title: "",
  in_app_message: "",
  whatsapp_body: "",
  whatsapp_cloud_template_name: "",
  whatsapp_cloud_language: "fr",
  is_active: true,
  sort_order: 100,
};

function toForm(t: UtilityMessageTemplate): FormState {
  return {
    id: t.id,
    slug: t.slug,
    label: t.label,
    audience: t.audience,
    category: t.category,
    channels: (t.channels || []).filter((c): c is OutreachChannel =>
      ALL_CHANNELS.includes(c as OutreachChannel),
    ),
    email_subject: t.email_subject || "",
    email_html: t.email_html || "",
    push_title: t.push_title || "",
    push_body: t.push_body || "",
    in_app_title: t.in_app_title || "",
    in_app_message: t.in_app_message || "",
    whatsapp_body: t.whatsapp_body || "",
    whatsapp_cloud_template_name: t.whatsapp_cloud_template_name || "",
    whatsapp_cloud_language: t.whatsapp_cloud_language || "fr",
    is_active: t.is_active,
    sort_order: t.sort_order,
  };
}

export function UtilityTemplatesPanel() {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [previewName, setPreviewName] = useState("Aminata");

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["utility-message-templates"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("utility_message_templates")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as UtilityMessageTemplate[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: FormState) => {
      if (!payload.slug.trim() || !payload.label.trim()) {
        throw new Error("Slug et libellé requis");
      }
      const row = {
        slug: payload.slug.trim(),
        label: payload.label.trim(),
        audience: payload.audience,
        category: payload.category,
        channels: payload.channels,
        email_subject: payload.email_subject || null,
        email_html: payload.email_html || null,
        push_title: payload.push_title || null,
        push_body: payload.push_body || null,
        in_app_title: payload.in_app_title || null,
        in_app_message: payload.in_app_message || null,
        whatsapp_body: payload.whatsapp_body || null,
        whatsapp_cloud_template_name: payload.whatsapp_cloud_template_name || null,
        whatsapp_cloud_language: payload.whatsapp_cloud_language || "fr",
        is_active: payload.is_active,
        sort_order: payload.sort_order,
        updated_at: new Date().toISOString(),
      };
      if (payload.id) {
        const { error } = await (supabase as any)
          .from("utility_message_templates")
          .update(row)
          .eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("utility_message_templates")
          .insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["utility-message-templates"] });
      toast.success("Template enregistré");
      setForm(EMPTY);
    },
    onError: (e: Error) => toast.error(e.message || "Erreur enregistrement"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("utility_message_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["utility-message-templates"] });
      toast.success("Template supprimé");
      setForm(EMPTY);
    },
    onError: (e: Error) => toast.error(e.message || "Erreur suppression"),
  });

  const previewVars = useMemo(
    () => ({ name: previewName, cta_url: DEFAULT_CTA_URL }),
    [previewName],
  );

  const toggleChannel = (ch: OutreachChannel) => {
    setForm((f) => ({
      ...f,
      channels: f.channels.includes(ch)
        ? f.channels.filter((c) => c !== ch)
        : [...f.channels, ch],
    }));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Messages utilitaires</h2>
          <button
            type="button"
            onClick={() => setForm(EMPTY)}
            className="text-xs flex items-center gap-1 text-primary hover:underline"
          >
            <Plus size={12} /> Nouveau
          </button>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="animate-spin text-muted-foreground" size={20} />
          </div>
        ) : templates.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucun template. Appliquez la migration 170000.</p>
        ) : (
          <ul className="space-y-1 max-h-[480px] overflow-y-auto">
            {templates.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => setForm(toForm(t))}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs border transition-colors ${
                    form.id === t.id
                      ? "border-primary bg-primary/5"
                      : "border-transparent hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-foreground truncate">{t.label}</span>
                    {!t.is_active && (
                      <span className="text-[10px] text-muted-foreground">off</span>
                    )}
                  </div>
                  <p className="text-muted-foreground font-mono truncate">{t.slug}</p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="lg:col-span-3 bg-card border border-border rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            {form.id ? "Éditer le template" : "Nouveau template"}
          </h2>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            Actif
            <Switch
              checked={form.is_active}
              onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Slug</label>
            <Input
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
              placeholder="welcome_signup"
              className="h-9 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Libellé</label>
            <Input
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              className="h-9 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Audience</label>
            <select
              value={form.audience}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  audience: e.target.value as FormState["audience"],
                }))
              }
              className="w-full h-9 text-sm rounded-md border border-input bg-background px-2"
            >
              <option value="all">Tous</option>
              <option value="customer">Clients</option>
              <option value="vendor">Vendeurs</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Catégorie</label>
            <select
              value={form.category}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  category: e.target.value as FormState["category"],
                }))
              }
              className="w-full h-9 text-sm rounded-md border border-input bg-background px-2"
            >
              <option value="utility">Utility</option>
              <option value="marketing">Marketing</option>
              <option value="auth">Auth</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-1.5">Canaux</label>
          <div className="flex flex-wrap gap-1.5">
            {ALL_CHANNELS.map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => toggleChannel(ch)}
                className={`px-2.5 py-1 text-[11px] rounded-full border ${
                  form.channels.includes(ch)
                    ? "bg-foreground text-card border-foreground"
                    : "bg-card border-border text-muted-foreground"
                }`}
              >
                {OUTREACH_CHANNEL_LABELS[ch]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field
            label="Email sujet"
            value={form.email_subject}
            onChange={(v) => setForm((f) => ({ ...f, email_subject: v }))}
          />
          <Field
            label="Push titre"
            value={form.push_title}
            onChange={(v) => setForm((f) => ({ ...f, push_title: v }))}
          />
        </div>
        <Area
          label="Email HTML"
          value={form.email_html}
          onChange={(v) => setForm((f) => ({ ...f, email_html: v }))}
          rows={3}
        />
        <Area
          label="Push body"
          value={form.push_body}
          onChange={(v) => setForm((f) => ({ ...f, push_body: v }))}
          rows={2}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field
            label="In-app titre"
            value={form.in_app_title}
            onChange={(v) => setForm((f) => ({ ...f, in_app_title: v }))}
          />
          <Field
            label="Cloud template name (Meta)"
            value={form.whatsapp_cloud_template_name}
            onChange={(v) =>
              setForm((f) => ({ ...f, whatsapp_cloud_template_name: v }))
            }
          />
        </div>
        <Area
          label="In-app message"
          value={form.in_app_message}
          onChange={(v) => setForm((f) => ({ ...f, in_app_message: v }))}
          rows={2}
        />
        <Area
          label="WhatsApp wa.me body"
          value={form.whatsapp_body}
          onChange={(v) => setForm((f) => ({ ...f, whatsapp_body: v }))}
          rows={2}
        />

        <div className="border border-border rounded-lg p-3 space-y-2 bg-muted/20">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-foreground">Aperçu</span>
            <Input
              value={previewName}
              onChange={(e) => setPreviewName(e.target.value)}
              className="h-7 text-xs max-w-[140px]"
              placeholder="{{name}}"
            />
          </div>
          <p className="text-xs text-muted-foreground whitespace-pre-wrap">
            {interpolateOutreach(
              form.whatsapp_body || form.push_body || form.in_app_message,
              previewVars,
            ) || "—"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate(form)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
          >
            {saveMutation.isPending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Save size={12} />
            )}
            Enregistrer
          </button>
          {form.id && (
            <button
              type="button"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (confirm("Supprimer ce template ?")) {
                  deleteMutation.mutate(form.id!);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border border-destructive/40 text-destructive"
            >
              <Trash2 size={12} /> Supprimer
            </button>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground">
          Variables : {"{{name}}"}, {"{{cta_url}}"}. WhatsApp Cloud reste désactivé tant que les
          secrets Meta ne sont pas configurés.
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 text-sm"
      />
    </div>
  );
}

function Area({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows: number;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full text-sm rounded-md border border-input bg-background px-3 py-2"
      />
    </div>
  );
}
