import { lazy, Suspense, useCallback } from "react";
import { useNavigationType } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { HeroBanner } from "@/components/HeroBanner";
import { CategoryBanner } from "@/components/CategoryBanner";
import { LazyMount } from "@/components/LazyMount";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { SEOHead } from "@/components/SEOHead";
import { useSeoConfig } from "@/hooks/use-seo-config";
import { useSeoOverride } from "@/hooks/use-seo-overrides";
import { Loader2 } from "lucide-react";

// Below-the-fold: lazy-loaded to reduce initial JS and main-thread work.
const FlashSales = lazy(() => import("@/components/FlashSales").then(m => ({ default: m.FlashSales })));
const TopTrends = lazy(() => import("@/components/TopTrends").then(m => ({ default: m.TopTrends })));
const ProductGrid = lazy(() => import("@/components/ProductGrid").then(m => ({ default: m.ProductGrid })));
const FeaturedSidebar = lazy(() => import("@/components/FeaturedSidebar").then(m => ({ default: m.FeaturedSidebar })));
const RecommendationsSection = lazy(() => import("@/components/RecommendationsSection").then(m => ({ default: m.RecommendationsSection })));
const Footer = lazy(() => import("@/components/Footer").then(m => ({ default: m.Footer })));
const FloatingActions = lazy(() => import("@/components/FloatingActions").then(m => ({ default: m.FloatingActions })));

const SITE_URL = import.meta.env.VITE_SITE_URL || "https://zandofy.com";

const Index = () => {
  const queryClient = useQueryClient();
  const navType = useNavigationType();
  /** Back from PDP: mount lazy sections immediately so scroll height matches saved position. */
  const restoreHomeLayout = navType === "POP";
  const seoConfig = useSeoConfig();
  const override = useSeoOverride("/");
  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries();
    await new Promise((resolve) => setTimeout(resolve, 400));
  }, [queryClient]);

  const { pulling, pullProgress, refreshing, handlers } = usePullToRefresh(handleRefresh);

  // Build combined JSON-LD: WebSite + Organization
  const sameAs = [
    seoConfig.social_urls.facebook,
    seoConfig.social_urls.instagram,
    seoConfig.social_urls.twitter,
  ].filter(Boolean);

  const pageH1 = seoConfig.site_title || seoConfig.brand_name || "Zandofy";

  const jsonLd = [
    {
      "@type": "WebSite",
      name: seoConfig.brand_name || "Zandofy",
      url: SITE_URL,
      potentialAction: {
        "@type": "SearchAction",
        target: `${SITE_URL}/search?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "Organization",
      name: seoConfig.brand_name || "Zandofy",
      url: SITE_URL,
      logo: seoConfig.default_og_image || `${SITE_URL}/logo.png`,
      description: seoConfig.tagline || seoConfig.site_description,
      ...(sameAs.length > 0 ? { sameAs } : {}),
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer service",
        availableLanguage: ["French", "English"],
      },
    },
  ];

  return (
    <div
      className="min-h-screen bg-background"
      {...handlers}
    >
      <SEOHead
        title={override?.title || seoConfig.site_title}
        description={override?.description || seoConfig.site_description}
        canonical="/"
        jsonLd={jsonLd}
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
        <h1 className="sr-only">{pageH1}</h1>
        <HeroBanner />
        <CategoryBanner />

        <LazyMount minHeight={320} initialShown={restoreHomeLayout}>
          <Suspense fallback={<div style={{ minHeight: 320 }} />}>
            <FlashSales />
          </Suspense>
        </LazyMount>

        <LazyMount minHeight={400} initialShown={restoreHomeLayout}>
          <Suspense fallback={<div style={{ minHeight: 400 }} />}>
            <RecommendationsSection />
          </Suspense>
        </LazyMount>

        {/* Featured sidebar + TopTrends only */}
        <div className="container">
          <div className="flex flex-col lg:flex-row gap-4 py-4">
            {/* Featured sidebar – left on desktop */}
            <div className="order-2 lg:order-1">
              <LazyMount minHeight={300} initialShown={restoreHomeLayout}>
                <Suspense fallback={<div style={{ minHeight: 300 }} />}>
                  <FeaturedSidebar />
                </Suspense>
              </LazyMount>
            </div>
            {/* TopTrends beside sidebar */}
            <div className="flex-1 min-w-0 order-1 lg:order-2">
              <LazyMount minHeight={500} initialShown={restoreHomeLayout}>
                <Suspense fallback={<div style={{ minHeight: 500 }} />}>
                  <TopTrends />
                </Suspense>
              </LazyMount>
            </div>
          </div>
        </div>

        {/* ProductGrid returns to full width */}
        <LazyMount minHeight={600} initialShown={restoreHomeLayout}>
          <Suspense fallback={<div style={{ minHeight: 600 }} />}>
            <ProductGrid restoreFromCache={restoreHomeLayout} />
          </Suspense>
        </LazyMount>
      </main>

      <LazyMount minHeight={300} initialShown={restoreHomeLayout}>
        <Suspense fallback={<div style={{ minHeight: 300 }} />}>
          <Footer />
        </Suspense>
      </LazyMount>

      <Suspense fallback={null}>
        <FloatingActions />
      </Suspense>
    </div>
  );
};

export default Index;
