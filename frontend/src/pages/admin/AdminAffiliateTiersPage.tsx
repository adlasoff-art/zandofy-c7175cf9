import { AdminLayout } from "@/components/admin/AdminLayout";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Save, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AffiliateTier {
  id: string;
  tier_name: string;
  min_referrals: number;
  commission_pct: number;
  bonus_points: number;
  badge_label: string;
}

export default function AdminAffiliateTiersPage() {
  const [tiers, setTiers] = useState<AffiliateTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ tier_name: "", min_referrals: "", commission_pct: "", bonus_points: "", badge_label: "" });
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("affiliate_tiers").select("*").order("min_referrals");
    setTiers((data || []) as AffiliateTier[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!form.tier_name.trim()) return;
    setAdding(true);
    const { error } = await supabase.from("affiliate_tiers").insert({
      tier_name: form.tier_name.trim(),
      min_referrals: Number(form.min_referrals) || 0,
      commission_pct: Number(form.commission_pct) || 5,
      bonus_points: Number(form.bonus_points) || 0,
      badge_label: form.badge_label.trim() || form.tier_name.trim(),
    });
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else { toast({ title: "Palier ajouté" }); setForm({ tier_name: "", min_referrals: "", commission_pct: "", bonus_points: "", badge_label: "" }); load(); }
    setAdding(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("affiliate_tiers").delete().eq("id", id);
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else { toast({ title: "Palier supprimé" }); load(); }
  };

  return (
    <AdminLayout title="Paliers d'affiliation">
      <div className="space-y-6 max-w-3xl">
        <p className="text-sm text-muted-foreground">Gérez les paliers du programme d'affiliation (commission, bonus, seuil de filleuls).</p>

        {/* Add form */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Plus size={16} className="text-primary" /> Nouveau palier
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <Input placeholder="Nom du palier" value={form.tier_name} onChange={e => setForm(f => ({ ...f, tier_name: e.target.value }))} />
            <Input type="number" placeholder="Min filleuls" min="0" value={form.min_referrals} onChange={e => setForm(f => ({ ...f, min_referrals: e.target.value }))} />
            <Input type="number" placeholder="Commission %" step="0.1" min="0" value={form.commission_pct} onChange={e => setForm(f => ({ ...f, commission_pct: e.target.value }))} />
            <Input type="number" placeholder="Bonus pts" min="0" value={form.bonus_points} onChange={e => setForm(f => ({ ...f, bonus_points: e.target.value }))} />
            <Input placeholder="Badge" value={form.badge_label} onChange={e => setForm(f => ({ ...f, badge_label: e.target.value }))} />
          </div>
          <Button onClick={handleAdd} disabled={adding || !form.tier_name} size="sm" className="mt-3">
            {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Ajouter
          </Button>
        </div>

        {/* Existing tiers */}
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={24} /></div>
        ) : tiers.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">Aucun palier configuré.</p>
        ) : (
          <div className="space-y-2">
            {tiers.map(tier => (
              <TierRow key={tier.id} tier={tier} saving={saving === tier.id} onSave={async (id, updates) => {
                setSaving(id);
                const { error } = await supabase.from("affiliate_tiers").update(updates).eq("id", id);
                if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
                else { toast({ title: "Palier mis à jour" }); load(); }
                setSaving(null);
              }} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function TierRow({ tier, saving, onSave, onDelete }: {
  tier: AffiliateTier;
  saving: boolean;
  onSave: (id: string, updates: Partial<AffiliateTier>) => void;
  onDelete: (id: string) => void;
}) {
  const [values, setValues] = useState({
    min_referrals: tier.min_referrals,
    commission_pct: tier.commission_pct,
    bonus_points: tier.bonus_points,
    badge_label: tier.badge_label,
  });

  return (
    <div className="bg-card border border-border rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <Award size={16} className="text-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground">{tier.tier_name}</p>
        <p className="text-[10px] text-muted-foreground">≥ {values.min_referrals} filleuls · {values.commission_pct}% · {values.bonus_points} pts bonus</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <Input type="number" min="0" value={values.min_referrals} onChange={e => setValues(v => ({ ...v, min_referrals: Number(e.target.value) }))} className="w-20 h-8 text-sm" placeholder="Min" />
        <Input type="number" step="0.1" min="0" value={values.commission_pct} onChange={e => setValues(v => ({ ...v, commission_pct: Number(e.target.value) }))} className="w-20 h-8 text-sm" placeholder="%" />
        <Input type="number" min="0" value={values.bonus_points} onChange={e => setValues(v => ({ ...v, bonus_points: Number(e.target.value) }))} className="w-20 h-8 text-sm" placeholder="Pts" />
        <Input value={values.badge_label} onChange={e => setValues(v => ({ ...v, badge_label: e.target.value }))} className="w-24 h-8 text-sm" placeholder="Badge" />
      </div>
      <Button size="sm" variant="outline" onClick={() => onSave(tier.id, values)} disabled={saving}>
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
      </Button>
      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDelete(tier.id)}>
        <Trash2 size={14} />
      </Button>
    </div>
  );
}
