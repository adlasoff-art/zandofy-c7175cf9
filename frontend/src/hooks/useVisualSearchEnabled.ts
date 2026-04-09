import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns whether visual search (camera icon in search bar) is enabled.
 * Reads from platform_settings key "visual_search_enabled".
 * Defaults to false (disabled).
 */
export function useVisualSearchEnabled() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("platform_settings")
      .select("value")
      .eq("key", "visual_search_enabled")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) {
          setEnabled((data.value as any)?.enabled === true);
        }
        setLoading(false);
      });
  }, []);

  return { enabled, loading };
}
