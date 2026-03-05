import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useSeoEnabled() {
  const { data: seoEnabled = false, isLoading } = useQuery({
    queryKey: ["seo-enabled"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "seo_enabled")
        .maybeSingle();
      return data?.value === true;
    },
    staleTime: 60_000,
  });

  return { seoEnabled, isLoading };
}
