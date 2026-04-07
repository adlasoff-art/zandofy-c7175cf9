import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Gift, Snowflake, PartyPopper, Plus, Trash2, Edit2, Loader2, Play, Pause } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { RichTextEditor } from "./RichTextEditor";

const db = supabase as any;

const CAMPAIGN_TYPES = [
  { value: "birthday", label: "Anniversaire", icon: Gift, description: "Envoyé le jour de l'anniversaire de chaque client" },
  { value: "christmas", label: "Noël", icon: Snowflake, description: "Envoyé avant/le jour de Noël (24-25 déc.)" },
  { value: "new_year", label: "Nouvel An", icon: PartyPopper, description: "Envoyé pour le Nouvel An (31 déc. - 1er jan.)" },
  { value: "custom", label: "Personnalisé", icon: Calendar, description: "Date personnalisée de votre choix" },
];

const DEFAULT_BIRTHDAY_HTML = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px;text-align:center;">
  <h1 style="color:#1a1a1a;font-size:24px;">🎂 Joyeux Anniversaire !</h1>
  <p style="color:#555;font-size:16px;line-height:1.6;">Cher(e) {{name}},</p>
  <p style="color:#555;line-height:1.6;">Toute l'équipe Zandofy vous souhaite un très joyeux anniversaire ! 🎉</p>
  <p style="color:#555;line-height:1.6;">Merci pour votre fidélité et vos <strong>{{order_count}}</strong> commandes sur notre plateforme.</p>
  <p style="color:#555;line-height:1.6;">Pour célébrer, voici un code promo spécial : <strong style="color:#e63946;font-size:18px;">{{promo_code}}</strong></p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
  <p style="color:#aaa;font-size:12px;">Zandofy — Votre marketplace de confiance</p>
</div>`;

const DEFAULT_CHRISTMAS_HTML = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px;text-align:center;">
  <h1 style="color:#1a1a1a;font-size:24px;">🎄 Joyeuses Fêtes !</h1>
  <p style="color:#555;font-size:16px;line-height:1.6;">Cher(e) {{name}},</p>
  <p style="color:#555;line-height:1.6;">L'équipe Zandofy vous souhaite de très belles fêtes de fin d'année ! ❄️</p>
  <p style="color:#555;line-height:1.6;">Profitez de nos offres spéciales avec le code : <strong style="color:#e63946;font-size:18px;">{{promo_code}}</strong></p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
  <p style="color:#aaa;font-size:12px;">Zandofy — Votre marketplace de confiance</p>
</div>`;

const DEFAULT_NEWYEAR_HTML = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px;text-align:center;">
  <h1 style="color:#1a1a1a;font-size:24px;">🎆 Bonne Année !</h1>
  <p style="color:#555;font-size:16px;line-height:1.6;">Cher(e) {{name}},</p>
  <p style="color:#555;line-height:1.6;">Toute l'équipe Zandofy vous présente ses meilleurs vœux pour cette nouvelle année ! 🥂</p>
  <p style="color:#555;line-height:1.6;">Merci pour votre confiance et vos <strong>{{order_count}}</strong> commandes.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
  <p style="color:#aaa;font-size:12px;">Zandofy — Votre marketplace de confiance</p>
</div>`;

export function CampaignsPanel() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    campaign_type: "birthday",
    name: "",
    subject: "",
    html_content: "",
    promo_code: "",
    schedule_month: 0,
    schedule_day: 0,
    days_before: 0,
    batch_size: 10,
    batch_interval_minutes: 20,
    is_active: true,
  });

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ["scheduled-campaigns"],
    queryFn: async () => {
      const { data } = await db.from("scheduled_campaigns").select("*").order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name || !form.subject) throw new Error("Nom et sujet requis");
      const row = {
        ...form,
        schedule_month: form.schedule_month || null,
        schedule_day: form.schedule_day || null,
        updated_at: new Date().toISOString(),
      };
      if (editing?.id) {
        await db.from("scheduled_campaigns").update(row).eq("id", editing.id);
      } else {
        await db.from("scheduled_campaigns").insert(row);
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Campagne modifiée" : "Campagne créée");
      queryClient.invalidateQueries({ queryKey: ["scheduled-campaigns"] });
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await db.from("scheduled_campaigns").delete().eq("id", id); },
    onSuccess: () => {
      toast.success("Campagne supprimée");
      queryClient.invalidateQueries({ queryKey: ["scheduled-campaigns"] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      await db.from("scheduled_campaigns").update({ is_active: active, updated_at: new Date().toISOString() }).eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["scheduled-campaigns"] }),
  });

  const resetForm = () => {
    setForm({ campaign_type: "birthday", name: "", subject: "", html_content: "", promo_code: "", schedule_month: 0, schedule_day: 0, days_before: 0, batch_size: 10, batch_interval_minutes: 20, is_active: true });
    setEditing(null);
    setShowForm(false);
  };

  const editCampaign = (c: any) => {
    setForm({
      campaign_type: c.campaign_type,
      name: c.name,
      subject: c.subject,
      html_content: c.html_content,
      promo_code: c.promo_code || "",
      schedule_month: c.schedule_month || 0,
      schedule_day: c.schedule_day || 0,
      days_before: c.days_before || 0,
      batch_size: c.batch_size,
      batch_interval_minutes: c.batch_interval_minutes,
      is_active: c.is_active,
    });
    setEditing(c);
    setShowForm(true);
  };

  const prefillTemplate = (type: string) => {
    if (type === "birthday") {
      setForm((f) => ({ ...f, campaign_type: type, name: "Anniversaire client", subject: "🎂 Joyeux Anniversaire de la part de Zandofy !", html_content: DEFAULT_BIRTHDAY_HTML }));
    } else if (type === "christmas") {
      setForm((f) => ({ ...f, campaign_type: type, name: "Noël", subject: "🎄 Joyeuses Fêtes — Zandofy", html_content: DEFAULT_CHRISTMAS_HTML, schedule_month: 12, schedule_day: 24, days_before: 0 }));
    } else if (type === "new_year") {
      setForm((f) => ({ ...f, campaign_type: type, name: "Nouvel An", subject: "🎆 Meilleurs Vœux — Zandofy", html_content: DEFAULT_NEWYEAR_HTML, schedule_month: 12, schedule_day: 31, days_before: 0 }));
    } else {
      setForm((f) => ({ ...f, campaign_type: type }));
    }
  };

  const typeInfo = CAMPAIGN_TYPES.find((t) => t.value === form.campaign_type);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Calendar size={16} className="text-primary" />
          Campagnes automatiques
        </h3>
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded-lg hover:bg-primary/90">
            <Plus size={12} /> Nouvelle
          </button>
        )}
      </div>

      {/* Campaign list */}
      {!showForm && (
        <div className="space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin text-primary" /></div>
          ) : campaigns.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Aucune campagne configurée</p>
          ) : (
            campaigns.map((c: any) => {
              const t = CAMPAIGN_TYPES.find((t) => t.value === c.campaign_type);
              const Icon = t?.icon || Calendar;
              return (
                <div key={c.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border">
                  <Icon size={16} className="text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{c.name}</p>
                    <p className="text-[10px] text-muted-foreground">{t?.label} · Lot de {c.batch_size} / {c.batch_interval_minutes} min</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => toggleMutation.mutate({ id: c.id, active: !c.is_active })} className={`p-1.5 rounded ${c.is_active ? "text-primary" : "text-muted-foreground"}`}>
                      {c.is_active ? <Play size={12} /> : <Pause size={12} />}
                    </button>
                    <button onClick={() => editCampaign(c)} className="p-1.5 rounded text-muted-foreground hover:text-foreground"><Edit2 size={12} /></button>
                    <button onClick={() => deleteMutation.mutate(c.id)} className="p-1.5 rounded text-muted-foreground hover:text-destructive"><Trash2 size={12} /></button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <div className="space-y-3 border border-border rounded-lg p-4 bg-card">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Type de campagne</label>
            <div className="grid grid-cols-2 gap-1.5">
              {CAMPAIGN_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => prefillTemplate(t.value)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border transition-colors ${
                    form.campaign_type === t.value ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground border-border hover:bg-muted"
                  }`}
                >
                  <t.icon size={12} /> {t.label}
                </button>
              ))}
            </div>
            {typeInfo && <p className="text-[10px] text-muted-foreground mt-1">{typeInfo.description}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Nom</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Sujet email</label>
              <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm" />
            </div>
          </div>

          {form.campaign_type !== "birthday" && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Mois</label>
                <input type="number" min={1} max={12} value={form.schedule_month} onChange={(e) => setForm({ ...form, schedule_month: +e.target.value })} className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Jour</label>
                <input type="number" min={1} max={31} value={form.schedule_day} onChange={(e) => setForm({ ...form, schedule_day: +e.target.value })} className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Jours avant</label>
                <input type="number" min={0} value={form.days_before} onChange={(e) => setForm({ ...form, days_before: +e.target.value })} className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm" />
              </div>
            </div>
          )}

          <div>
            <label className="text-xs text-muted-foreground block mb-1">Code promo (optionnel)</label>
            <input value={form.promo_code} onChange={(e) => setForm({ ...form, promo_code: e.target.value })} placeholder="Ex: ANNIV2025" className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm" />
          </div>

          <div>
            <label className="text-xs text-muted-foreground block mb-1">Contenu email (HTML enrichi)</label>
            <RichTextEditor value={form.html_content} onChange={(html) => setForm({ ...form, html_content: html })} placeholder="Composez votre email..." />
            <p className="text-[10px] text-muted-foreground mt-1">Variables disponibles : {"{{name}}"}, {"{{order_count}}"}, {"{{promo_code}}"}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Emails par lot</label>
              <input type="number" min={1} max={50} value={form.batch_size} onChange={(e) => setForm({ ...form, batch_size: +e.target.value })} className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Intervalle (min)</label>
              <input type="number" min={5} max={120} value={form.batch_interval_minutes} onChange={(e) => setForm({ ...form, batch_interval_minutes: +e.target.value })} className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm" />
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50">
              {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
              {editing ? "Modifier" : "Créer la campagne"}
            </button>
            <button onClick={resetForm} className="px-4 py-2 bg-muted text-foreground text-sm rounded-lg hover:bg-muted/80">Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}
