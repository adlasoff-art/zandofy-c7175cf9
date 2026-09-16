/**
 * Vendor component to manage mobile money payment numbers.
 * Allowed when admin-grandfathered OR active vendor_mm_numbers subscription.
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_OPERATORS = [
  { operator: "orange_money", operator_label: "Orange Money", sort_order: 0 },
  { operator: "mpesa", operator_label: "M-Pesa", sort_order: 1 },
  { operator: "airtel_money", operator_label: "Airtel Money", sort_order: 2 },
  { operator: "afrimoney", operator_label: "AfriMoney", sort_order: 3 },
];

interface NumberEntry {
  operator: string;
  operator_label: string;
  phone_number: string;
  display_name: string;
  sort_order: number;
}

async function resolveMmAllowed(storeId: string): Promise<boolean> {
  const { data: override } = await (supabase as any)
    .from("vendor_pricing_overrides")
    .select("vendor_custom_payment_numbers_enabled, mm_granted_by_admin")
    .eq("store_id", storeId)
    .maybeSingle();

  if (override?.mm_granted_by_admin === true && override?.vendor_custom_payment_numbers_enabled === true) {
    return true;
  }

  const { data: subs } = await (supabase as any)
    .from("store_package_subscriptions")
    .select("paid_until, is_active, service_packages!inner(slug)")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .eq("service_packages.slug", "vendor_mm_numbers")
    .limit(1);

  const sub = subs?.[0];
  if (!sub?.is_active) return false;
  if (sub.paid_until && new Date(sub.paid_until).getTime() <= Date.now()) return false;
  return true;
}

export function VendorPaymentNumbers({ storeId }: { storeId: string }) {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [numbers, setNumbers] = useState<NumberEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const isAllowed = await resolveMmAllowed(storeId);
      setAllowed(isAllowed);

      if (!isAllowed) {
        setLoading(false);
        return;
      }

      const { data: existing } = await (supabase as any)
        .from("store_payment_numbers")
        .select("operator, operator_label, phone_number, display_name, sort_order")
        .eq("store_id", storeId)
        .order("sort_order");

      if (existing && existing.length > 0) {
        const merged = DEFAULT_OPERATORS.map((def) => {
          const found = existing.find((e: NumberEntry) => e.operator === def.operator);
          return found || { ...def, phone_number: "", display_name: "" };
        });
        setNumbers(merged);
      } else {
        setNumbers(DEFAULT_OPERATORS.map((d) => ({ ...d, phone_number: "", display_name: "" })));
      }
      setLoading(false);
    }
    load();
  }, [storeId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const n of numbers) {
        await (supabase as any)
          .from("store_payment_numbers")
          .upsert(
            {
              store_id: storeId,
              operator: n.operator,
              operator_label: n.operator_label,
              phone_number: n.phone_number.trim(),
              display_name: n.display_name.trim(),
              sort_order: n.sort_order,
              is_active: n.phone_number.trim() !== "",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "store_id,operator" }
          );
      }
      toast.success("Numéros de paiement mis à jour");
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-4 flex justify-center">
        <Loader2 size={16} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="bg-card border border-dashed border-border rounded-lg p-4 space-y-2">
        <p className="text-sm font-medium text-foreground flex items-center gap-2">
          <Phone size={14} className="text-primary" />
          Numéros Mobile Money boutique
        </p>
        <p className="text-xs text-muted-foreground">
          Sans forfait actif, les clients paient via les canaux plateforme Zandofy.
          Abonnez-vous (~$9,99/mois) dans l&apos;onglet Tarification pour afficher vos propres numéros.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-4">
      <div>
        <label className="text-sm font-medium text-foreground flex items-center gap-2 mb-1">
          <Phone size={14} className="text-primary" />
          Numéros de paiement Mobile Money
        </label>
        <p className="text-xs text-muted-foreground">
          Ces numéros s&apos;affichent au checkout quand votre forfait MM est actif (ou accord admin).
        </p>
      </div>

      <div className="space-y-3">
        {numbers.map((entry, idx) => (
          <div key={entry.operator} className="border border-border rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-foreground">{entry.operator_label}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-muted-foreground block mb-0.5">Numéro de téléphone</label>
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
        Enregistrer les numéros
      </button>
    </div>
  );
}
