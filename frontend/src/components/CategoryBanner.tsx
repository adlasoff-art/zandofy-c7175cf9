import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { categoryPath } from "@/lib/category-slug";
import { useI18n } from "@/contexts/I18nContext";
import { OptimizedImage } from "@/components/OptimizedImage";
import { CATEGORY_ICON_IMAGE_CLASS } from "@/lib/product-image-fit";

export function CategoryBanner() {
  const { locale } = useI18n();
  const getLabel = (c: { name?: string | null; name_fr?: string | null }) =>
    (locale === "fr" ? (c.name_fr ?? c.name) : (c.name ?? c.name_fr)) ?? "";

  const { data: categories, isLoading, isError, error } = useQuery({
    queryKey: ["category-banner"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, name_fr, icon, image_url, parent_id")
        .is("parent_id", null)
        .order("sort_order")
        .order("name_fr");
      if (error) {
        console.error("[CategoryBanner] Supabase error:", error.message, error.code, error.details);
        throw error;
      }
      if (!data || data.length === 0) {
        console.warn("[CategoryBanner] No categories returned from database");
      }
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  if (isError) {
    console.error("[CategoryBanner] Query failed:", error);
  }

  if (isLoading) {
    return (
      <section className="py-3 bg-card" style={{ minHeight: 96 }}>
        <div className="container">
          <div className="flex gap-3 overflow-hidden sm:hidden">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5 shrink-0">
                <Skeleton className="w-14 h-14 rounded-full" />
                <Skeleton className="h-3 w-10" />
              </div>
            ))}
          </div>
          <div className="hidden sm:grid sm:grid-cols-6 md:grid-cols-8 gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <Skeleton className="w-14 h-14 rounded-full" />
                <Skeleton className="h-3 w-10" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (isError || !categories || categories.length === 0) {
    return null;
  }

  return (
    <section className="py-3 bg-card" style={{ minHeight: 96 }}>
      <div className="container">
        {/* Mobile: single horizontal row */}
        <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide snap-x snap-mandatory touch-pan-x sm:hidden">
          {categories.map((cat: any) => (
            <Link
              key={cat.id}
              to={categoryPath(cat, locale)}
              className="snap-start shrink-0 flex flex-col items-center gap-1 group w-[64px]"
            >
              <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-border group-hover:border-primary transition-colors bg-muted flex items-center justify-center">
                {cat.image_url ? (
                  <OptimizedImage
                    src={cat.image_url}
                    alt={getLabel(cat)}
                    width={56}
                    height={56}
                    widths={[56, 112, 168]}
                    sizes="56px"
                    resize="contain"
                    fitHeight={56}
                    className={CATEGORY_ICON_IMAGE_CLASS}
                  />
                ) : cat.icon ? (
                  <span className="text-xl">{cat.icon}</span>
                ) : (
                  <span className="text-[10px] font-bold text-primary">
                    {getLabel(cat).slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-foreground text-center leading-tight font-medium line-clamp-2 max-w-[64px]">
                {getLabel(cat)}
              </span>
            </Link>
          ))}
        </div>

        {/* Tablet / Desktop: grid unchanged */}
        <div className="hidden sm:grid sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
          {categories.map((cat: any) => (
            <Link
              key={cat.id}
              to={categoryPath(cat, locale)}
              className="flex flex-col items-center gap-1.5 group"
            >
              <div className="w-16 h-16 md:w-[72px] md:h-[72px] rounded-full overflow-hidden border-2 border-border group-hover:border-primary transition-colors bg-muted flex items-center justify-center">
                {cat.image_url ? (
                  <OptimizedImage
                    src={cat.image_url}
                    alt={getLabel(cat)}
                    width={72}
                    height={72}
                    widths={[72, 144, 216]}
                    sizes="(max-width: 768px) 64px, 72px"
                    resize="contain"
                    fitHeight={72}
                    className={CATEGORY_ICON_IMAGE_CLASS}
                  />
                ) : cat.icon ? (
                  <span className="text-2xl">{cat.icon}</span>
                ) : (
                  <span className="text-xs font-bold text-primary">
                    {getLabel(cat).slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <span className="text-[11px] text-foreground text-center leading-tight font-medium">
                {getLabel(cat)}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
