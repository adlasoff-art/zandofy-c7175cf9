import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SEOHead } from "@/components/SEOHead";
import { Shield, Globe, Heart, Users, Truck, Award } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";

export default function AboutPage() {
  const { t } = useI18n();

  // Dynamic stats from real data
  const { data: dynamicStats } = useQuery({
    queryKey: ["about-dynamic-stats"],
    queryFn: async () => {
      const [productsRes, storesRes, reviewsRes, countriesRes] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }).eq("publish_status", "published"),
        supabase.from("stores").select("id", { count: "exact", head: true }).eq("is_verified", true),
        supabase.from("reviews").select("user_id", { count: "exact", head: true }),
        supabase.from("cities").select("country_code"),
      ]);
      const uniqueCountries = new Set((countriesRes.data || []).map((c: any) => c.country_code));
      return {
        products: productsRes.count || 0,
        sellers: storesRes.count || 0,
        customers: reviewsRes.count || 0,
        countries: uniqueCountries.size || 0,
      };
    },
    staleTime: 300_000,
  });

  // CMS-editable content
  const [cmsContent, setCmsContent] = useState<{ story_fr?: string; story_en?: string } | null>(null);
  useEffect(() => {
    supabase.from("platform_settings").select("value").eq("key", "cms_about").maybeSingle().then(({ data }) => {
      if (data?.value) setCmsContent(data.value as any);
    });
  }, []);

  const { locale } = useI18n();

  const formatNum = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K+`;
    return `${n}+`;
  };

  const values = [
    { icon: Globe, titleKey: "about.globalReach", descKey: "about.globalReachDesc" },
    { icon: Shield, titleKey: "about.trustSafety", descKey: "about.trustSafetyDesc" },
    { icon: Heart, titleKey: "about.socialCommitment", descKey: "about.socialCommitmentDesc" },
    { icon: Users, titleKey: "about.community", descKey: "about.communityDesc" },
    { icon: Truck, titleKey: "about.optimizedLogistics", descKey: "about.optimizedLogisticsDesc" },
    { icon: Award, titleKey: "about.guaranteedQuality", descKey: "about.guaranteedQualityDesc" },
  ];

  const stats = [
    { num: dynamicStats ? formatNum(dynamicStats.products) : "—", labelKey: "about.products" },
    { num: dynamicStats ? formatNum(dynamicStats.sellers) : "—", labelKey: "about.verifiedSellers" },
    { num: dynamicStats ? formatNum(dynamicStats.customers) : "—", labelKey: "about.satisfiedCustomers" },
    { num: dynamicStats ? formatNum(dynamicStats.countries) : "—", labelKey: "about.countriesServed" },
  ];

  const storyContent = cmsContent
    ? (locale === "en" ? cmsContent.story_en : cmsContent.story_fr) || t("about.storyContent")
    : t("about.storyContent");

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={`${t("about.title")} — Marketplace`}
        description={t("about.subtitle")}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Zandofy",
          description: t("about.subtitle"),
          url: window.location.origin,
        }}
      />
      <Header />
      <main>
        <section className="bg-brand-gradient text-primary-foreground py-16 md:py-24">
          <div className="container text-center">
            <h1 className="text-3xl md:text-5xl font-bold mb-4">{t("about.title")}</h1>
            <p className="text-lg md:text-xl opacity-90 max-w-2xl mx-auto">{t("about.subtitle")}</p>
          </div>
        </section>

        <section className="container py-12 md:py-16">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl font-bold text-foreground mb-4">{t("about.storyTitle")}</h2>
            <p className="text-muted-foreground leading-relaxed">{storyContent}</p>
          </div>
        </section>

        <section className="bg-muted py-12 md:py-16">
          <div className="container">
            <h2 className="text-2xl font-bold text-foreground text-center mb-10">{t("about.valuesTitle")}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {values.map(v => (
                <article key={v.titleKey} className="bg-card border border-border rounded-lg p-6 hover:shadow-card-hover transition-shadow">
                  <v.icon size={28} className="text-primary mb-3" />
                  <h3 className="text-base font-bold text-foreground mb-2">{t(v.titleKey)}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{t(v.descKey)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="container py-12 md:py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {stats.map(s => (
              <div key={s.labelKey}>
                <p className="text-3xl md:text-4xl font-bold text-primary">{s.num}</p>
                <p className="text-sm text-muted-foreground mt-1">{t(s.labelKey)}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
