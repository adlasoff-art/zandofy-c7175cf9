import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDiscoveryPrefs } from "@/contexts/DiscoveryPrefsContext";
import { useAuthSettings } from "@/hooks/use-auth-settings";
import {
  assembleDiscoveryFeed,
  expandApparelCategoryIds,
  expandInterestCategoryIds,
  EMPTY_CATEGORY_TREE,
  type CategoryTreeNode,
  type DiscoveryProductLike,
} from "@/lib/discovery-engine";
import { trackDiscoveryOnboarding } from "@/hooks/use-analytics";

async function fetchDiscoveryCategoryTree(): Promise<CategoryTreeNode[]> {
  const { data, error } = await (supabase as any)
    .from("categories")
    .select("id, parent_id, apparel_fields_enabled")
    .limit(2000);
  if (error) throw error;
  return (data || []) as CategoryTreeNode[];
}

/**
 * Rank a product list with discovery prefs + CMS mix when onboarding completed.
 */
export function useDiscoveryRankedProducts<T extends DiscoveryProductLike>(
  products: T[],
  surface: string,
  take?: number,
): T[] {
  const { prefs, hasCompleted } = useDiscoveryPrefs();
  const { data: authSettings } = useAuthSettings();
  const { user } = useAuth();
  const trackedKey = useRef<string>("");

  const { data: categoriesData } = useQuery({
    queryKey: ["discovery-category-tree"],
    queryFn: fetchDiscoveryCategoryTree,
    staleTime: 10 * 60 * 1000,
    enabled: hasCompleted,
  });
  const categories = categoriesData ?? EMPTY_CATEGORY_TREE;

  const ranked = useMemo(() => {
    if (!hasCompleted || !products.length) return take ? products.slice(0, take) : products;
    const interestCategoryIds = expandInterestCategoryIds(
      prefs.interest_category_ids,
      categories,
    );
    const apparelCategoryIds = expandApparelCategoryIds(categories);
    return assembleDiscoveryFeed(products, {
      prefs,
      mix: authSettings?.discovery_mix,
      take: take ?? products.length,
      interestCategoryIds,
      apparelCategoryIds,
      surface,
      seedKey: user?.id || "guest",
    });
  }, [
    products,
    hasCompleted,
    prefs,
    authSettings?.discovery_mix,
    categories,
    surface,
    take,
    user?.id,
  ]);

  useEffect(() => {
    if (!hasCompleted || !ranked.length) return;
    const key = `${surface}|${ranked.length}|${prefs.completed_at}`;
    if (trackedKey.current === key) return;
    trackedKey.current = key;
    // Sample ~10% of assemblies (decision after key lock so we never re-roll)
    if (Math.random() >= 0.1) return;
    trackDiscoveryOnboarding(
      "discovery_feed_assembled",
      {
        surface,
        take: ranked.length,
        pool: products.length,
        scope: prefs.purchase_scope,
        audience: prefs.audience,
      },
      user?.id,
    );
  }, [hasCompleted, ranked, surface, prefs.completed_at, prefs.purchase_scope, prefs.audience, products.length, user?.id]);

  return ranked;
}
