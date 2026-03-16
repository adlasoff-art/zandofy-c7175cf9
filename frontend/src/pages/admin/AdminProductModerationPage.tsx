import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShieldCheck, Search, Loader2, Check, X, Eye, Store, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { PUBLISH_STATUS_CONFIG } from "@/lib/vendor-tiers";

type StatusFilter = "pending_approval" | "published" | "rejected" | "draft" | "all";

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "pending_approval", label: "En attente" },
  { value: "published", label: "Publiés" },
  { value: "rejected", label: "Refusés" },
  { value: "draft", label: "Brouillons" },
  { value: "all", label: "Tous" },
];

const PAGE_SIZE = 20;

export default function AdminProductModerationPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending_approval");
  const [page, setPage] = useState(0);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-product-moderation", statusFilter, page],
    queryFn: async () => {
      let countQuery = supabase
        .from("products")
        .select("id", { count: "exact", head: true });

      if (statusFilter !== "all") {
        countQuery = countQuery.eq("publish_status", statusFilter);
      }

      const { count } = await countQuery;

      let query = supabase
        .from("products")
        .select("id, name_fr, name, price, currency, publish_status, store_id, created_at, stock_quantity")
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (statusFilter !== "all") {
        query = query.eq("publish_status", statusFilter);
      }

      const { data: products, error } = await query;
      if (error) throw error;
      if (!products || products.length === 0) return { products: [], totalCount: count || 0 };

      const storeIds = [...new Set(products.filter(p => p.store_id).map(p => p.store_id!))];
      let storeMap = new Map<string, string>();
      if (storeIds.length > 0) {
        const { data: stores } = await supabase
          .from("stores")
          .select("id, name")
          .in("id", storeIds);
        storeMap = new Map((stores || []).map(s => [s.id, s.name]));
      }

      return {
        products: products.map(p => ({
          ...p,
          store_name: p.store_id ? storeMap.get(p.store_id) || "—" : "—",
        })),
        totalCount: count || 0,
      };
    },
  });

  const products = data?.products || [];
  const totalCount = data?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const updateStatus = useMutation({
    mutationFn: async ({ productId, status }: { productId: string; status: string }) => {
      const { data: updated, error } = await supabase
        .from("products")
        .update({ publish_status: status } as any)
        .eq("id", productId)
        .select("id, publish_status");

      if (error) throw error;

      if (!updated || updated.length === 0) {
        throw new Error("Mise à jour bloquée — vérifiez vos permissions.");
      }

      if (updated[0].publish_status !== status) {
        throw new Error("Le statut n'a pas été modifié.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-product-moderation"] });
      toast.success("Statut du produit mis à jour");
    },
    onError: (err: Error) => toast.error(err.message || "Erreur lors de la mise à jour"),
  });

  const filtered = products.filter(p =>
    p.name_fr?.toLowerCase().includes(search.toLowerCase()) ||
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.store_name?.toLowerCase().includes(search.toLowerCase())
  );

  const pendingCount = statusFilter === "pending_approval" ? totalCount : 0;

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
                  onClick={() => { setStatusFilter(f.value); setPage(0); }}
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
          <>
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
                            disabled={updateStatus.isPending}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 transition-colors disabled:opacity-50"
                            title="Approuver et publier"
                          >
                            <Check size={14} />
                            Approuver
                          </button>
                        )}
                        {product.publish_status !== "rejected" && (
                          <button
                            onClick={() => updateStatus.mutate({ productId: product.id, status: "rejected" })}
                            disabled={updateStatus.isPending}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors disabled:opacity-50"
                            title="Rejeter le produit"
                          >
                            <X size={14} />
                            Rejeter
                          </button>
                        )}
                        {product.publish_status === "published" && (
                          <button
                            onClick={() => updateStatus.mutate({ productId: product.id, status: "pending_approval" })}
                            disabled={updateStatus.isPending}
                            className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-muted text-muted-foreground hover:bg-muted/80 transition-colors disabled:opacity-50"
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Page {page + 1} sur {totalPages} ({totalCount} produits)
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-muted text-muted-foreground hover:bg-muted/80 transition-colors disabled:opacity-40"
                  >
                    <ChevronLeft size={14} />
                    Précédent
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md bg-muted text-muted-foreground hover:bg-muted/80 transition-colors disabled:opacity-40"
                  >
                    Suivant
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}
