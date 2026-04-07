import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Smartphone, Save, Loader2, Info } from "lucide-react";
import { toast } from "sonner";

const PROVIDERS = [
  { id: "twilio", name: "Twilio", fields: ["account_sid", "auth_token", "from_number"], description: "API SMS mondiale, fiable et évolutive. Idéal pour des envois internationaux." },
  { id: "vonage", name: "Vonage (Nexmo)", fields: ["api_key", "api_secret", "from_number"], description: "Excellente couverture en Afrique, tarifs compétitifs." },
  { id: "africastalking", name: "Africa's Talking", fields: ["username", "api_key", "from_number"], description: "Spécialisé Afrique. Couverture RDC, Congo, Cameroun. Tarifs locaux avantageux." },
  { id: "infobip", name: "Infobip", fields: ["api_key", "base_url", "from_number"], description: "Grande couverture mondiale, support omnicanal (SMS + WhatsApp)." },
];

const db = supabase as any;

export function SmsConfigPanel() {
  const [config, setConfig] = useState<any>(null);
  const [provider, setProvider] = useState("twilio");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [isActive, setIsActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    db.from("sms_provider_config").select("*").limit(1).then(({ data }: any) => {
      if (data?.[0]) {
        setConfig(data[0]);
        setProvider(data[0].provider);
        setFields(data[0].config || {});
        setIsActive(data[0].is_active);
      }
      setLoading(false);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const row = { provider, is_active: isActive, config: fields, updated_at: new Date().toISOString() };
      if (config?.id) {
        await db.from("sms_provider_config").update(row).eq("id", config.id);
      } else {
        const { data } = await db.from("sms_provider_config").insert(row).select().single();
        setConfig(data);
      }
      toast.success("Configuration SMS sauvegardée");
    } catch {
      toast.error("Erreur lors de la sauvegarde");
    }
    setSaving(false);
  };

  const currentProvider = PROVIDERS.find((p) => p.id === provider);

  if (loading) return <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Smartphone size={16} className="text-primary" />
        Configuration SMS
      </div>

      <div className="bg-muted/30 border border-border rounded-lg p-3">
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info size={12} className="shrink-0 mt-0.5" />
          <div>
            <p className="mb-1">Pour activer les notifications SMS, configurez un fournisseur ci-dessous. Les SMS seront envoyés via l'API du fournisseur choisi.</p>
            <p>Recommandé pour l'Afrique : <strong>Africa's Talking</strong> ou <strong>Vonage</strong>.</p>
          </div>
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground block mb-1">Fournisseur</label>
        <select
          value={provider}
          onChange={(e) => { setProvider(e.target.value); setFields({}); }}
          className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm"
        >
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        {currentProvider && (
          <p className="text-[10px] text-muted-foreground mt-1">{currentProvider.description}</p>
        )}
      </div>

      {currentProvider?.fields.map((field) => (
        <div key={field}>
          <label className="text-xs text-muted-foreground block mb-1 capitalize">{field.replace(/_/g, " ")}</label>
          <input
            type={field.includes("token") || field.includes("secret") || field.includes("key") ? "password" : "text"}
            value={fields[field] || ""}
            onChange={(e) => setFields({ ...fields, [field]: e.target.value })}
            className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm"
            placeholder={`Entrez votre ${field.replace(/_/g, " ")}`}
          />
        </div>
      ))}

      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground">Activer les SMS</label>
        <button
          onClick={() => setIsActive(!isActive)}
          className={`w-10 h-5 rounded-full relative transition-colors ${isActive ? "bg-primary" : "bg-muted border border-border"}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-card shadow transition-transform ${isActive ? "left-5" : "left-0.5"}`} />
        </button>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        Sauvegarder
      </button>
    </div>
  );
}
