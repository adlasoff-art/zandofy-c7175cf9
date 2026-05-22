import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";
import { fetchFlashSaleProducts, type Product } from "@/services/api";
import { shuffleByDailySeed } from "@/lib/daily-shuffle";
import { Flame } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";

export default function SuperPromoPage() {
  const { t } = useI18n();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFlashSaleProducts()
      .then((data) => setProducts(shuffleByDailySeed(data)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={t("home.flashSales")}
        description="Tous les produits en super promotion sur Zandofy — offres limitées et renouvelées chaque jour."
        canonical="/super-promo"
      />
      <Header />
      <main className="container py-6">
        <div className="flex items-center gap-2 mb-6">
          <Flame size={22} className="text-sale" aria-hidden />
          <h1 className="text-xl md:text-2xl font-bold text-foreground">
            {t("home.flashSales")}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
          {t("superPromo.pageHint") ||
            "Les offres changent d'ordre chaque jour. La durée de 7 jours dans cette zone commence lorsque une date de début promo est définie sur le produit ; les promos admin (flash sales) restent jusqu'à leur date de fin."}
        </p>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : products.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">
            {t("superPromo.empty") || "Aucune super promo pour le moment."}
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {products.map((product, i) => (
              <Link
                key={product.id}
                to={`/product/${product.slug || product.id}`}
                className="block"
              >
                <ProductCard product={product} index={i} priority={i < 4} />
              </Link>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
