import { AdminLayout } from "@/components/admin/AdminLayout";
import { Search, Store, Save, Loader2, ShieldAlert, Settings } from "lucide-react";
import { AdminCreateStoreDialog } from "@/components/admin/AdminCreateStoreDialog";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";

function GlobalPricingDefaults({ defaults }: { defaults: any }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [txFee, setTxFee] = useState<string>("");

  const currentFee = txFee || String(defaults?.transaction_fee_pct ?? 5);

  const handleSave = async () => {
    setSaving(true);
    const newValue = {
      ...defaults,
      transaction_fee_pct: Number(currentFee) || 5,
    };
    const { error } = await supabase
      .from("platform_settings")
      .update({ value: newValue as any, updated_at: new Date().toISOString() })
      .eq("key", "pricing_defaults");
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Enregistré", description: "Paramètres globaux mis à jour." });
      queryClient.invalidateQueries({ queryKey: ["pricing-defaults"] });
    }
    setSaving(false);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Settings size={16} className="text-primary" />
        <span className="text-sm font-semibold text-foreground">Paramètres globaux de tarification</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Marge (%)</label>
          <input type="number" value={defaults?.margin_pct ?? 15} readOnly className="w-full px-2 py-1.5 text-sm bg-muted/50 border border-border rounded-md cursor-not-allowed" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Multiplicateur</label>
          <input type="number" value={defaults?.multiplier ?? 3} readOnly className="w-full px-2 py-1.5 text-sm bg-muted/50 border border-border rounded-md cursor-not-allowed" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Frais transaction (%)</label>
          <input
            type="number"
            min={0}
            max={50}
            step={0.5}
            value={currentFee}
            onChange={(e) => setTxFee(e.target.value)}
            className="w-full px-2 py-1.5 text-sm bg-muted border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <p className="text-[10px] text-muted-foreground mt-1">Alibaba, plateformes, etc.</p>
        </div>
        <div className="flex items-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Sauvegarder
          </button>
        </div>
      </div>
    </div>
  );
}

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
    max_products_override: number | null;
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
    vendor_cod_enabled: boolean;
    vendor_off_platform_enabled: boolean;
    vendor_custom_payment_numbers_enabled: boolean;
    vendor_mobile_money_enabled: boolean;
    vendor_card_enabled: boolean;
    vendor_mode: string;
    returns_enabled: boolean;
    suppliers_enabled: boolean;
    max_products_override: string;
    collaborator_limit_override: string;
    vendor_webhook_url: string;
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
      let q = (supabase as any).from("stores").select("id, name, owner_id, is_platform_owned, returns_enabled").order("name");
      if (search) q = q.ilike("name", `%${search}%`);
      const { data: storesData } = await q.limit(50);
      if (!storesData?.length) return [];

      const storeIds = storesData.map((s: any) => s.id);
      const { data: overrides } = await (supabase as any)
        .from("vendor_pricing_overrides")
        .select("*")
        .in("store_id", storeIds);

      const overrideMap = new Map((overrides || []).map((o: any) => [o.store_id, o]));

      return storesData.map((s: any) => ({
        ...s,
        override: overrideMap.get(s.id) || null,
      })) as StoreWithOverride[];
    },
  });

  // Fetch pending ownership claims for badge display
  const { data: pendingClaims } = useQuery({
    queryKey: ["admin-pending-claims"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("platform_ownership_claims")
        .select("id, store_id, status, expires_at")
        .in("status", ["pending", "accepted"]);
      return (data || []) as { id: string; store_id: string; status: string; expires_at: string }[];
    },
  });

  const claimsByStore = new Map((pendingClaims || []).map((c) => [c.store_id, c]));

  const handleResolveClaim = async (claimId: string, newStatus: "dismissed" | "accepted", storeId: string) => {
    setSavingId(storeId);

    if (newStatus === "accepted") {
      // Vendor contested → revert to independent
      const { error: storeErr } = await (supabase as any)
        .from("stores")
        .update({ is_platform_owned: false })
        .eq("id", storeId)
        .select();
      if (storeErr) {
        toast({ title: "Erreur", description: storeErr.message, variant: "destructive" });
        setSavingId(null);
        return;
      }
    }

    await (supabase as any)
      .from("platform_ownership_claims")
      .update({ status: newStatus, resolved_at: new Date().toISOString() })
      .eq("id", claimId);

    toast({ title: "Contestation traitée", description: newStatus === "accepted" ? "Boutique remise en indépendante." : "Contestation rejetée." });
    queryClient.invalidateQueries({ queryKey: ["admin-stores-pricing"] });
    queryClient.invalidateQueries({ queryKey: ["admin-pending-claims"] });
    setSavingId(null);
  };

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
      vendor_cod_enabled: (o as any)?.vendor_cod_enabled ?? false,
      vendor_off_platform_enabled: (o as any)?.vendor_off_platform_enabled ?? false,
      vendor_custom_payment_numbers_enabled: (o as any)?.vendor_custom_payment_numbers_enabled ?? false,
      vendor_mobile_money_enabled: (o as any)?.vendor_mobile_money_enabled ?? true,
      vendor_card_enabled: (o as any)?.vendor_card_enabled ?? true,
      vendor_mode: (o as any)?.vendor_mode ?? "international",
      returns_enabled: (store as any).returns_enabled ?? false,
      suppliers_enabled: (o as any)?.suppliers_enabled ?? false,
      max_products_override: o?.max_products_override != null ? String(o.max_products_override) : "",
      collaborator_limit_override: (o as any)?.collaborator_limit_override != null ? String((o as any).collaborator_limit_override) : "",
    };
  };

  const updateEdit = (storeId: string, field: string, value: any) => {
    setEdits((prev) => ({
      ...prev,
      [storeId]: { ...getEditForId(storeId), [field]: value },
    }));
  };

  const getEditForId = (storeId: string) => {
    const store = stores?.find((s) => s.id === storeId);
    if (!store) return { margin_pct: "", multiplier: "", max_extra_margin: "", vendor_extra_margin_enabled: false, commission_rate: "", is_platform_owned: false, vendor_cod_enabled: false, vendor_off_platform_enabled: false, vendor_custom_payment_numbers_enabled: false, vendor_mobile_money_enabled: true, vendor_card_enabled: true, vendor_mode: "international", returns_enabled: false, suppliers_enabled: false, max_products_override: "", collaborator_limit_override: "" };
    return getEdit(store);
  };

  const handleSave = async (store: StoreWithOverride) => {
    setSavingId(store.id);
    const edit = getEdit(store);

    // Update is_platform_owned and returns_enabled on store
    const storeUpdates: Record<string, any> = {};
    if (edit.is_platform_owned !== (store.is_platform_owned ?? false)) {
      storeUpdates.is_platform_owned = edit.is_platform_owned;
    }
    if (edit.returns_enabled !== ((store as any).returns_enabled ?? false)) {
      storeUpdates.returns_enabled = edit.returns_enabled;
    }

    if (Object.keys(storeUpdates).length > 0) {
      const { data: storeUpdateData, error: storeUpdateError } = await (supabase as any)
        .from("stores")
        .update(storeUpdates)
        .eq("id", store.id)
        .select();

      if (storeUpdateError || !storeUpdateData?.length) {
        toast({ title: "Erreur", description: storeUpdateError?.message || "Impossible de modifier la boutique.", variant: "destructive" });
        setSavingId(null);
        return;
      }

      // Send email notification to vendor if platform ownership changed
      if (storeUpdates.is_platform_owned !== undefined) {
        try {
          const { data: ownerProfile } = await supabase
            .from("profiles")
            .select("email")
            .eq("id", store.owner_id)
            .single();

          if (ownerProfile?.email) {
            const emailType = edit.is_platform_owned ? "platform_owned" : "reverted_independent";
            supabase.functions.invoke("send-vendor-email", {
              body: {
                to: ownerProfile.email,
                storeName: store.name,
                type: emailType,
              },
            }).catch(() => {});
          }
        } catch {}
      }
    }

    const payload = {
      store_id: store.id,
      margin_pct: edit.margin_pct ? Number(edit.margin_pct) : null,
      multiplier: edit.multiplier ? Number(edit.multiplier) : null,
      max_extra_margin: edit.max_extra_margin ? Number(edit.max_extra_margin) : null,
      vendor_extra_margin_enabled: edit.vendor_extra_margin_enabled,
      commission_rate: edit.commission_rate ? Number(edit.commission_rate) : null,
      vendor_cod_enabled: edit.vendor_cod_enabled,
      vendor_off_platform_enabled: edit.vendor_off_platform_enabled,
      vendor_custom_payment_numbers_enabled: edit.vendor_custom_payment_numbers_enabled,
      vendor_mobile_money_enabled: edit.vendor_mobile_money_enabled,
      vendor_card_enabled: edit.vendor_card_enabled,
      vendor_mode: edit.vendor_mode,
      suppliers_enabled: edit.suppliers_enabled,
      max_products_override: edit.max_products_override ? Number(edit.max_products_override) : null,
      collaborator_limit_override: edit.collaborator_limit_override ? Number(edit.collaborator_limit_override) : null,
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
      queryClient.invalidateQueries({ queryKey: ["admin-pending-claims"] });
    }
    setSavingId(null);
  };

  const inputClass = "w-full px-2 py-1.5 text-sm bg-muted border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20";

  return (
    <AdminLayout title="Tarification par boutique">
      <div className="space-y-4 max-w-4xl">
        {/* Global defaults section */}
        <GlobalPricingDefaults defaults={globalDefaults} />

        {/* Admin create store */}
        <div className="flex justify-end">
          <AdminCreateStoreDialog />
        </div>
        <p className="text-sm text-muted-foreground">
          Configurez la marge (%), le multiplicateur et l'accès à la marge vendeur pour chaque boutique.
          Les champs vides utilisent les valeurs globales par défaut
          {globalDefaults && ` (${globalDefaults.margin_pct}% / ×${globalDefaults.multiplier} / frais ${globalDefaults.transaction_fee_pct ?? 5}%)`}.
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
            const claim = claimsByStore.get(store.id);

            return (
              <div key={store.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Store size={16} className="text-primary" />
                    <span className="text-sm font-semibold text-foreground">{store.name}</span>
                    {edit.is_platform_owned ? (
                      <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded-full font-medium">Plateforme</span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground rounded-full font-medium">Indépendant</span>
                    )}
                    {claim && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-destructive/10 text-destructive rounded-full font-medium flex items-center gap-1">
                        <ShieldAlert size={10} />
                        {claim.status === "accepted" ? "Contestation reçue" : "Contestation en cours"}
                      </span>
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

                {/* Claim resolution UI */}
                {claim && claim.status === "accepted" && (
                  <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 space-y-2">
                    <p className="text-xs text-destructive font-medium">
                      Le vendeur a contesté le statut "Boutique plateforme".
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleResolveClaim(claim.id, "accepted", store.id)}
                        disabled={savingId === store.id}
                        className="px-3 py-1 text-xs font-medium bg-accent text-accent-foreground rounded-md hover:bg-accent/80 transition-colors"
                      >
                        Accepter (remettre indépendant)
                      </button>
                      <button
                        onClick={() => handleResolveClaim(claim.id, "dismissed", store.id)}
                        disabled={savingId === store.id}
                        className="px-3 py-1 text-xs font-medium bg-muted text-muted-foreground rounded-md hover:bg-muted/80 transition-colors"
                      >
                        Rejeter
                      </button>
                    </div>
                  </div>
                )}

                {/* Vendor mode selector */}
                <div className="flex items-center justify-between p-2 bg-accent/30 rounded-lg border border-accent/50">
                  <div>
                    <p className="text-xs font-medium text-foreground">Mode vendeur</p>
                    <p className="text-[10px] text-muted-foreground">
                      {edit.vendor_mode === "local_only"
                        ? "Local uniquement : pas de maritime, shipping local (inter-villes, communes)"
                        : "International : tous les modes de transport disponibles"}
                    </p>
                  </div>
                  <select
                    value={edit.vendor_mode}
                    onChange={(e) => updateEdit(store.id, "vendor_mode", e.target.value)}
                    className="text-xs px-2 py-1.5 bg-muted border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="international">🌍 International</option>
                    <option value="local_only">📍 Local uniquement</option>
                  </select>
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

                <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                  <div>
                    <p className="text-xs font-medium text-foreground">Mobile Money</p>
                    <p className="text-[10px] text-muted-foreground">Autorise cette boutique à accepter les paiements Mobile Money (KelPay).</p>
                  </div>
                  <Switch
                    checked={edit.vendor_mobile_money_enabled}
                    onCheckedChange={(v) => updateEdit(store.id, "vendor_mobile_money_enabled", v)}
                  />
                </div>

                <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                  <div>
                    <p className="text-xs font-medium text-foreground">Carte bancaire (Keccel)</p>
                    <p className="text-[10px] text-muted-foreground">Autorise cette boutique à accepter les paiements par carte Visa/Mastercard.</p>
                  </div>
                  <Switch
                    checked={edit.vendor_card_enabled}
                    onCheckedChange={(v) => updateEdit(store.id, "vendor_card_enabled", v)}
                  />
                </div>

                <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                  <div>
                    <p className="text-xs font-medium text-foreground">Paiement à la livraison vendeur</p>
                    <p className="text-[10px] text-muted-foreground">Autorise cette boutique à accepter le paiement du produit à la livraison.</p>
                  </div>
                  <Switch
                    checked={edit.vendor_cod_enabled}
                    onCheckedChange={(v) => updateEdit(store.id, "vendor_cod_enabled", v)}
                  />
                </div>

                <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                  <div>
                    <p className="text-xs font-medium text-foreground">Paiement hors plateforme</p>
                    <p className="text-[10px] text-muted-foreground">Autorise cette boutique à accepter les paiements hors plateforme (preuve + validation).</p>
                  </div>
                  <Switch
                    checked={edit.vendor_off_platform_enabled}
                    onCheckedChange={(v) => updateEdit(store.id, "vendor_off_platform_enabled", v)}
                  />
                </div>

                <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                  <div>
                    <p className="text-xs font-medium text-foreground">Numéros de paiement personnalisés</p>
                    <p className="text-[10px] text-muted-foreground">Autorise le vendeur à renseigner ses propres numéros Mobile Money.</p>
                  </div>
                  <Switch
                    checked={edit.vendor_custom_payment_numbers_enabled}
                    onCheckedChange={(v) => updateEdit(store.id, "vendor_custom_payment_numbers_enabled", v)}
                  />
                </div>

                <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                  <div>
                    <p className="text-xs font-medium text-foreground">Retours autorisés</p>
                    <p className="text-[10px] text-muted-foreground">Les clients peuvent demander un retour produit.</p>
                  </div>
                  <Switch
                    checked={edit.returns_enabled}
                    onCheckedChange={(v) => updateEdit(store.id, "returns_enabled", v)}
                  />
                </div>

                <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
                  <div>
                    <p className="text-xs font-medium text-foreground">Gestion des fournisseurs</p>
                    <p className="text-[10px] text-muted-foreground">Fonctionnalité payante : permet au vendeur de gérer ses fournisseurs et de les lier à ses produits.</p>
                  </div>
                  <Switch
                    checked={edit.suppliers_enabled}
                    onCheckedChange={(v) => updateEdit(store.id, "suppliers_enabled", v)}
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

                {/* Max products override */}
                <div className="pt-2 border-t border-border grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      Limite de produits (override) <span className="text-[10px] opacity-60">vide = selon le tier</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={9999}
                      step={1}
                      value={edit.max_products_override}
                      onChange={(e) => updateEdit(store.id, "max_products_override", e.target.value)}
                      className={inputClass}
                      placeholder="Automatique (tier)"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      Limite collaborateurs (override) <span className="text-[10px] opacity-60">vide = selon le package</span>
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      step={1}
                      value={edit.collaborator_limit_override}
                      onChange={(e) => updateEdit(store.id, "collaborator_limit_override", e.target.value)}
                      className={inputClass}
                      placeholder="Automatique (package)"
                    />
                  </div>
                </div>

                {isDirty && (
                  <p className="text-[10px] text-destructive/70">Modifications non enregistrées</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </AdminLayout>
  );
}
