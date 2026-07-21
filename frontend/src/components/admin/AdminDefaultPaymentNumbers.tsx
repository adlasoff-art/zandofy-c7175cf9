/**
 * Admin component to manage default platform-wide Mobile Money payment numbers
 * and the WhatsApp China order number used in product share messages.
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Loader2, Save, MessageCircle } from "lucide-react";
import { toast } from "sonner";

interface NumberEntry {
  operator: string;
  operator_label: string;
  phone_number: string;
  display_name: string;
  sort_order: number;
}

const EMPTY_NUMBERS: NumberEntry[] = [
  { operator: "orange_money", operator_label: "Orange Money", phone_number: "", display_name: "", sort_order: 0 },
  { operator: "mpesa", operator_label: "M-Pesa", phone_number: "", display_name: "", sort_order: 1 },
  { operator: "airtel_money", operator_label: "Airtel Money", phone_number: "", display_name: "", sort_order: 2 },
  { operator: "afrimoney", operator_label: "AfriMoney", phone_number: "", display_name: "", sort_order: 3 },
];

export function AdminDefaultPaymentNumbers() {
  const [numbers, setNumbers] = useState<NumberEntry[]>(EMPTY_NUMBERS);
  const [chinaWhatsApp, setChinaWhatsApp] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "default_payment_numbers")
        .maybeSingle(),
      supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "whatsapp_china_order_number")
        .maybeSingle(),
    ]).then(([paymentRes, chinaRes]) => {
      if (paymentRes.data?.value && typeof paymentRes.data.value === "object") {
        const v = paymentRes.data.value as { numbers?: NumberEntry[] };
        if (Array.isArray(v.numbers) && v.numbers.length > 0) {
          const merged = EMPTY_NUMBERS.map((def) => {
            const found = v.numbers!.find((n) => n.operator === def.operator);
            return found
              ? { ...def, phone_number: found.phone_number || "", display_name: found.display_name || "" }
              : def;
          });
          setNumbers(merged);
        }
      }
      if (chinaRes.data?.value && typeof chinaRes.data.value === "object") {
        const v = chinaRes.data.value as { phone?: string };
        setChinaWhatsApp(v.phone || "");
      }
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const { error: payError } = await supabase
        .from("platform_settings")
        .upsert(
          {
            key: "default_payment_numbers",
            value: { numbers } as any,
            updated_at: now,
          },
          { onConflict: "key" },
        );
      if (payError) throw payError;

      const { error: chinaError } = await supabase
        .from("platform_settings")
        .upsert(
          {
            key: "whatsapp_china_order_number",
            value: { phone: chinaWhatsApp.trim() } as any,
            updated_at: now,
          },
          { onConflict: "key" },
        );
      if (chinaError) throw chinaError;

      toast.success("Numéros enregistrés");
    } catch (e: any) {
      toast.error(e.message || "Erreur");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 size={16} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Phone size={14} className="text-primary" />
          Numéros de paiement par défaut
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Ces numéros s&apos;affichent au checkout et dans le partage WhatsApp produit (Orange, M-Pesa, Airtel).
        </p>
      </div>

      <div className="space-y-3">
        {numbers.map((entry, idx) => (
          <div key={entry.operator} className="border border-border rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-foreground">{entry.operator_label}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-muted-foreground block mb-0.5">Numéro</label>
                <input
                  type="tel"
                  value={entry.phone_number}
                  onChange={(e) => {
                    const updated = [...numbers];
                    updated[idx] = { ...updated[idx], phone_number: e.target.value };
                    setNumbers(updated);
                  }}
                  placeholder="Ex: 0991234567"
                  className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground block mb-0.5">Nom affiché (USSD/App)</label>
                <input
                  type="text"
                  value={entry.display_name}
                  onChange={(e) => {
                    const updated = [...numbers];
                    updated[idx] = { ...updated[idx], display_name: e.target.value };
                    setNumbers(updated);
                  }}
                  placeholder="Nom visible par le client"
                  className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border border-border rounded-lg p-3 space-y-2">
        <h4 className="text-xs font-semibold text-foreground flex items-center gap-2">
          <MessageCircle size={14} className="text-primary" />
          WhatsApp commandes Chine
        </h4>
        <p className="text-[11px] text-muted-foreground">
          Numéro affiché dans le message de partage produit (« envoyez votre commande uniquement sur ce numéro »).
        </p>
        <input
          type="tel"
          value={chinaWhatsApp}
          onChange={(e) => setChinaWhatsApp(e.target.value)}
          placeholder="Ex: +447832621129"
          className="w-full px-3 py-2 text-sm bg-card border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        Enregistrer les numéros par défaut
      </button>
    </div>
  );
}
