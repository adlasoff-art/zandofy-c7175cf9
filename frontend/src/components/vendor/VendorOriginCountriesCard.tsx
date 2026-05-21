import { useEffect, useState } from "react";
import { Globe, Info, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/contexts/I18nContext";

interface Props {
  storeId: string;
}

interface OriginRow {
  origin_country: string | null;
  count: number;
}

const COUNTRY_LABELS: Record<string, { fr: string; en: string; flag: string }> = {
  CN: { fr: "Chine", en: "China", flag: "🇨🇳" },
  TR: { fr: "Turquie", en: "Türkiye", flag: "🇹🇷" },
  AE: { fr: "Émirats arabes unis", en: "UAE", flag: "🇦🇪" },
  CD: { fr: "RD Congo", en: "DR Congo", flag: "🇨🇩" },
  FR: { fr: "France", en: "France", flag: "🇫🇷" },
  US: { fr: "États-Unis", en: "United States", flag: "🇺🇸" },
  IN: { fr: "Inde", en: "India", flag: "🇮🇳" },
};

function labelFor(code: string | null, locale: "fr" | "en"): { label: string; flag: string } {
  if (!code) return { label: locale === "fr" ? "Origine non renseignée" : "Origin not set", flag: "❓" };
  const upper = code.toUpperCase();
  const entry = COUNTRY_LABELS[upper];
  if (entry) return { label: entry[locale], flag: entry.flag };
  return { label: upper, flag: "🌍" };
}

export default function VendorOriginCountriesCard({ storeId }: Props) {
  const { t, locale } = useI18n();
  const [rows, setRows] = useState<OriginRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("products")
        .select("origin_country")
        .eq("store_id", storeId);
      if (cancelled) return;
      if (error || !data) {
        setRows([]);
        setLoading(false);
        return;
      }
      const map = new Map<string | null, number>();
      for (const p of data as { origin_country: string | null }[]) {
        const key = p.origin_country ? p.origin_country.toUpperCase() : null;
        map.set(key, (map.get(key) ?? 0) + 1);
      }
      const out: OriginRow[] = Array.from(map.entries())
        .map(([origin_country, count]) => ({ origin_country, count }))
        .sort((a, b) => b.count - a.count);
      setRows(out);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [storeId]);

  const total = rows.reduce((s, r) => s + r.count, 0);
  const missing = rows.find((r) => r.origin_country === null)?.count ?? 0;
  const known = rows.filter((r) => r.origin_country !== null);

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Globe size={16} className="text-primary mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            {t("vendor.origins.title")}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t("vendor.origins.subtitle")}
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">{t("vendor.origins.loading")}</p>
      ) : total === 0 ? (
        <p className="text-xs text-muted-foreground italic">{t("vendor.origins.noProducts")}</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {known.map((r) => {
              const { label, flag } = labelFor(r.origin_country, locale as "fr" | "en");
              return (
                <span
                  key={r.origin_country ?? "null"}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-foreground"
                >
                  <span aria-hidden>{flag}</span>
                  <span>{label}</span>
                  <span className="text-muted-foreground">· {r.count}</span>
                </span>
              );
            })}
            {known.length === 0 && (
              <span className="text-xs text-muted-foreground italic">
                {t("vendor.origins.allMissing")}
              </span>
            )}
          </div>

          {missing > 0 && (
            <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-500/10 border border-amber-500/30">
              <AlertTriangle size={14} className="text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-foreground">
                {t("vendor.origins.missingWarning", { count: missing })}
              </p>
            </div>
          )}

          <div className="flex items-start gap-2 p-2.5 rounded-md bg-muted/40 border border-border/60">
            <Info size={14} className="text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              {t("vendor.origins.contactInfo")}
            </p>
          </div>
        </>
      )}
    </div>
  );
}