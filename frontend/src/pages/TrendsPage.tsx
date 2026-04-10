import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";
import { fetchProducts, fetchCategories, type Product } from "@/services/api";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp } from "lucide-react";

export default function TrendsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<{ id: string; name: string; nameFr: string }[]>([]);
  const [activeCategory, setActiveCategory] = useState("all");

  useEffect(() => {
    fetchCategories().then((cats) =>
      setCategories(cats.map((c) => ({ id: c.id, name: c.name, nameFr: c.nameFr })))
    );
  }, []);

  useEffect(() => {
    setLoading(true);
    // Fetch admin-selected trending products
    (async () => {
      const { data: trending } = await (supabase
        .from("trending_products" as any)
        .select("product_id")
        .order("sort_order") as any);

      const trendingIds = (trending || []).map((t: any) => t.product_id);

      let allProducts: Product[];
      if (activeCategory !== "all") {
        allProducts = await fetchProducts({ categoryId: activeCategory, limit: 100 });
      } else {
        allProducts = await fetchProducts({ limit: 100 });
      }

      // Put trending products first, then rest
      const trendingSet = new Set(trendingIds);
      const trendingProducts = trendingIds
        .map((id) => allProducts.find((p) => p.id === id))
        .filter(Boolean) as Product[];
      const otherProducts = allProducts.filter((p) => !trendingSet.has(p.id));

      setProducts([...trendingProducts, ...otherProducts]);
      setLoading(false);
    })();
  }, [activeCategory]);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Top Tendances — Zandofy" description="Découvrez les produits tendances du moment sur Zandofy." />
      <Header />
      <main className="pb-24">
        <section className="bg-primary py-10 md:py-14">
          <div className="container text-center space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-4 py-1.5 text-xs font-medium text-primary-foreground/90">
              <TrendingUp size={14} /> Top Tendances
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-primary-foreground tracking-tight">
              Produits Tendances
            </h1>
            <p className="text-sm text-primary-foreground/80 max-w-lg mx-auto">
              Les produits les plus en vogue actuellement.
            </p>
          </div>
        </section>

        <div className="container pt-6">
          {/* Category filters */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setActiveCategory("all")}
              className={`px-4 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-all border ${
                activeCategory === "all"
                  ? "bg-foreground text-card border-foreground"
                  : "bg-card text-foreground border-border hover:border-foreground"
              }`}
            >
              Tout
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-4 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-all border ${
                  activeCategory === cat.id
                    ? "bg-foreground text-card border-foreground"
                    : "bg-card text-foreground border-border hover:border-foreground"
                }`}
              >
                {cat.nameFr}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5 md:gap-2">
            {loading
              ? Array.from({ length: 18 }).map((_, i) => <ProductCardSkeleton key={i} />)
              : products.map((product, i) => (
                  <Link to={`/product/${product.slug || product.id}`} key={product.id} className="block">
                    <ProductCard product={product} index={i} />
                  </Link>
                ))}
          </div>

          {!loading && products.length === 0 && (
            <div className="text-center py-16">
              <TrendingUp size={48} className="mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">Aucun produit tendance pour le moment.</p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
