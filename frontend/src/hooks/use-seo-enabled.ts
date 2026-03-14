import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useSeoEnabled() {
  const [seoEnabled, setSeoEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const { data } = await supabase
          .from("platform_settings")
          .select("value")
          .eq("key", "seo_enabled")
          .maybeSingle();
        if (!cancelled) {
          setSeoEnabled(data?.value === true);
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  return { seoEnabled, isLoading };
}
