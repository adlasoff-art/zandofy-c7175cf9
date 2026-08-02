import { useEffect, useState } from "react";
import { BarChart3, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listSeoOverrides } from "@/hooks/use-seo-overrides";

export function SeoCoverageSection() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    pagesWithTitle: 0,
    pagesTotal: 0,
    productsWithMeta: 0,
    productsTotal: 0,
    categoriesWithMeta: 0,
    categoriesTotal: 0,
    storesWithMeta: 0,
    storesTotal: 0,
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ rows }, productsAll, productsMeta, catsAll, catsMeta, storesAll, storesMeta] =
        await Promise.all([
          listSeoOverrides(),
          supabase
            .from("products")
            .select("id", { count: "exact", head: true })
            .eq("publish_status", "published"),
          supabase
            .from("products")
            .select("id", { count: "exact", head: true })
            .eq("publish_status", "published")
            .not("meta_title", "is", null),
          supabase.from("categories").select("id", { count: "exact", head: true }),
          supabase
            .from("categories")
            .select("id", { count: "exact", head: true })
            .not("meta_title", "is", null),
          supabase.from("stores").select("id", { count: "exact", head: true }),
          supabase
            .from("stores")
            .select("id", { count: "exact", head: true })
            .not("meta_title", "is", null),
        ]);

      const withTitle = rows.filter((r) => r.title).length;
      setStats({
        pagesWithTitle: withTitle,
        pagesTotal: rows.length,
        productsWithMeta: productsMeta.count ?? 0,
        productsTotal: productsAll.count ?? 0,
        categoriesWithMeta: catsMeta.count ?? 0,
        categoriesTotal: catsAll.count ?? 0,
        storesWithMeta: storesMeta.count ?? 0,
        storesTotal: storesAll.count ?? 0,
      });
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="animate-spin text-primary" size={20} />
      </div>
    );
  }

  const Card = ({ label, done, total }: { label: string; done: number; total: number }) => (
    <div className="rounded-lg border border-border p-3 bg-muted/20">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold text-foreground">
        {done}
        <span className="text-sm font-normal text-muted-foreground"> / {total}</span>
      </p>
    </div>
  );

  return (
    <section className="bg-card border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 size={18} className="text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Couverture SEO</h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Card label="Pages (overrides avec titre)" done={stats.pagesWithTitle} total={stats.pagesTotal} />
        <Card label="Produits publiés avec meta titre" done={stats.productsWithMeta} total={stats.productsTotal} />
        <Card label="Catégories avec meta titre" done={stats.categoriesWithMeta} total={stats.categoriesTotal} />
        <Card label="Boutiques avec meta titre" done={stats.storesWithMeta} total={stats.storesTotal} />
      </div>
    </section>
  );
}
