import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";
import { mapProduct, type Product, PRODUCT_LIST_SELECT } from "@/services/api";
import { supabase } from "@/integrations/supabase/client";
import { Flame, Loader2 } from "lucide-react";

const PAGE_SIZE = 24;

export default function PopularPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const fetchPage = useCallback(async (offset: number) => {
    const { data } = await supabase
      .from("products")
      .select(PRODUCT_LIST_SELECT)
      .eq("publish_status", "published")
      .order("sales_count", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    return (data || []).map(mapProduct);
  }, []);

  useEffect(() => {
    fetchPage(0).then((data) => {
      setProducts(data);
      setHasMore(data.length >= PAGE_SIZE);
      setLoading(false);
    });
  }, [fetchPage]);

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const data = await fetchPage(products.length);
    setProducts((prev) => [...prev, ...data]);
    setHasMore(data.length >= PAGE_SIZE);
    setLoadingMore(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead title="Plus Populaires — Zandofy" description="Les produits les plus vendus sur Zandofy." />
      <Header />
      <main className="pb-24">
        <section className="bg-primary py-10 md:py-14">
          <div className="container text-center space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-4 py-1.5 text-xs font-medium text-primary-foreground/90">
              <Flame size={14} /> Plus Populaires
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-primary-foreground tracking-tight">
              Les Plus Populaires
            </h1>
            <p className="text-sm text-primary-foreground/80 max-w-lg mx-auto">
              Nos produits classés par ordre de popularité.
            </p>
          </div>
        </section>

        <div className="container pt-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5 md:gap-2">
            {loading
              ? Array.from({ length: 18 }).map((_, i) => <ProductCardSkeleton key={i} />)
              : products.map((product, i) => (
                  <Link to={`/product/${product.slug || product.id}`} key={product.id} className="block">
                    <ProductCard product={product} index={i} />
                  </Link>
                ))}
          </div>

          {!loading && (
            <div className="text-center mt-8">
              {hasMore ? (
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="px-10 py-2.5 text-sm font-medium border border-foreground text-foreground bg-card hover:bg-foreground hover:text-card transition-colors disabled:opacity-50"
                >
                  {loadingMore ? (
                    <span className="flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Chargement...</span>
                  ) : "Voir Plus"}
                </button>
              ) : products.length > 0 ? (
                <p className="text-xs text-muted-foreground">Vous avez tout vu ✨</p>
              ) : null}
            </div>
          )}

          {!loading && products.length === 0 && (
            <div className="text-center py-16">
              <Flame size={48} className="mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">Aucun produit pour le moment.</p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
