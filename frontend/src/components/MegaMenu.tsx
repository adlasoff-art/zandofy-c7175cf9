import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface DBCategory {
  id: string;
  name: string;
  name_fr: string;
  icon: string | null;
  parent_id: string | null;
  image_url: string | null;
}

export function MegaMenu() {
  const [activeIndex, setActiveIndex] = useState(0);

  const { data: allCategories } = useQuery({
    queryKey: ["mega-menu-categories"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("categories")
        .select("id, name, name_fr, icon, parent_id, image_url, sort_order")
        .order("sort_order")
        .order("name_fr");
      if (error) throw error;
      return (data || []) as DBCategory[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const parents = (allCategories || []).filter((c) => !c.parent_id);
  const getChildren = (parentId: string) =>
    (allCategories || []).filter((c) => c.parent_id === parentId);

  const active = parents[activeIndex];
  const subcategories = active ? getChildren(active.id) : [];

  if (!allCategories || parents.length === 0) {
    return (
      <div className="absolute top-full left-0 right-0 bg-card border-b border-border shadow-lg z-50 animate-fade-in">
        <div className="container py-6">
          <div className="flex gap-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-6 w-24" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute top-full left-0 right-0 bg-card border-b border-border shadow-lg z-50 animate-fade-in">
      <div className="container py-4">
        <div className="grid grid-cols-[200px_1fr] gap-4 min-h-[320px]">
          {/* Col 1: Parent categories */}
          <div className="border-r border-border pr-4">
            {parents.map((cat, i) => (
              <Link
                key={cat.id}
                to={`/category/${cat.name.toLowerCase()}`}
                onMouseEnter={() => setActiveIndex(i)}
                className={`w-full flex items-center gap-2 text-left px-3 py-2.5 text-[13px] font-medium rounded-md transition-colors ${
                  i === activeIndex
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                {cat.icon && <span>{cat.icon}</span>}
                {cat.name_fr}
              </Link>
            ))}
          </div>

          {/* Col 2: Subcategories grid */}
          <div className="overflow-y-auto max-h-[360px] px-2">
            {active && (
              <>
                <Link
                  to={`/category/${active.name.toLowerCase()}`}
                  className="inline-flex items-center gap-1 text-xs text-primary font-medium mb-3 hover:underline"
                >
                  Tout voir {active.name_fr} →
                </Link>
                <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                  {subcategories.map((sub) => (
                    <Link
                      key={sub.id}
                      to={`/category/${sub.name.toLowerCase()}`}
                      className="flex flex-col items-center gap-2 group py-2"
                    >
                      <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-border group-hover:border-primary transition-colors bg-muted flex items-center justify-center">
                        {sub.image_url ? (
                          <img src={sub.image_url} alt={sub.name_fr} className="w-full h-full object-cover" />
                        ) : sub.icon ? (
                          <span className="text-xl">{sub.icon}</span>
                        ) : (
                          <span className="text-xs font-bold text-primary">
                            {sub.name_fr.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-foreground text-center font-medium group-hover:text-primary transition-colors">
                        {sub.name_fr}
                      </span>
                    </Link>
                  ))}
                </div>
              </>
            )}

            {subcategories.length === 0 && active && (
              <p className="text-sm text-muted-foreground py-4">
                Aucune sous-catégorie
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
