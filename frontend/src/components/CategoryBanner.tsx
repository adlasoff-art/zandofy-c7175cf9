import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronUp } from "lucide-react";

const MOBILE_COLS = 5;
const MOBILE_MAX_ROWS = 2;

export function CategoryBanner() {
  const [expanded, setExpanded] = useState(false);

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
      <section className="py-4 bg-card" style={{ minHeight: 120 }}>
        <div className="container">
          <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 gap-3">
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

  const mobileVisibleCount = MOBILE_COLS * MOBILE_MAX_ROWS;
  const hasMoreOnMobile = categories.length > mobileVisibleCount;
  const showAll = expanded || !hasMoreOnMobile;

  return (
    <section className="py-4 bg-card">
      <div className="container">
        {/* Mobile: grid 5 cols, collapsible */}
        <div className="sm:hidden">
          <div className="grid grid-cols-5 gap-x-2 gap-y-3">
            {categories
              .slice(0, showAll ? undefined : mobileVisibleCount)
              .map((cat: any) => (
                <Link
                  key={cat.id}
                  to={`/category/${cat.name.toLowerCase()}`}
                  className="flex flex-col items-center gap-1 group"
                >
                  <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-border group-hover:border-primary transition-colors bg-muted flex items-center justify-center">
                    {cat.image_url ? (
                      <img
                        src={cat.image_url}
                        alt={cat.name_fr}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : cat.icon ? (
                      <span className="text-xl">{cat.icon}</span>
                    ) : (
                      <span className="text-[10px] font-bold text-primary">
                        {cat.name_fr.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-foreground text-center leading-tight font-medium line-clamp-2 max-w-[60px]">
                    {cat.name_fr}
                  </span>
                </Link>
              ))}
          </div>

          {hasMoreOnMobile && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center justify-center gap-1 w-full mt-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {expanded ? (
                <>Réduire <ChevronUp size={14} /></>
              ) : (
                <>Voir tout ({categories.length}) <ChevronDown size={14} /></>
              )}

            </button>
          )}
        </div>

        {/* Tablet / Desktop: horizontal scroll or grid */}
        <div className="hidden sm:grid sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
          {categories.map((cat: any) => (
            <Link
              key={cat.id}
              to={`/category/${cat.name.toLowerCase()}`}
              className="flex flex-col items-center gap-1.5 group"
            >
              <div className="w-16 h-16 md:w-[72px] md:h-[72px] rounded-full overflow-hidden border-2 border-border group-hover:border-primary transition-colors bg-muted flex items-center justify-center">
                {cat.image_url ? (
                  <img
                    src={cat.image_url}
                    alt={cat.name_fr}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : cat.icon ? (
                  <span className="text-2xl">{cat.icon}</span>
                ) : (
                  <span className="text-xs font-bold text-primary">
                    {cat.name_fr.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <span className="text-[11px] text-foreground text-center leading-tight font-medium">
                {cat.name_fr}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
