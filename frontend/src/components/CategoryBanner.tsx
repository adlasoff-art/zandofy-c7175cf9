import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

export function CategoryBanner() {
  const { data: categories, isLoading } = useQuery({
    queryKey: ["category-banner"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, name_fr, icon, image_url, parent_id")
        .is("parent_id", null)
        .order("name_fr");
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <section className="py-6 bg-card">
        <div className="container">
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-2 shrink-0">
                <Skeleton className="w-16 h-16 rounded-full" />
                <Skeleton className="h-3 w-12" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-6 bg-card">
      <div className="container">
        <div className="flex overflow-x-auto snap-x snap-mandatory touch-pan-x gap-4 pb-2 scrollbar-hide sm:grid sm:grid-cols-6 md:grid-cols-8 sm:overflow-visible sm:pb-0">
          {(categories || []).map((cat) => (
            <Link
              key={cat.id}
              to={`/category/${cat.name.toLowerCase()}`}
              className="flex flex-col items-center gap-2 group snap-start shrink-0 w-[72px] sm:w-auto"
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
                  <span className="text-xs font-bold text-primary">{cat.name_fr.slice(0, 2).toUpperCase()}</span>
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
