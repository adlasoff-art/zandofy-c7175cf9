import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/contexts/I18nContext";
import {
  mergeLandingContent,
  type CmsLandingKey,
  type LandingLocaleContent,
} from "@/lib/cms-marketing-landings";

/** Fetch marketing landing CMS JSON (not in bootstrap LCP). Fail-soft → null. */
export function useCmsMarketingLanding(key: CmsLandingKey) {
  return useQuery({
    queryKey: ["cms-marketing-landing", key],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", key)
        .maybeSingle();
      // RLS miss / network → silent null so pages keep i18n fallback
      if (error) return null;
      return (data?.value ?? null) as Record<string, unknown> | null;
    },
    staleTime: 60_000,
    retry: 1,
  });
}

/** Merged CMS + i18n fallback for the active locale (deduped via React Query). */
export function useResolvedMarketingLanding(
  key: CmsLandingKey,
  buildFallback: (t: (key: string) => string) => LandingLocaleContent
) {
  const { t, locale } = useI18n();
  const query = useCmsMarketingLanding(key);
  const localeKey = locale === "en" ? "en" : "fr";
  const content = mergeLandingContent(
    query.data?.[localeKey] ?? null,
    buildFallback(t)
  );
  return { content, isLoading: query.isLoading, isFetching: query.isFetching };
}
