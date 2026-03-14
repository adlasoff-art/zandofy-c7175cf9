import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useSeoEnabled() {
  // Safely check if we're inside a QueryClientProvider
  let hasClient = false;
  try {
    useQueryClient();
    hasClient = true;
  } catch {
    // No QueryClient available
  }

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
    enabled: hasClient,
  });

  if (!hasClient) return { seoEnabled: false, isLoading: false };

  return { seoEnabled, isLoading };
}
