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
};

export default function AdminSEOPage() {
  const [seoEnabled, setSeoEnabled] = useState(false);
  const [config, setConfig] = useState<SeoConfigState>(DEFAULT_STATE);
  const [keywordsInput, setKeywordsInput] = useState(DEFAULT_STATE.default_keywords.join(", "));
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
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
            };
            setConfig(c);
            setKeywordsInput((v.default_keywords || DEFAULT_STATE.default_keywords).join(", "));
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

    const [r1, r2] = await Promise.all([
      supabase.from("platform_settings").upsert(
        { key: "seo_enabled", value: seoEnabled as any, updated_at: now },
        { onConflict: "key" }
      ),
      supabase.from("platform_settings").upsert(
        { key: "seo_config", value: fullConfig as any, updated_at: now },
        { onConflict: "key" }
      ),
    ]);

    if (r1.error || r2.error) {
      toast({ title: "Erreur", description: (r1.error || r2.error)?.message, variant: "destructive" });
    } else {
      toast({
        title: "SEO mis à jour",
        description: seoEnabled
          ? "Le référencement est activé."
          : "Le référencement reste désactivé.",
      });
    }
    setSaving(false);
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
      <div className="space-y-6 max-w-2xl">
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

        <SeoStoresSection />

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Enregistrer les paramètres SEO
        </button>
      </div>
    </AdminLayout>
  );
}
