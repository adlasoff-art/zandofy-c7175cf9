import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSwipe } from "@/hooks/use-swipe";
import { Skeleton } from "@/components/ui/skeleton";

interface BannerItem {
  id: string;
  title: string;
  subtitle?: string;
  cta?: string;
  image_url: string | null;
  link: string | null;
}

export function HeroBanner() {
  const [current, setCurrent] = useState<number>(0);

  const { data: heroSlides = [] } = useQuery({
    queryKey: ["cms-banners", "hero_slide"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cms_banners")
        .select("id, title, subtitle, cta, image_url, link")
        .eq("position", "hero_slide")
        .eq("is_active", true)
        .order("sort_order");
      return (data || []) as BannerItem[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: leftBanners = [] } = useQuery({
    queryKey: ["cms-banners", "hero_left"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cms_banners")
        .select("id, title, image_url, link")
        .eq("position", "hero_left")
        .eq("is_active", true)
        .order("sort_order");
      return (data || []) as BannerItem[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: rightBanners = [] } = useQuery({
    queryKey: ["cms-banners", "hero_right"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cms_banners")
        .select("id, title, image_url, link")
        .eq("position", "hero_right")
        .eq("is_active", true)
        .order("sort_order");
      return (data || []) as BannerItem[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const goNext = useCallback(() => {
    if (heroSlides.length === 0) return;
    setCurrent((c) => (c + 1) % heroSlides.length);
  }, [heroSlides.length]);

  const goPrev = useCallback(() => {
    if (heroSlides.length === 0) return;
    setCurrent((c) => (c - 1 + heroSlides.length) % heroSlides.length);
  }, [heroSlides.length]);

  const swipeHandlers = useSwipe(goNext, goPrev);

  useEffect(() => {
    if (heroSlides.length === 0) return;
    const timer = setInterval(goNext, 4000);
    return () => clearInterval(timer);
  }, [goNext, heroSlides.length]);

  // Reset current if slides changed
  useEffect(() => {
    if (current >= heroSlides.length && heroSlides.length > 0) setCurrent(0);
  }, [heroSlides.length, current]);

  if (heroSlides.length === 0) {
    return (
      <section className="bg-muted">
        <div className="container py-3">
          <Skeleton className="h-[340px] rounded-md" />
        </div>
      </section>
    );
  }

  const slide = heroSlides[current];

  return (
    <section className="bg-muted">
      <div className="container py-3">
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_180px] gap-2.5" style={{ minHeight: 340 }}>
          {/* Left sidebar banners */}
          <div className="hidden lg:flex flex-col gap-2" style={{ height: 340 }}>
            {leftBanners.map((b) => (
              <Link key={b.id} to={b.link || "/"} className="relative block rounded-md overflow-hidden group" style={{ flex: 1 }}>
                <img src={b.image_url || "/placeholder.svg"} alt={b.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <div className="absolute inset-0 bg-foreground/40 flex items-center justify-center">
                  <span className="text-card text-sm font-bold">{b.title}</span>
                </div>
              </Link>
            ))}
          </div>

          {/* Center carousel */}
          <div
            className="relative rounded-md overflow-hidden touch-pan-y"
            style={{ height: 340 }}
            {...swipeHandlers}
          >
            <img
              src={slide.image_url || "/placeholder.svg"}
              alt={slide.title}
              className="w-full h-full object-cover transition-opacity duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-foreground/50 to-transparent flex flex-col justify-center pl-8 md:pl-12">
              <h2 className="text-card text-2xl md:text-4xl font-bold tracking-wide">{slide.title}</h2>
              {slide.subtitle && <p className="text-card/80 text-sm md:text-base mt-1">{slide.subtitle}</p>}
              {slide.cta && (
                <Link to={slide.link || "/"} className="mt-4 inline-block w-fit px-6 py-2.5 text-xs font-bold bg-card text-foreground rounded-sm hover:bg-card/90 transition-colors uppercase tracking-wider">
                  {slide.cta}
                </Link>
              )}
            </div>

            <button onClick={goPrev} className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-card/70 rounded-full flex items-center justify-center hover:bg-card transition-colors">
              <ChevronLeft size={16} className="text-foreground" />
            </button>
            <button onClick={goNext} className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-card/70 rounded-full flex items-center justify-center hover:bg-card transition-colors">
              <ChevronRight size={16} className="text-foreground" />
            </button>

            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {heroSlides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${i === current ? "bg-card" : "bg-card/40"}`}
                />
              ))}
            </div>
          </div>

          {/* Right sidebar banners */}
          <div className="hidden lg:flex flex-col gap-2" style={{ height: 340 }}>
            {rightBanners.map((b) => (
              <Link key={b.id} to={b.link || "/"} className="relative block rounded-md overflow-hidden group" style={{ flex: 1 }}>
                <img src={b.image_url || "/placeholder.svg"} alt={b.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <div className="absolute inset-0 bg-foreground/40 flex items-center justify-center">
                  <span className="text-card text-sm font-bold">{b.title}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
