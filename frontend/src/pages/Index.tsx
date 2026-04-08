import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { HeroBanner } from "@/components/HeroBanner";
import { CategoryBanner } from "@/components/CategoryBanner";
import { FlashSales } from "@/components/FlashSales";
import { TopTrends } from "@/components/TopTrends";
import { ProductGrid } from "@/components/ProductGrid";
import { FeaturedSidebar } from "@/components/FeaturedSidebar";
import { RecommendationsSection } from "@/components/RecommendationsSection";
import { Footer } from "@/components/Footer";
import { FloatingActions } from "@/components/FloatingActions";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { SEOHead } from "@/components/SEOHead";
import { useSeoConfig } from "@/hooks/use-seo-config";
import { Loader2 } from "lucide-react";

const Index = () => {
  const queryClient = useQueryClient();
  const seoConfig = useSeoConfig();
  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries();
    await new Promise((resolve) => setTimeout(resolve, 400));
  }, [queryClient]);

  const { pulling, pullProgress, refreshing, handlers } = usePullToRefresh(handleRefresh);

  return (
    <div
      className="min-h-screen bg-background"
      {...handlers}
    >
      <SEOHead
        title={seoConfig.site_title}
        description={seoConfig.site_description}
        canonical="/"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Zandofy",
          url: import.meta.env.VITE_SITE_URL || "https://zandofy.com",
          potentialAction: {
            "@type": "SearchAction",
            target: `${import.meta.env.VITE_SITE_URL || "https://zandofy.com"}/search?q={search_term_string}`,
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

      <main>
        <HeroBanner />
        <CategoryBanner />
        <FlashSales />
        <RecommendationsSection />

        {/* Featured sidebar + TopTrends only */}
        <div className="container">
          <div className="flex flex-col lg:flex-row gap-4 py-4">
            {/* Featured sidebar – left on desktop */}
            <div className="order-2 lg:order-1">
              <FeaturedSidebar />
            </div>
            {/* TopTrends beside sidebar */}
            <div className="flex-1 min-w-0 order-1 lg:order-2">
              <TopTrends />
            </div>
          </div>
        </div>

        {/* ProductGrid returns to full width */}
        <ProductGrid />
      </main>
      <Footer />
      <FloatingActions />
    </div>
  );
};

export default Index;
