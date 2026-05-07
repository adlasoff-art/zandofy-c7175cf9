import { useBootstrapSetting } from "@/hooks/use-platform-bootstrap";

/**
 * Reads `seo_enabled` from the consolidated `platform-bootstrap` cache.
 * Avoids an extra round-trip on first paint.
 */
export function useSeoEnabled() {
  const { value, isLoading } = useBootstrapSetting<boolean>("seo_enabled", false);
  return { seoEnabled: value === true, isLoading };
}
