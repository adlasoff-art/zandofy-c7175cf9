import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchProducts, type Product } from "@/services/api";
import { ProductRail } from "@/components/ProductRail";
import { ProductCard } from "@/components/ProductCard";
import { categoryPath } from "@/lib/category-slug";
import { PRODUCT_GRID_CLASS } from "@/lib/product-image-fit";
import { useI18n } from "@/contexts/I18nContext";
import { useHomeMarket } from "@/contexts/HomeMarketContext";
import { sanitizeRouterTo } from "@/lib/safe-href";

type DisplayMode = "rail" | "grid_page";

type CmsSection = {
  id: string;
  label: string;
  section_key: string;
  is_active: boolean;
  sort_order: number;
  config: {
    entity_id?: string;
    limit?: number;
    href?: string;
    display_mode?: DisplayMode;
  } | null;
};

type LoadedSection = {
  id: string;
  title: string;
  href?: string;
  products: Product[];
  displayMode: DisplayMode;
};

export function HomeCmsRails() {
  const { locale } = useI18n();
  const { shopTypeFilter } = useHomeMarket();
  const [sections, setSections] = useState<LoadedSection[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("cms_homepage_sections")
        .select("id, label, section_key, is_active, sort_order, config")
        .eq("is_active", true)
        .in("section_key", ["category_rail", "store_rail"])
        .order("sort_order");

      const rows = (data || []) as CmsSection[];
      if (cancelled || rows.length === 0) {
        if (!cancelled) setSections([]);
        return;
      }

      const loaded: LoadedSection[] = [];
      for (const section of rows) {
        const entityId = section.config?.entity_id;
        if (!entityId) continue;
        const limit = Math.min(Math.max(section.config?.limit ?? 12, 4), 24);
        const displayMode: DisplayMode =
          section.config?.display_mode === "grid_page" ? "grid_page" : "rail";
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
              displayMode,
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
              displayMode,
            });
          }
        } catch (err) {
          console.warn("[HomeCmsRails] section failed:", section.id, err);
        }
      }
      if (!cancelled) setSections(loaded);
    })();
    return () => {
      cancelled = true;
    };
  }, [locale, shopTypeFilter]);

  if (sections.length === 0) return null;

  return (
    <>
      {sections.map((section) =>
        section.displayMode === "grid_page" ? (
          <section
            key={section.id}
            className="py-4 bg-muted/30 dark:bg-muted/10"
            aria-labelledby={`cms-grid-${section.id}`}
          >
            <div className="container">
              {section.href ? (
                <Link to={section.href} className="flex items-center gap-2 mb-4 group w-fit">
                  <h2
                    id={`cms-grid-${section.id}`}
                    className="text-base md:text-lg font-bold text-foreground group-hover:text-primary transition-colors"
                  >
                    {section.title}
                  </h2>
                  <ChevronRight
                    size={16}
                    className="text-muted-foreground group-hover:text-primary transition-colors"
                  />
                </Link>
              ) : (
                <h2
                  id={`cms-grid-${section.id}`}
                  className="text-base md:text-lg font-bold text-foreground mb-4"
                >
                  {section.title}
                </h2>
              )}
              <div className={PRODUCT_GRID_CLASS}>
                {section.products.map((product, i) => (
                  <Link
                    to={`/product/${product.slug || product.id}`}
                    key={product.id}
                    className="block"
                  >
                    <ProductCard product={product} index={i} />
                  </Link>
                ))}
              </div>
            </div>
          </section>
        ) : (
          <ProductRail
            key={section.id}
            title={section.title}
            titleId={`cms-rail-${section.id}`}
            seeAllHref={section.href}
            products={section.products}
            skeletonCount={12}
            className="bg-muted/30 dark:bg-muted/10"
          />
        ),
      )}
    </>
  );
}
