import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Save, Loader2 } from "lucide-react";
import { SeoToggleSection } from "@/components/admin/seo/SeoToggleSection";
import { SeoMetadataSection } from "@/components/admin/seo/SeoMetadataSection";
import { SeoBrandingSection } from "@/components/admin/seo/SeoBrandingSection";
import { SeoSocialSection } from "@/components/admin/seo/SeoSocialSection";
import { SeoVerificationSection } from "@/components/admin/seo/SeoVerificationSection";
import { SeoSerpPreview } from "@/components/admin/seo/SeoSerpPreview";
import { SeoStoresSection } from "@/components/admin/seo/SeoStoresSection";
import { SeoWatermarkSection } from "@/components/admin/seo/SeoWatermarkSection";
import { SeoSocialRescrapeSection } from "@/components/admin/seo/SeoSocialRescrapeSection";
import { SeoPageOverridesSection } from "@/components/admin/seo/SeoPageOverridesSection";
import { SeoTemplatesSection } from "@/components/admin/seo/SeoTemplatesSection";
import { SeoSitelinksNavSection } from "@/components/admin/seo/SeoSitelinksNavSection";
import { SeoCategoriesSection } from "@/components/admin/seo/SeoCategoriesSection";
import { SeoCoverageSection } from "@/components/admin/seo/SeoCoverageSection";
import { DEFAULT_SITELINKS_NAV } from "@/hooks/use-seo-config";

interface SeoConfigState {
  site_title: string;
  site_description: string;
  default_keywords: string[];
  default_og_image: string;
  site_language: string;
  brand_name: string;
  tagline: string;
  social_urls: { facebook?: string; instagram?: string; twitter?: string };
  google_site_verification: string;
  google_analytics_id: string;
  category_title_template: string;
  category_description_template: string;
  product_title_template: string;
  product_description_template: string;
  store_title_template: string;
  store_description_template: string;
  sitelinks_nav: { name: string; url: string }[];
}

const DEFAULT_STATE: SeoConfigState = {
  site_title: "Zandofy — Achetez en Chine, livré en Afrique | Prix usine",
  site_description:
    "Achetez directement aux usines chinoises, turques et internationales. Zandofy gère fournisseurs, logistique et livraison en Afrique. Prix imbattables, support en français.",
  default_keywords: [
    "acheter en chine depuis l'afrique",
    "importer de chine afrique",
    "fournisseur chine afrique",
    "transitaire chine afrique",
    "marketplace sino-africaine",
    "prix usine chine",
    "zandofy",
    "e-commerce afrique",
    "logistique chine afrique",
  ],
  default_og_image: "",
  site_language: "fr",
  brand_name: "Zandofy",
  tagline: "Première plateforme e-commerce sino-africaine d'achat et logistique en Chine et à l'international.",
  social_urls: {},
  google_site_verification: "",
  google_analytics_id: "",
  category_title_template: "{name} | Zandofy",
  category_description_template:
    "Achetez {name} sur Zandofy — import Chine & livraison Afrique. Prix usine, logistique inclusive.",
  product_title_template: "{name} | Zandofy",
  product_description_template: "Achetez {name} sur Zandofy — import Chine & livraison Afrique.",
  store_title_template: "{name} — Boutique | Zandofy",
  store_description_template:
    "Découvrez la boutique {name} sur Zandofy. Produits prix usine, livraison en Afrique.",
  sitelinks_nav: DEFAULT_SITELINKS_NAV,
};

type TabKey = "global" | "pages" | "categories" | "templates" | "nav" | "coverage" | "tools";

const TABS: { key: TabKey; label: string }[] = [
  { key: "global", label: "Global" },
  { key: "pages", label: "Pages" },
  { key: "categories", label: "Catégories" },
  { key: "templates", label: "Templates" },
  { key: "nav", label: "Sitelinks" },
  { key: "coverage", label: "Couverture" },
  { key: "tools", label: "Outils" },
];

export default function AdminSEOPage() {
  const [seoEnabled, setSeoEnabled] = useState(false);
  const [config, setConfig] = useState<SeoConfigState>(DEFAULT_STATE);
  const [keywordsInput, setKeywordsInput] = useState(DEFAULT_STATE.default_keywords.join(", "));
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("global");
  const { toast } = useToast();

  useEffect(() => {
    supabase
      .from("platform_settings")
      .select("key, value")
      .in("key", ["seo_enabled", "seo_config"])
      .then(({ data }) => {
        data?.forEach((row) => {
          if (row.key === "seo_enabled") {
            setSeoEnabled(row.value === true);
          } else if (row.key === "seo_config") {
            const v = row.value as any;
            const c: SeoConfigState = {
              site_title: v.site_title || DEFAULT_STATE.site_title,
              site_description: v.site_description || DEFAULT_STATE.site_description,
              default_keywords: v.default_keywords || DEFAULT_STATE.default_keywords,
              default_og_image: v.default_og_image || "",
              site_language: v.site_language || "fr",
              brand_name: v.brand_name || "Zandofy",
              tagline: v.tagline || DEFAULT_STATE.tagline,
              social_urls: v.social_urls || {},
              google_site_verification: v.google_site_verification || "",
              google_analytics_id: v.google_analytics_id || "",
              category_title_template:
                v.category_title_template || DEFAULT_STATE.category_title_template,
              category_description_template:
                v.category_description_template || DEFAULT_STATE.category_description_template,
              product_title_template:
                v.product_title_template || DEFAULT_STATE.product_title_template,
              product_description_template:
                v.product_description_template || DEFAULT_STATE.product_description_template,
              store_title_template: v.store_title_template || DEFAULT_STATE.store_title_template,
              store_description_template:
                v.store_description_template || DEFAULT_STATE.store_description_template,
              sitelinks_nav:
                Array.isArray(v.sitelinks_nav) && v.sitelinks_nav.length
                  ? v.sitelinks_nav
                  : DEFAULT_STATE.sitelinks_nav,
            };
            setConfig(c);
            setKeywordsInput(c.default_keywords.join(", "));
          }
        });
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const now = new Date().toISOString();
    const keywords = keywordsInput
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    const fullConfig = { ...config, default_keywords: keywords };

    const { error } = await supabase.from("platform_settings").upsert(
      [
        { key: "seo_enabled", value: seoEnabled as any, updated_at: now },
        { key: "seo_config", value: fullConfig as any, updated_at: now },
      ],
      { onConflict: "key" },
    );

    setSaving(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }

    try {
      await fetch("/api/meta-injector", { method: "GET", headers: { "x-purge-cache": "1" } });
    } catch {
      /* ignore */
    }

    toast({
      title: "SEO mis à jour",
      description: seoEnabled
        ? "Indexation active — cache bots purgé."
        : "SEO désactivé (noindex global côté client).",
    });
  };

  const inputClass =
    "w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20";

  if (loading) {
    return (
      <AdminLayout title="Référencement (SEO)">
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-primary" size={24} />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Référencement (SEO)">
      <div className="space-y-6 max-w-3xl">
        <div className="flex flex-wrap gap-1 border-b border-border pb-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                tab === t.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "global" && (
          <>
            <SeoToggleSection seoEnabled={seoEnabled} onToggle={setSeoEnabled} />
            <SeoMetadataSection
              siteTitle={config.site_title}
              siteDescription={config.site_description}
              keywordsInput={keywordsInput}
              onTitleChange={(v) => setConfig((p) => ({ ...p, site_title: v }))}
              onDescriptionChange={(v) => setConfig((p) => ({ ...p, site_description: v }))}
              onKeywordsChange={setKeywordsInput}
              inputClass={inputClass}
            />
            <SeoSerpPreview title={config.site_title} description={config.site_description} />
            <SeoBrandingSection
              brandName={config.brand_name}
              tagline={config.tagline}
              defaultOgImage={config.default_og_image}
              onBrandNameChange={(v) => setConfig((p) => ({ ...p, brand_name: v }))}
              onTaglineChange={(v) => setConfig((p) => ({ ...p, tagline: v }))}
              onOgImageChange={(v) => setConfig((p) => ({ ...p, default_og_image: v }))}
              inputClass={inputClass}
            />
            <SeoSocialSection
              facebook={config.social_urls.facebook || ""}
              instagram={config.social_urls.instagram || ""}
              twitter={config.social_urls.twitter || ""}
              onFacebookChange={(v) =>
                setConfig((p) => ({ ...p, social_urls: { ...p.social_urls, facebook: v } }))
              }
              onInstagramChange={(v) =>
                setConfig((p) => ({ ...p, social_urls: { ...p.social_urls, instagram: v } }))
              }
              onTwitterChange={(v) =>
                setConfig((p) => ({ ...p, social_urls: { ...p.social_urls, twitter: v } }))
              }
              inputClass={inputClass}
            />
            <SeoVerificationSection
              googleSiteVerification={config.google_site_verification}
              googleAnalyticsId={config.google_analytics_id}
              onVerificationChange={(v) => setConfig((p) => ({ ...p, google_site_verification: v }))}
              onAnalyticsChange={(v) => setConfig((p) => ({ ...p, google_analytics_id: v }))}
              inputClass={inputClass}
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Enregistrer les paramètres SEO
            </button>
          </>
        )}

        {tab === "pages" && <SeoPageOverridesSection />}

        {tab === "categories" && <SeoCategoriesSection />}

        {tab === "templates" && (
          <>
            <SeoTemplatesSection
              categoryTitleTemplate={config.category_title_template}
              categoryDescriptionTemplate={config.category_description_template}
              productTitleTemplate={config.product_title_template}
              productDescriptionTemplate={config.product_description_template}
              storeTitleTemplate={config.store_title_template}
              storeDescriptionTemplate={config.store_description_template}
              onChange={(key, value) => setConfig((p) => ({ ...p, [key]: value }))}
              inputClass={inputClass}
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Enregistrer les templates
            </button>
          </>
        )}

        {tab === "nav" && (
          <>
            <SeoSitelinksNavSection
              items={config.sitelinks_nav}
              onChange={(items) => setConfig((p) => ({ ...p, sitelinks_nav: items }))}
              inputClass={inputClass}
            />
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Enregistrer la navigation
            </button>
          </>
        )}

        {tab === "coverage" && <SeoCoverageSection />}

        {tab === "tools" && (
          <>
            <SeoStoresSection />
            <SeoWatermarkSection />
            <SeoSocialRescrapeSection />
            <div className="rounded-xl border border-border p-5 space-y-2 text-sm">
              <p className="font-semibold">Search Console &amp; rich results</p>
              <ul className="list-disc pl-5 text-xs text-muted-foreground space-y-1">
                <li>
                  <a
                    className="text-primary underline"
                    href="https://search.google.com/search-console"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Google Search Console
                  </a>{" "}
                  — soumettre https://www.zandofy.com/sitemap.xml
                </li>
                <li>
                  <a
                    className="text-primary underline"
                    href="https://search.google.com/test/rich-results"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Rich Results Test
                  </a>
                </li>
                <li>
                  Voir aussi <code className="text-[10px]">docs/SEO_MARKETPLACE_PLAYBOOK.md</code>
                </li>
              </ul>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
