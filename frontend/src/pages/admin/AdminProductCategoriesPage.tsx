import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { toast } from "sonner";
import { FolderTree, Search, Loader2, Save, CheckSquare, Square } from "lucide-react";
import { imgUrl } from "@/lib/image-url";
import { DataTablePagination } from "@/components/ui/DataTablePagination";

interface CategoryRow {
  id: string;
  name: string;
  name_fr: string;
  parent_id: string | null;
}

const PAGE_SIZE = 25;

async function logCategoryAudit(productIds: string[], fromCategoryId: string | null, toCategoryId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("admin_audit_logs").insert({
    admin_id: user.id,
    action: "product_category_update",
    target_user_id: user.id,
    details: {
      product_ids: productIds,
      from_category_id: fromCategoryId,
      to_category_id: toCategoryId,
    },
  });
}

export default function AdminProductCategoriesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [parentFilter, setParentFilter] = useState("");
  const [onParentOnly, setOnParentOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [rowEdits, setRowEdits] = useState<Record<string, string>>({});

  const { data: categories = [], isLoading: catsLoading } = useQuery({
    queryKey: ["admin-all-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, name_fr, parent_id")
        .order("name_fr");
      if (error) throw error;
      return (data || []) as CategoryRow[];
    },
  });

  const parentCategories = useMemo(
    () => categories.filter((c) => !c.parent_id),
    [categories],
  );

  const parentIdsWithChildren = useMemo(() => {
    const set = new Set<string>();
    for (const c of categories) {
      if (c.parent_id) set.add(c.parent_id);
    }
    return set;
  }, [categories]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-product-categories", search, parentFilter, onParentOnly, page, pageSize],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select(
          "id, name_fr, name, category_id, store_id, publish_status, product_images(image_url, position)",
          { count: "exact" },
        )
        .eq("publish_status", "published")
        .order("name_fr")
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (search.trim()) {
        query = query.or(`name_fr.ilike.%${search.trim()}%,name.ilike.%${search.trim()}%`);
      }

      if (parentFilter) {
        const childIds = categories.filter((c) => c.parent_id === parentFilter).map((c) => c.id);
        query = query.in("category_id", [parentFilter, ...childIds]);
      }

      const { data: products, error, count } = await query;
      if (error) throw error;

      let rows = products || [];
      if (onParentOnly) {
        rows = rows.filter((p) => p.category_id && parentIdsWithChildren.has(p.category_id));
      }

      const storeIds = [...new Set(rows.map((p) => p.store_id).filter(Boolean))] as string[];
      let storeMap = new Map<string, string>();
      if (storeIds.length) {
        const { data: stores } = await supabase.from("stores").select("id, name").in("id", storeIds);
        storeMap = new Map((stores || []).map((s) => [s.id, s.name]));
      }

      const catMap = new Map(categories.map((c) => [c.id, c]));

      return {
        totalCount: onParentOnly ? rows.length : count || 0,
        products: rows.map((p) => {
          const cat = p.category_id ? catMap.get(p.category_id) : null;
          const parent = cat?.parent_id ? catMap.get(cat.parent_id) : null;
          const images = (p as { product_images?: { image_url: string; position: number | null }[] })
            .product_images;
          const sorted = [...(images || [])].sort(
            (a, b) => (a.position ?? 0) - (b.position ?? 0),
          );
          return {
            id: p.id,
            name_fr: p.name_fr,
            category_id: p.category_id,
            category_name: cat?.name_fr || "—",
            parent_name: parent?.name_fr || (cat && !cat.parent_id ? cat.name_fr : "—"),
            store_name: p.store_id ? storeMap.get(p.store_id) || "—" : "—",
            image: sorted[0]?.image_url || null,
          };
        }),
      };
    },
    enabled: categories.length > 0 || !catsLoading,
  });

  const products = data?.products || [];
  const totalCount = data?.totalCount || 0;

  const updateCategory = useMutation({
    mutationFn: async ({
      productIds,
      categoryId,
      previousIds,
    }: {
      productIds: string[];
      categoryId: string;
      previousIds: Record<string, string | null>;
    }) => {
      const { error } = await supabase
        .from("products")
        .update({ category_id: categoryId, updated_at: new Date().toISOString() })
        .in("id", productIds);
      if (error) throw error;
      for (const pid of productIds) {
        await logCategoryAudit([pid], previousIds[pid] ?? null, categoryId);
      }
    },
    onSuccess: () => {
      toast.success("Catégorie mise à jour");
      setSelected(new Set());
      setRowEdits({});
      queryClient.invalidateQueries({ queryKey: ["admin-product-categories"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === products.length) setSelected(new Set());
    else setSelected(new Set(products.map((p) => p.id)));
  };

  const handleRowSave = (productId: string, currentCategoryId: string | null) => {
    const next = rowEdits[productId];
    if (!next || next === currentCategoryId) return;
    updateCategory.mutate({
      productIds: [productId],
      categoryId: next,
      previousIds: { [productId]: currentCategoryId },
    });
  };

  const handleBulkMove = () => {
    if (!bulkCategoryId || selected.size === 0) {
      toast.error("Sélectionnez des produits et une catégorie cible");
      return;
    }
    const previousIds: Record<string, string | null> = {};
    for (const p of products) {
      if (selected.has(p.id)) previousIds[p.id] = p.category_id;
    }
    updateCategory.mutate({
      productIds: [...selected],
      categoryId: bulkCategoryId,
      previousIds,
    });
  };

  return (
    <AdminLayout title="Catégorisation produits">
      <div className="p-4 md:p-6 space-y-4 max-w-7xl">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FolderTree size={16} className="text-primary" />
          Réassigner catégorie et sous-catégorie (admin uniquement).
        </div>

        <div className="flex flex-wrap gap-3 items-end bg-card border border-border rounded-xl p-4">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-medium text-foreground block mb-1">Recherche</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Nom produit…"
                className="w-full pl-9 pr-3 py-2 text-sm bg-muted border border-border rounded-lg"
              />
            </div>
          </div>
          <div className="min-w-[180px]">
            <label className="text-xs font-medium text-foreground block mb-1">Catégorie parente</label>
            <select
              value={parentFilter}
              onChange={(e) => {
                setParentFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-sm bg-muted border border-border rounded-lg"
            >
              <option value="">Toutes</option>
              {parentCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name_fr}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer pb-2">
            <input
              type="checkbox"
              checked={onParentOnly}
              onChange={(e) => {
                setOnParentOnly(e.target.checked);
                setPage(1);
              }}
            />
            Sur catégorie parente uniquement
          </label>
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 bg-primary/5 border border-primary/20 rounded-xl p-3">
            <span className="text-sm font-medium">{selected.size} sélectionné(s)</span>
            <select
              value={bulkCategoryId}
              onChange={(e) => setBulkCategoryId(e.target.value)}
              className="px-3 py-2 text-sm bg-background border border-border rounded-lg min-w-[200px]"
            >
              <option value="">Catégorie cible…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.parent_id ? "↳ " : ""}
                  {c.name_fr}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleBulkMove}
              disabled={updateCategory.isPending}
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg disabled:opacity-50"
            >
              Déplacer la sélection
            </button>
          </div>
        )}

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {isLoading || catsLoading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="p-3 w-10">
                      <button type="button" onClick={toggleSelectAll} aria-label="Tout sélectionner">
                        {selected.size === products.length && products.length > 0 ? (
                          <CheckSquare size={16} />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    </th>
                    <th className="p-3 text-left font-medium">Produit</th>
                    <th className="p-3 text-left font-medium">Boutique</th>
                    <th className="p-3 text-left font-medium">Catégorie actuelle</th>
                    <th className="p-3 text-left font-medium min-w-[220px]">Nouvelle catégorie</th>
                    <th className="p-3 w-16" />
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const editValue = rowEdits[p.id] ?? p.category_id ?? "";
                    return (
                      <tr key={p.id} className="border-b border-border hover:bg-muted/30">
                        <td className="p-3">
                          <button type="button" onClick={() => toggleSelect(p.id)}>
                            {selected.has(p.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                          </button>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {p.image ? (
                              <img
                                src={imgUrl(p.image, 80)}
                                alt=""
                                className="w-10 h-10 rounded object-cover border border-border"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded bg-muted" />
                            )}
                            <span className="font-medium line-clamp-2 max-w-[200px]">{p.name_fr}</span>
                          </div>
                        </td>
                        <td className="p-3 text-muted-foreground">{p.store_name}</td>
                        <td className="p-3">
                          <span className="text-foreground">{p.category_name}</span>
                          {p.parent_name !== p.category_name && (
                            <span className="block text-[10px] text-muted-foreground">{p.parent_name}</span>
                          )}
                        </td>
                        <td className="p-3">
                          <select
                            value={editValue}
                            onChange={(e) =>
                              setRowEdits((prev) => ({ ...prev, [p.id]: e.target.value }))
                            }
                            className="w-full px-2 py-1.5 text-xs bg-muted border border-border rounded-lg"
                          >
                            <option value="">—</option>
                            {parentCategories.map((parent) => (
                              <optgroup key={parent.id} label={parent.name_fr}>
                                <option value={parent.id}>{parent.name_fr} (parent)</option>
                                {categories
                                  .filter((c) => c.parent_id === parent.id)
                                  .map((sub) => (
                                    <option key={sub.id} value={sub.id}>
                                      {sub.name_fr}
                                    </option>
                                  ))}
                              </optgroup>
                            ))}
                          </select>
                        </td>
                        <td className="p-3">
                          <button
                            type="button"
                            disabled={
                              updateCategory.isPending ||
                              !rowEdits[p.id] ||
                              rowEdits[p.id] === p.category_id
                            }
                            onClick={() => handleRowSave(p.id, p.category_id)}
                            className="p-2 text-primary hover:bg-primary/10 rounded-lg disabled:opacity-30"
                            title="Enregistrer"
                          >
                            <Save size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {products.length === 0 && (
                <p className="p-8 text-center text-muted-foreground text-sm">Aucun produit trouvé.</p>
              )}
            </div>
          )}
        </div>

        <DataTablePagination
          currentPage={page}
          pageSize={pageSize}
          totalItems={totalCount}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(1);
          }}
        />
      </div>
    </AdminLayout>
  );
}
