import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ProductRail } from "@/components/ProductRail";
import { ProductCard } from "@/components/ProductCard";
import { mapProduct, type Product } from "@/services/api";
import { useI18n } from "@/contexts/I18nContext";

/** Hide-if-empty samples rail (I9). Renders nothing when flag off or no offers. */
export function HomeSamplesRail() {
  const { t } = useI18n();
  const { data, isLoading } = useQuery({
    queryKey: ["home-sample-offers"],
    queryFn: async () => {
      const { data: flag } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "samples_enabled")
        .maybeSingle();
      const enabled = (flag?.value as { enabled?: boolean } | null)?.enabled === true;
      if (!enabled) return { enabled: false, products: [] as Product[] };

      const { data: offers } = await (supabase as any)
        .from("sample_offers")
        .select("product_id")
        .eq("is_active", true)
        .limit(24);
      const ids = [...new Set((offers || []).map((o: { product_id: string }) => o.product_id).filter(Boolean))];
      if (!ids.length) return { enabled: true, products: [] as Product[] };

      const { data: rows } = await (supabase as any)
        .from("products_public")
        .select("*, product_images(image_url, position), categories(name, name_fr)")
        .in("id", ids)
        .limit(12);
      return {
        enabled: true,
        products: (rows || []).map((r: any) => mapProduct(r)),
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return null;
  if (!data?.enabled || !data.products.length) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-foreground">
          {t("home.samples") || "Échantillons"}
        </h2>
        <Link to="/sourcing" className="text-xs text-primary hover:underline">
          {t("common.seeAll") || "Voir tout"}
        </Link>
      </div>
      <ProductRail>
        {data.products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </ProductRail>
    </section>
  );
}
