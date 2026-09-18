import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchProducts, type Product } from "@/services/api";
import { ProductRail } from "@/components/ProductRail";
import { categoryPath } from "@/lib/category-slug";
import { useI18n } from "@/contexts/I18nContext";
import { useHomeMarket } from "@/contexts/HomeMarketContext";
import { sanitizeRouterTo } from "@/lib/safe-href";

export function HomeCmsRails() {
  const { locale } = useI18n();
  const { shopTypeFilter } = useHomeMarket();
  const [rails, setRails] = useState<LoadedRail[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("cms_homepage_sections")
        .select("id, label, section_key, is_active, sort_order, config")
        .eq("is_active", true)
        .in("section_key", ["category_rail", "store_rail"])
        .order("sort_order");

      const sections = (data || []) as CmsSection[];
      if (cancelled || sections.length === 0) {
        if (!cancelled) setRails([]);
        return;
      }

      const loaded: LoadedRail[] = [];
      for (const section of sections) {
        const entityId = section.config?.entity_id;
        if (!entityId) continue;
        const limit = Math.min(Math.max(section.config?.limit ?? 12, 4), 24);
        try {
          if (section.section_key === "category_rail") {
            const products = await fetchProducts({
              categoryId: entityId,
              limit,
              shopType: shopTypeFilter,
            });
            if (products.length === 0) continue;
            const { data: cat } = await supabase
              .from("categories")
              .select("id, name, name_fr, parent_id")
              .eq("id", entityId)
              .maybeSingle();
            const href =
              sanitizeRouterTo(section.config?.href) ||
              (cat ? categoryPath(cat as any, locale) : `/search?category=${entityId}`);
            loaded.push({
              id: section.id,
              title: section.label,
              href,
              products,
            });
          } else if (section.section_key === "store_rail") {
            const products = await fetchProducts({
              storeId: entityId,
              limit,
              shopType: shopTypeFilter,
            });
            if (products.length === 0) continue;
            loaded.push({
              id: section.id,
              title: section.label,
              href: sanitizeRouterTo(section.config?.href) || `/store/${entityId}`,
              products,
            });
          }
        } catch (err) {
          console.warn("[HomeCmsRails] section failed:", section.id, err);
        }
      }
      if (!cancelled) setRails(loaded);
    })();
    return () => {
      cancelled = true;
    };
  }, [locale, shopTypeFilter]);

  if (rails.length === 0) return null;

  return (
    <>
      {rails.map((rail) => (
        <ProductRail
          key={rail.id}
          title={rail.title}
          titleId={`cms-rail-${rail.id}`}
          seeAllHref={rail.href}
          products={rail.products}
          className="bg-card"
        />
      ))}
    </>
  );
}
