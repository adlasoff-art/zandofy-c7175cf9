import { AdminLayout } from "@/components/admin/AdminLayout";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Save, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ExchangeRate {
  id: string;
  base_currency: string;
  target_currency: string;
  rate: number;
  updated_at: string;
}

export default function AdminExchangeRatesPage() {
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [newTarget, setNewTarget] = useState("");
  const [newRate, setNewRate] = useState("");
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("exchange_rates").select("*").order("target_currency");
    setRates((data || []) as ExchangeRate[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleUpdate = async (id: string, rate: number) => {
    setSaving(id);
    const { error } = await supabase.from("exchange_rates").update({ rate, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else { toast({ title: "Taux mis à jour" }); load(); }
    setSaving(null);
  };

  const handleAdd = async () => {
    if (!newTarget.trim() || !newRate) return;
    setAdding(true);
    const { error } = await supabase.from("exchange_rates").insert({
      base_currency: "USD",
      target_currency: newTarget.toUpperCase().trim(),
      rate: Number(newRate),
    });
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else { toast({ title: "Taux ajouté" }); setNewTarget(""); setNewRate(""); load(); }
    setAdding(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("exchange_rates").delete().eq("id", id);
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else { toast({ title: "Taux supprimé" }); load(); }
  };

  return (
    <AdminLayout title="Taux de change">
      <div className="space-y-6 max-w-2xl">
        <p className="text-sm text-muted-foreground">Gérez les taux de conversion par rapport au USD (devise de base).</p>

        {/* Add new rate */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Plus size={16} className="text-primary" /> Ajouter un taux
          </h2>
          <div className="flex gap-2">
            <Input placeholder="Devise (ex: EUR)" value={newTarget} onChange={e => setNewTarget(e.target.value)} className="w-32" />
            <Input type="number" placeholder="Taux" step="0.0001" min="0" value={newRate} onChange={e => setNewRate(e.target.value)} className="w-40" />
            <Button onClick={handleAdd} disabled={adding || !newTarget || !newRate} size="sm">
              {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Ajouter
            </Button>
          </div>
        </div>

        {/* Existing rates */}
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={24} /></div>
        ) : rates.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">Aucun taux configuré.</p>
        ) : (
          <div className="space-y-2">
            {rates.map(rate => (
              <RateRow key={rate.id} rate={rate} saving={saving === rate.id} onSave={handleUpdate} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function RateRow({ rate, saving, onSave, onDelete }: {
  rate: ExchangeRate;
  saving: boolean;
  onSave: (id: string, rate: number) => void;
  onDelete: (id: string) => void;
}) {
  const [value, setValue] = useState(rate.rate);
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-3">
      <DollarSign size={16} className="text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground">1 USD = <span className="text-primary">{value}</span> {rate.target_currency}</p>
        <p className="text-[10px] text-muted-foreground">Mis à jour : {new Date(rate.updated_at).toLocaleDateString("fr-FR")}</p>
      </div>
      <Input type="number" step="0.0001" min="0" value={value} onChange={e => setValue(Number(e.target.value))} className="w-28 h-8 text-sm" />
      <Button size="sm" variant="outline" onClick={() => onSave(rate.id, value)} disabled={saving}>
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
      </Button>
      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDelete(rate.id)}>
        <Trash2 size={14} />
      </Button>
    </div>
  );
}
