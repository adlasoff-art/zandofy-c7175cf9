import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";
import { fetchProducts, type Product } from "@/services/api";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/contexts/I18nContext";

export function TopTrends() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();

  useEffect(() => {
    (async () => {
      // Try to load admin-selected trending products first
      const { data: trending } = await (supabase
        .from("trending_products" as any)
        .select("product_id")
        .order("sort_order") as any);

      const trendingIds: string[] = (trending || []).map((t: any) => t.product_id);

      if (trendingIds.length > 0) {
        const allProducts = await fetchProducts({ limit: 50 });
        const trendingSet = new Set(trendingIds);
        const ordered = trendingIds
          .map((id) => allProducts.find((p) => p.id === id))
          .filter(Boolean) as Product[];
        const rest = allProducts.filter((p) => !trendingSet.has(p.id));
        setProducts([...ordered, ...rest].slice(0, 12));
      } else {
        const data = await fetchProducts({ limit: 12 });
        setProducts(data);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <section className="py-6 bg-card">
      <div className="container">
        <Link to="/trends" className="flex items-center gap-2 mb-4 group cursor-pointer">
          <h2 className="text-base md:text-lg font-bold text-foreground group-hover:text-primary transition-colors">
            {t("home.topTrends")}
          </h2>
          <ChevronRight size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
        </Link>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1.5 md:gap-2">
          {loading
            ? Array.from({ length: 12 }).map((_, i) => <ProductCardSkeleton key={i} />)
            : products.map((product, i) => (
                <Link to={`/product/${product.slug || product.id}`} key={product.id}>
                  <ProductCard product={product} index={i} />
                </Link>
              ))}
        </div>
      </div>
    </section>
  );
}
