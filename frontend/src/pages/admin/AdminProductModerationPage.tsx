import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShieldCheck, Search, Loader2, Check, X, Eye, Store, Filter } from "lucide-react";
import { PUBLISH_STATUS_CONFIG } from "@/lib/vendor-tiers";

type StatusFilter = "pending_approval" | "published" | "rejected" | "draft" | "all";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "pending_approval", label: "En attente" },
  { value: "published", label: "Publiés" },
  { value: "rejected", label: "Refusés" },
  { value: "draft", label: "Brouillons" },
  { value: "all", label: "Tous" },
];

export default function AdminProductModerationPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending_approval");
  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["admin-product-moderation", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("id, name_fr, name, price, currency, publish_status, store_id, created_at, stock_quantity")
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("publish_status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Fetch store names
      const storeIds = [...new Set(data.filter(p => p.store_id).map(p => p.store_id!))];
      const { data: stores } = await supabase
        .from("stores")
        .select("id, name")
        .in("id", storeIds);

      const storeMap = new Map((stores || []).map(s => [s.id, s.name]));

      return data.map(p => ({
        ...p,
        store_name: p.store_id ? storeMap.get(p.store_id) || "—" : "—",
      }));
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ productId, status }: { productId: string; status: string }) => {
      const { error } = await supabase
        .from("products")
        .update({ publish_status: status } as any)
        .eq("id", productId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-product-moderation"] });
      toast.success("Statut du produit mis à jour");
    },
    onError: () => toast.error("Erreur lors de la mise à jour"),
  });

  const filtered = products.filter(p =>
    p.name_fr?.toLowerCase().includes(search.toLowerCase()) ||
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.store_name?.toLowerCase().includes(search.toLowerCase())
  );

  const pendingCount = products.filter(p => p.publish_status === "pending_approval").length;

  return (
    <AdminLayout title="Modération produits">
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <ShieldCheck size={20} className="text-primary" />
            Modération des produits
          </h1>
          {statusFilter === "pending_approval" && pendingCount > 0 && (
            <span className="text-sm font-medium px-3 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              {pendingCount} en attente
            </span>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Rechercher par nom de produit ou boutique..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-card border border-border rounded-md"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-muted-foreground" />
            <div className="flex gap-1 flex-wrap">
              {STATUS_FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    statusFilter === f.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ShieldCheck size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Aucun produit trouvé pour ce filtre.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((product) => {
              const statusCfg = PUBLISH_STATUS_CONFIG[product.publish_status] || PUBLISH_STATUS_CONFIG.draft;
              const isPending = product.publish_status === "pending_approval";

              return (
                <div
                  key={product.id}
                  className={`bg-card border rounded-lg p-4 transition-colors ${
                    isPending ? "border-amber-300 dark:border-amber-700" : "border-border"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-foreground truncate">
                          {product.name_fr || product.name}
                        </h3>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusCfg.badgeClass}`}>
                          {statusCfg.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Store size={12} />
                          {product.store_name}
                        </span>
                        <span>{product.price} {product.currency}</span>
                        <span>Stock: {product.stock_quantity ?? "—"}</span>
                        <span>{new Date(product.created_at).toLocaleDateString("fr-FR")}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {product.publish_status !== "published" && (
                        <button
                          onClick={() => updateStatus.mutate({ productId: product.id, status: "published" })}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 transition-colors"
                          title="Approuver et publier"
                        >
                          <Check size={14} />
                          Approuver
                        </button>
                      )}
                      {product.publish_status !== "rejected" && (
                        <button
                          onClick={() => updateStatus.mutate({ productId: product.id, status: "rejected" })}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                          title="Rejeter le produit"
                        >
                          <X size={14} />
                          Rejeter
                        </button>
                      )}
                      {product.publish_status === "published" && (
                        <button
                          onClick={() => updateStatus.mutate({ productId: product.id, status: "pending_approval" })}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                          title="Retirer de la publication"
                        >
                          <Eye size={14} />
                          Dépublier
                        </button>
                      )}
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
