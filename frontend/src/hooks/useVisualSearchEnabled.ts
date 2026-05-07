import { useBootstrapSetting } from "@/hooks/use-platform-bootstrap";

/**
 * Returns whether visual search (camera icon in search bar) is enabled.
 * Reads from the consolidated `platform-bootstrap` cache (no extra request).
 */
export function useVisualSearchEnabled() {
  const { value, isLoading } = useBootstrapSetting<any>("visual_search_enabled");
  return { enabled: value?.enabled === true, loading: isLoading };
}
