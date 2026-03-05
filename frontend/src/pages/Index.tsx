import { useState, useCallback } from "react";
import { Header } from "@/components/Header";
import { HeroBanner } from "@/components/HeroBanner";
import { CategoryBanner } from "@/components/CategoryBanner";
import { FlashSales } from "@/components/FlashSales";
import { TopTrends } from "@/components/TopTrends";
import { ProductGrid } from "@/components/ProductGrid";
import { Footer } from "@/components/Footer";
import { FloatingActions } from "@/components/FloatingActions";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { SEOHead } from "@/components/SEOHead";
import { Loader2 } from "lucide-react";

const Index = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = useCallback(async () => {
    // Trigger a re-render of all sections by changing key
    await new Promise((resolve) => setTimeout(resolve, 600));
    setRefreshKey((k) => k + 1);
  }, []);

  const { pulling, pullProgress, refreshing, handlers } = usePullToRefresh(handleRefresh);

  return (
    <div
      className="min-h-screen bg-background"
      {...handlers}
    >
      <SEOHead
        title="Zandofy — Marketplace Mode, Électronique & Maison"
        description="Découvrez des milliers de produits mode, électronique, maison et beauté sur Zandofy. Livraison gratuite, vendeurs vérifiés, prix compétitifs."
        canonical="/"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Zandofy",
          url: "https://zandofy.lovable.app",
          potentialAction: {
            "@type": "SearchAction",
            target: "https://zandofy.lovable.app/search?q={search_term_string}",
            "query-input": "required name=search_term_string",
          },
        }}
      />
      <Header />

      {/* Pull-to-refresh indicator */}
      {(pulling || refreshing) && (
        <div
          className="flex items-center justify-center overflow-hidden transition-all duration-200 bg-muted"
          style={{ height: refreshing ? 48 : pullProgress * 48 }}
        >
          <Loader2
            size={20}
            className={`text-primary transition-transform ${refreshing ? "animate-spin" : ""}`}
            style={{ transform: `rotate(${pullProgress * 360}deg)`, opacity: pullProgress }}
          />
        </div>
      )}

      <main key={refreshKey}>
        <HeroBanner />
        <CategoryBanner />
        <FlashSales />
        <TopTrends />
        <ProductGrid />
      </main>
      <Footer />
      <FloatingActions />
    </div>
  );
};

export default Index;
