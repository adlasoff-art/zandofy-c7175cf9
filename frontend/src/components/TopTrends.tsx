import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";
import { fetchProducts, type Product } from "@/services/api";

export function TopTrends() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts({ limit: 12 }).then((data) => {
      setProducts(data);
      setLoading(false);
    });
  }, []);

  return (
    <section className="py-6 bg-card">
      <div className="container">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-base md:text-lg font-bold text-foreground">
            Top Tendances
          </h2>
          <ChevronRight size={16} className="text-muted-foreground" />
        </div>

        {/* 3 rows × 6 columns = 18 products */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1.5 md:gap-2">
          {loading
            ? Array.from({ length: 12 }).map((_, i) => <ProductCardSkeleton key={i} />)
            : products.map((product, i) => (
                <Link to={`/product/${product.id}`} key={product.id}>
                  <ProductCard product={product} index={i} />
                </Link>
              ))}
        </div>
      </div>
    </section>
  );
}
