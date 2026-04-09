import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Search, Plus, Trash2, GripVertical, Star, ShoppingCart, Heart, Loader2, TrendingUp } from "lucide-react";

interface Product {
  id: string;
  name: string;
  image_url: string | null;
  price: number;
  sales_count: number;
  rating: number;
  review_count: number;
}

interface TrendingEntry {
  id: string;
  product_id: string;
  sort_order: number;
  product: Product;
}

export default function TrendingProductsManager() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [trending, setTrending] = useState<TrendingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  const loadTrending = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("trending_products")
      .select("id, product_id, sort_order")
      .order("sort_order");

    if (data && data.length > 0) {
      const productIds = data.map((d: any) => d.product_id);
      const { data: products } = await supabase
        .from("products")
        .select("id, name, price, sales_count, rating, review_count")
        .in("id", productIds);

      const productMap = new Map((products || []).map((p: any) => [p.id, p]));
      setTrending(
        data
          .map((d: any) => ({
            ...d,
            product: productMap.get(d.product_id) as Product,
          }))
          .filter((d: any) => d.product)
      );
    } else {
      setTrending([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadTrending(); }, [loadTrending]);

  const handleSearch = useCallback(async (q: string) => {
    setSearch(q);
    if (q.length < 2) { setResults([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from("products")
      .select("id, name, price, sales_count, rating, review_count")
      .ilike("name", `%${q}%`)
      .order("sales_count", { ascending: false })
      .limit(10);
    setResults((data as any) || []);
    setSearching(false);
  }, []);

  const addProduct = async (productId: string) => {
    const maxOrder = trending.length > 0 ? Math.max(...trending.map((t) => t.sort_order)) + 1 : 0;
    await (supabase as any).from("trending_products").insert({ product_id: productId, sort_order: maxOrder });
    toast({ title: "Produit ajouté aux tendances" });
    setSearch("");
    setResults([]);
    loadTrending();
  };

  const removeProduct = async (id: string) => {
    await (supabase as any).from("trending_products").delete().eq("id", id);
    toast({ title: "Produit retiré des tendances" });
    loadTrending();
  };

  const moveProduct = async (index: number, direction: "up" | "down") => {
    const newTrending = [...trending];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newTrending.length) return;

    const tempOrder = newTrending[index].sort_order;
    newTrending[index].sort_order = newTrending[swapIndex].sort_order;
    newTrending[swapIndex].sort_order = tempOrder;

    await Promise.all([
      (supabase as any).from("trending_products").update({ sort_order: newTrending[index].sort_order }).eq("id", newTrending[index].id),
      (supabase as any).from("trending_products").update({ sort_order: newTrending[swapIndex].sort_order }).eq("id", newTrending[swapIndex].id),
    ]);
    loadTrending();
  };

  const trendingIds = new Set(trending.map((t) => t.product_id));

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
          <TrendingUp size={16} className="text-primary" />
          Produits Top Tendances ({trending.length}/12)
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Sélectionnez jusqu'à 12 produits à mettre en avant dans la section "Top Tendances".
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher un produit par nom..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="pl-9 text-sm"
        />
        {searching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />}
      </div>

      {/* Search results */}
      {results.length > 0 && (
        <div className="border border-border rounded-xl overflow-hidden divide-y divide-border max-h-64 overflow-y-auto">
          {results.map((p) => (
            <div key={p.id} className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors">
              <img src={p.image_url || "/placeholder.svg"} alt={p.name} className="w-10 h-10 rounded-lg object-cover bg-muted" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-0.5"><ShoppingCart size={10} />{p.sales_count} ventes</span>
                  <span className="flex items-center gap-0.5"><Star size={10} className="text-warning" />{p.rating}</span>
                  <span>{p.review_count} avis</span>
                </div>
              </div>
              {trendingIds.has(p.id) ? (
                <span className="text-[10px] text-muted-foreground px-2 py-1 bg-muted rounded-full">Déjà ajouté</span>
              ) : (
                <button
                  onClick={() => addProduct(p.id)}
                  disabled={trending.length >= 12}
                  className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-40"
                >
                  <Plus size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Current trending products */}
      <div className="space-y-2">
        {trending.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">Aucun produit en tendance. Recherchez et ajoutez des produits ci-dessus.</p>
        )}
        {trending.map((entry, i) => (
          <div key={entry.id} className="flex items-center gap-3 bg-card border border-border rounded-xl p-3">
            <div className="flex flex-col gap-0.5 shrink-0">
              <button onClick={() => moveProduct(i, "up")} disabled={i === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-20 transition-colors">
                <GripVertical size={12} />
              </button>
            </div>
            <span className="text-xs font-mono text-muted-foreground w-5 text-center shrink-0">#{i + 1}</span>
            <img src={entry.product.image_url || "/placeholder.svg"} alt={entry.product.name} className="w-10 h-10 rounded-lg object-cover bg-muted shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{entry.product.name}</p>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-0.5"><ShoppingCart size={10} />{entry.product.sales_count} ventes</span>
                <span className="flex items-center gap-0.5"><Star size={10} className="text-warning" />{entry.product.rating}</span>
                <span>{entry.product.review_count} avis</span>
              </div>
            </div>
            <button onClick={() => removeProduct(entry.id)} className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 transition-colors shrink-0">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
