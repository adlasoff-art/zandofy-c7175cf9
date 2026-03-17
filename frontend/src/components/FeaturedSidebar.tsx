import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeaturedPlacement {
  id: string;
  placement_type: string;
  product_id: string | null;
  store_id: string | null;
  title: string | null;
  image_url: string | null;
  cta_text: string | null;
  cta_link: string | null;
  bg_color: string | null;
  text_color: string | null;
}

export function FeaturedSidebar() {
  const [placements, setPlacements] = useState<FeaturedPlacement[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date().toISOString();
    (supabase.from("featured_placements" as any) as any)
      .select("id, placement_type, product_id, store_id, title, image_url, cta_text, cta_link, bg_color, text_color")
      .eq("is_active", true)
      .lte("start_date", now)
      .gte("end_date", now)
      .order("sort_order")
      .then(({ data }: any) => {
        setPlacements(data || []);
        setLoading(false);
      });
  }, []);

  // Auto-slide every 5s
  useEffect(() => {
    if (placements.length <= 1) return;
    const interval = setInterval(() => {
      setCurrent((c) => (c + 1) % placements.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [placements.length]);

  const prev = useCallback(() => setCurrent((c) => (c - 1 + placements.length) % placements.length), [placements.length]);
  const next = useCallback(() => setCurrent((c) => (c + 1) % placements.length), [placements.length]);

  if (loading || placements.length === 0) return null;

  const item = placements[current];
  const link = item.cta_link || (item.product_id ? `/product/${item.product_id}` : "#");

  return (
    <div className="w-full lg:w-[300px] shrink-0">
      <div className="sticky top-20">
        {/* Header */}
        <div className="flex items-center gap-1.5 mb-2">
          <Sparkles size={14} className="text-primary" />
          <span className="text-xs font-semibold text-primary uppercase tracking-wide">Sponsorisé</span>
        </div>

        {/* Card */}
        <div
          className="relative rounded-xl overflow-hidden shadow-md border border-border"
          style={{ aspectRatio: "300/600", maxHeight: 600 }}
        >
          <Link to={link} className="block w-full h-full">
            {/* Background */}
            <div
              className="absolute inset-0"
              style={{ backgroundColor: item.bg_color || "hsl(var(--card))" }}
            />

            {/* Image */}
            {item.image_url && (
              <img
                src={item.image_url}
                alt={item.title || "Promotion"}
                className="absolute inset-0 w-full h-full object-cover"
                loading="lazy"
              />
            )}

            {/* Overlay content */}
            <div className="absolute inset-0 flex flex-col justify-end p-4 bg-gradient-to-t from-black/60 via-transparent to-transparent">
              {item.title && (
                <h3
                  className="text-lg font-bold leading-tight mb-2 line-clamp-3"
                  style={{ color: item.text_color || "#ffffff" }}
                >
                  {item.title}
                </h3>
              )}
              {item.cta_text && (
                <span className="inline-flex items-center justify-center px-5 py-2 text-sm font-semibold rounded-full bg-primary text-primary-foreground w-fit hover:opacity-90 transition-opacity">
                  {item.cta_text}
                </span>
              )}
            </div>
          </Link>

          {/* Navigation dots & arrows */}
          {placements.length > 1 && (
            <>
              <button
                onClick={(e) => { e.preventDefault(); prev(); }}
                className="absolute left-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-background/80 flex items-center justify-center text-foreground hover:bg-background transition-colors z-10"
                aria-label="Précédent"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={(e) => { e.preventDefault(); next(); }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-background/80 flex items-center justify-center text-foreground hover:bg-background transition-colors z-10"
                aria-label="Suivant"
              >
                <ChevronRight size={14} />
              </button>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
                {placements.map((_, i) => (
                  <button
                    key={i}
                    onClick={(e) => { e.preventDefault(); setCurrent(i); }}
                    className={cn(
                      "w-1.5 h-1.5 rounded-full transition-all",
                      i === current ? "bg-primary w-4" : "bg-white/60"
                    )}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
