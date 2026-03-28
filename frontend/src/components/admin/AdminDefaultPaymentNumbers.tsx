/**
 * Admin component to manage default platform-wide Mobile Money payment numbers.
 * These are used when a store doesn't have custom numbers enabled.
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Loader2, Save } from "lucide-react";
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
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "default_payment_numbers")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value && typeof data.value === "object") {
          const v = data.value as any;
          if (Array.isArray(v.numbers) && v.numbers.length > 0) {
            // Merge with defaults to ensure all operators present
            const merged = EMPTY_NUMBERS.map((def) => {
              const found = v.numbers.find((n: NumberEntry) => n.operator === def.operator);
              return found ? { ...def, phone_number: found.phone_number || "", display_name: found.display_name || "" } : def;
            });
            setNumbers(merged);
          }
        }
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("platform_settings")
        .upsert({
          key: "default_payment_numbers",
          value: { numbers } as any,
          updated_at: new Date().toISOString(),
        });
      if (error) throw error;
      toast.success("Numéros par défaut enregistrés");
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
          Ces numéros s'affichent au checkout pour les boutiques qui n'ont pas de numéros personnalisés.
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
