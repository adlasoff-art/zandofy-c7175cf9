import { AdminLayout } from "@/components/admin/AdminLayout";
import { Calculator, Search, Store, Save, Loader2, ToggleLeft, ToggleRight, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";

interface StoreWithOverride {
  id: string;
  name: string;
  owner_id: string;
  is_platform_owned: boolean;
  override: {
    id?: string;
    margin_pct: number | null;
    multiplier: number | null;
    max_extra_margin: number | null;
    vendor_extra_margin_enabled: boolean;
    commission_rate: number | null;
  } | null;
}

export default function AdminVendorPricingPage() {
  const [search, setSearch] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, {
    margin_pct: string;
    multiplier: string;
    max_extra_margin: string;
    vendor_extra_margin_enabled: boolean;
    commission_rate: string;
    is_platform_owned: boolean;
  }>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: globalDefaults } = useQuery({
    queryKey: ["pricing-defaults"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "pricing_defaults")
        .single();
      return data?.value as any || { margin_pct: 15, multiplier: 3, max_extra_margin_under_50: 0.50, max_extra_margin_over_100: 1.00 };
    },
  });

  const { data: stores, isLoading } = useQuery({
    queryKey: ["admin-stores-pricing", search],
    queryFn: async () => {
      let q = (supabase as any).from("stores").select("id, name, owner_id, is_platform_owned").order("name");
      if (search) q = q.ilike("name", `%${search}%`);
      const { data: storesData } = await q.limit(50);
      if (!storesData?.length) return [];

      const storeIds = storesData.map((s) => s.id);
      const { data: overrides } = await (supabase as any)
        .from("vendor_pricing_overrides")
        .select("*")
        .in("store_id", storeIds);

      const overrideMap = new Map((overrides || []).map((o: any) => [o.store_id, o]));

      return storesData.map((s) => ({
        ...s,
        override: overrideMap.get(s.id) || null,
      })) as StoreWithOverride[];
    },
  });

  const getEdit = (store: StoreWithOverride) => {
    if (edits[store.id]) return edits[store.id];
    const o = store.override;
    return {
      margin_pct: o?.margin_pct != null ? String(o.margin_pct) : "",
      multiplier: o?.multiplier != null ? String(o.multiplier) : "",
      max_extra_margin: o?.max_extra_margin != null ? String(o.max_extra_margin) : "",
      vendor_extra_margin_enabled: o?.vendor_extra_margin_enabled ?? false,
      commission_rate: o?.commission_rate != null ? String(o.commission_rate) : "",
      is_platform_owned: store.is_platform_owned ?? false,
    };
  };

  const updateEdit = (storeId: string, field: string, value: any) => {
    setEdits((prev) => ({
      ...prev,
      [storeId]: { ...getEditForId(storeId), [field]: value },
    }));
  };

  const getEditForId = (storeId: string) => {
    const store = stores?.find((s: any) => s.id === storeId);
    if (!store) return { margin_pct: "", multiplier: "", max_extra_margin: "", vendor_extra_margin_enabled: false, commission_rate: "", is_platform_owned: false };
    return getEdit(store);
  };

  const handleSave = async (store: StoreWithOverride) => {
    setSavingId(store.id);
    const edit = getEdit(store);

    // Update is_platform_owned on store
    if (edit.is_platform_owned !== (store.is_platform_owned ?? false)) {
      const { data: storeUpdateData, error: storeUpdateError } = await (supabase as any)
        .from("stores")
        .update({ is_platform_owned: edit.is_platform_owned })
        .eq("id", store.id)
        .select();

      if (storeUpdateError || !storeUpdateData?.length) {
        toast({ title: "Erreur", description: storeUpdateError?.message || "Impossible de modifier le statut plateforme. Vérifiez vos permissions.", variant: "destructive" });
        setSavingId(null);
        return;
      }
    }

    const payload = {
      store_id: store.id,
      margin_pct: edit.margin_pct ? Number(edit.margin_pct) : null,
      multiplier: edit.multiplier ? Number(edit.multiplier) : null,
      max_extra_margin: edit.max_extra_margin ? Number(edit.max_extra_margin) : null,
      vendor_extra_margin_enabled: edit.vendor_extra_margin_enabled,
      commission_rate: edit.commission_rate ? Number(edit.commission_rate) : null,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (store.override?.id) {
      const res = await (supabase as any)
        .from("vendor_pricing_overrides")
        .update(payload)
        .eq("id", store.override.id)
        .select();
      error = res.error;
    } else {
      const res = await (supabase as any)
        .from("vendor_pricing_overrides")
        .insert(payload)
        .select();
      error = res.error;
    }

    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Enregistré", description: `Tarification de "${store.name}" mise à jour.` });
      setEdits((prev) => {
        const next = { ...prev };
        delete next[store.id];
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["admin-stores-pricing"] });
    }
    setSavingId(null);
  };

  const inputClass = "w-full px-2 py-1.5 text-sm bg-muted border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20";

  return (
    <AdminLayout title="Tarification par boutique">
      <div className="space-y-4 max-w-4xl">
        <p className="text-sm text-muted-foreground">
          Configurez la marge (%), le multiplicateur et l'accès à la marge vendeur pour chaque boutique.
          Les champs vides utilisent les valeurs globales par défaut
          {globalDefaults && ` (${globalDefaults.margin_pct}% / ×${globalDefaults.multiplier})`}.
        </p>

        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher une boutique..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Chargement...</span>
          </div>
        )}

        {!isLoading && !stores?.length && (
          <p className="text-sm text-muted-foreground text-center py-8">Aucune boutique trouvée.</p>
        )}

        <div className="space-y-3">
          {stores?.map((store) => {
            const edit = getEdit(store);
            const isDirty = !!edits[store.id];

            return (
              <div key={store.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Store size={16} className="text-primary" />
                    <span className="text-sm font-semibold text-foreground">{store.name}</span>
                    {edit.is_platform_owned && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full font-medium">Plateforme</span>
                    )}
                    {!edit.is_platform_owned && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded-full font-medium">Indépendant</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleSave(store)}
                    disabled={savingId === store.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {savingId === store.id ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                    Enregistrer
                  </button>
                </div>

                {/* Platform toggle */}
                <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                  <div>
                    <p className="text-xs font-medium text-foreground">Boutique plateforme</p>
                    <p className="text-[10px] text-muted-foreground">Pas de commission déduite, revenus restent à la plateforme</p>
                  </div>
                  <Switch
                    checked={edit.is_platform_owned}
                    onCheckedChange={(v) => updateEdit(store.id, "is_platform_owned", v)}
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      Marge (%) <span className="text-[10px] opacity-60">défaut: {globalDefaults?.margin_pct ?? 15}</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      step={1}
                      value={edit.margin_pct}
                      onChange={(e) => updateEdit(store.id, "margin_pct", e.target.value)}
                      className={inputClass}
                      placeholder={String(globalDefaults?.margin_pct ?? 15)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      Multiplicateur <span className="text-[10px] opacity-60">défaut: {globalDefaults?.multiplier ?? 3}</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      step={0.5}
                      value={edit.multiplier}
                      onChange={(e) => updateEdit(store.id, "multiplier", e.target.value)}
                      className={inputClass}
                      placeholder={String(globalDefaults?.multiplier ?? 3)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      Marge vendeur max ($)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      step={0.1}
                      value={edit.max_extra_margin}
                      onChange={(e) => updateEdit(store.id, "max_extra_margin", e.target.value)}
                      className={inputClass}
                      placeholder="Global"
                    />
                  </div>
                  <div className="flex flex-col justify-center">
                    <label className="text-xs text-muted-foreground block mb-1">Marge vendeur</label>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={edit.vendor_extra_margin_enabled}
                        onCheckedChange={(v) => updateEdit(store.id, "vendor_extra_margin_enabled", v)}
                      />
                      <span className="text-xs text-foreground">
                        {edit.vendor_extra_margin_enabled ? "Activée" : "Désactivée"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Commission rate — only for independent stores */}
                {!edit.is_platform_owned && (
                  <div className="pt-2 border-t border-border">
                    <label className="text-xs text-muted-foreground block mb-1">
                      Commission plateforme (%) <span className="text-[10px] opacity-60">défaut: {globalDefaults?.platform_commission_default ?? 10}%</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      step={0.5}
                      value={edit.commission_rate}
                      onChange={(e) => updateEdit(store.id, "commission_rate", e.target.value)}
                      className={inputClass + " max-w-[200px]"}
                      placeholder={String(globalDefaults?.platform_commission_default ?? 10)}
                    />
                  </div>
                )}

                {isDirty && (
                  <p className="text-[10px] text-amber-600">Modifications non enregistrées</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AdminLayout>
  );
}
