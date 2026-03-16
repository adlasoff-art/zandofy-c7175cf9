import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Crown, Store, Search, Loader2, Check, X, MessageCircle, Truck, Eye, EyeOff, Ticket, Users } from "lucide-react";
import { VENDOR_TIERS, PUBLISH_STATUS_CONFIG, type VendorTier } from "@/lib/vendor-tiers";
import { Switch } from "@/components/ui/switch";

interface StoreWithSub {
  id: string;
  name: string;
  owner_id: string | null;
  products_count: number | null;
  is_verified: boolean | null;
  can_create_coupons: boolean;
  max_collaborators_override: number | null;
  subscription: {
    id: string;
    tier: VendorTier;
    max_products: number;
    is_whatsapp_enabled: boolean;
    can_self_deliver: boolean;
    paid_until: string | null;
  } | null;
}

const TIER_OPTIONS: VendorTier[] = ["beginner", "pro", "grand_supplier"];

export default function AdminVendorSubscriptionsPage() {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: stores = [], isLoading } = useQuery({
    queryKey: ["admin-vendor-subs"],
    queryFn: async () => {
      const { data: storesData } = await supabase
        .from("stores")
        .select("id, name, owner_id, products_count, is_verified, can_create_coupons, max_collaborators_override")
        .order("name") as { data: any[] | null };

      if (!storesData) return [];

      const storeIds = storesData.map((s) => s.id);
      const { data: subs } = await supabase
        .from("vendor_subscriptions")
        .select("*")
        .in("store_id", storeIds);

      const subMap = new Map((subs || []).map((s: any) => [s.store_id, s]));

      return storesData.map((s) => ({
        ...s,
        subscription: subMap.get(s.id) || null,
      })) as StoreWithSub[];
    },
  });

  const updateSub = useMutation({
    mutationFn: async ({
      storeId,
      field,
      value,
    }: {
      storeId: string;
      field: string;
      value: any;
    }) => {
      // Check if subscription exists
      const store = stores.find((s) => s.id === storeId);
      if (!store?.subscription?.id) {
        // Create subscription first
        const tierValue = field === "tier" ? value : "beginner";
        const maxProducts = field === "tier" ? VENDOR_TIERS[value as VendorTier]?.maxProducts || 10 : 10;
        const { error } = await supabase.from("vendor_subscriptions").insert({
          store_id: storeId,
          tier: tierValue,
          max_products: maxProducts === Infinity ? 999999 : maxProducts,
          is_whatsapp_enabled: field === "is_whatsapp_enabled" ? value : false,
          can_self_deliver: field === "can_self_deliver" ? value : false,
        } as any);
        if (error) throw error;
      } else {
        const updateData: any = { [field]: value };
        // Auto-update max_products when tier changes
        if (field === "tier") {
          const maxP = VENDOR_TIERS[value as VendorTier]?.maxProducts || 10;
          updateData.max_products = maxP === Infinity ? 999999 : maxP;
        }
        const { error } = await supabase
          .from("vendor_subscriptions")
          .update(updateData)
          .eq("store_id", storeId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-vendor-subs"] });
      toast.success("Abonnement mis à jour");
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  const approveProduct = useMutation({
    mutationFn: async ({ productId, approve }: { productId: string; approve: boolean }) => {
      const { error } = await supabase
        .from("products")
        .update({ publish_status: approve ? "published" : "rejected" } as any)
        .eq("id", productId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-products"] });
      toast.success("Statut du produit mis à jour");
    },
  });

  const { data: pendingProducts = [] } = useQuery({
    queryKey: ["pending-products"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name_fr, price, currency, store_id")
        .filter("publish_status", "eq", "pending_approval")
        .order("created_at", { ascending: false });
    },
  });

  const filtered = stores.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout title="Abonnements vendeurs">
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Crown size={20} className="text-primary" />
          Abonnements vendeurs
        </h1>

        {/* Pending product approvals */}
        {pendingProducts.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 space-y-3">
            <h2 className="text-sm font-bold text-amber-700 dark:text-amber-400">
              Produits en attente d'approbation ({pendingProducts.length})
            </h2>
            <div className="space-y-2">
              {pendingProducts.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between bg-card rounded-md p-2 border border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground">{p.name_fr}</p>
                    <p className="text-xs text-muted-foreground">{p.price} {p.currency}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => approveProduct.mutate({ productId: p.id, approve: true })}
                      className="p-1.5 rounded-md bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => approveProduct.mutate({ productId: p.id, approve: false })}
                      className="p-1.5 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher une boutique..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-card border border-border rounded-md"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((store) => {
              const sub = store.subscription;
              const tier = (sub?.tier || "beginner") as VendorTier;
              const tierCfg = VENDOR_TIERS[tier];

              return (
                <div key={store.id} className="bg-card border border-border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Store size={16} className="text-primary" />
                      <span className="text-sm font-bold text-foreground">{store.name}</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${tierCfg.badgeClass}`}>
                        {tierCfg.label}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {store.products_count || 0} produits
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {/* Tier selector */}
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Plan</label>
                      <select
                        value={tier}
                        onChange={(e) =>
                          updateSub.mutate({
                            storeId: store.id,
                            field: "tier",
                            value: e.target.value,
                          })
                        }
                        className="w-full px-2 py-1.5 text-sm bg-card border border-border rounded-md"
                      >
                        {TIER_OPTIONS.map((t) => (
                          <option key={t} value={t}>
                            {VENDOR_TIERS[t].label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* WhatsApp toggle */}
                    <div className="flex items-center justify-between sm:flex-col sm:items-start gap-1">
                      <label className="text-xs text-muted-foreground flex items-center gap-1">
                        <MessageCircle size={12} /> WhatsApp
                      </label>
                      <Switch
                        checked={sub?.is_whatsapp_enabled || false}
                        onCheckedChange={(v) =>
                          updateSub.mutate({
                            storeId: store.id,
                            field: "is_whatsapp_enabled",
                            value: v,
                          })
                        }
                      />
                    </div>

                    {/* Self-delivery toggle */}
                    <div className="flex items-center justify-between sm:flex-col sm:items-start gap-1">
                      <label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Truck size={12} /> Self-Delivery
                      </label>
                      <Switch
                        checked={sub?.can_self_deliver || false}
                        onCheckedChange={(v) =>
                          updateSub.mutate({
                            storeId: store.id,
                            field: "can_self_deliver",
                            value: v,
                          })
                        }
                      />
                    </div>

                    {/* Coupons toggle */}
                    <div className="flex items-center justify-between sm:flex-col sm:items-start gap-1">
                      <label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Ticket size={12} /> Coupons
                      </label>
                      <Switch
                        checked={store.can_create_coupons || false}
                        onCheckedChange={async (v) => {
                          const { error } = await supabase
                            .from("stores")
                            .update({ can_create_coupons: v } as any)
                            .eq("id", store.id);
                          if (!error) {
                            queryClient.invalidateQueries({ queryKey: ["admin-vendor-subs"] });
                            toast.success(v ? "Coupons activés" : "Coupons désactivés");
                          } else toast.error("Erreur");
                        }}
                      />
                    </div>

                    {/* Max collaborators override */}
                    <div className="flex items-center justify-between sm:flex-col sm:items-start gap-1">
                      <label className="text-xs text-muted-foreground flex items-center gap-1">
                        <Users size={12} /> Max collabs
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={50}
                        placeholder={String(VENDOR_TIERS[tier].maxCollaborators)}
                        defaultValue={store.max_collaborators_override ?? ""}
                        onBlur={async (e) => {
                          const val = e.target.value.trim();
                          const override = val === "" ? null : parseInt(val, 10);
                          const { error } = await supabase
                            .from("stores")
                            .update({ max_collaborators_override: override } as any)
                            .eq("id", store.id);
                          if (!error) {
                            queryClient.invalidateQueries({ queryKey: ["admin-vendor-subs"] });
                            toast.success("Limite collaborateurs mise à jour");
                          } else toast.error("Erreur");
                        }}
                        className="w-16 px-2 py-1 text-sm bg-card border border-border rounded-md text-center"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
