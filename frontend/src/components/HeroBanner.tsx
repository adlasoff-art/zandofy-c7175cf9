import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { imgUrl, imgSrcSet } from "@/lib/image-url";

interface BannerItem {
  id: string;
  title: string;
  subtitle?: string;
  cta?: string;
  image_url: string | null;
  link: string | null;
}

export function HeroBanner() {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState<"left" | "right">("left");
  const [isAnimating, setIsAnimating] = useState(false);
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);
  const sliderRef = useRef<HTMLDivElement>(null);

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

  const goTo = useCallback((index: number, dir: "left" | "right") => {
    if (isAnimating || heroSlides.length === 0) return;
    setDirection(dir);
    setIsAnimating(true);
    setCurrent(index);
    setTimeout(() => setIsAnimating(false), 700);
  }, [isAnimating, heroSlides.length]);

  const goNext = useCallback(() => {
    if (heroSlides.length === 0) return;
    goTo((current + 1) % heroSlides.length, "left");
  }, [current, heroSlides.length, goTo]);

  const goPrev = useCallback(() => {
    if (heroSlides.length === 0) return;
    goTo((current - 1 + heroSlides.length) % heroSlides.length, "right");
  }, [current, heroSlides.length, goTo]);

  // Auto-play
  useEffect(() => {
    if (heroSlides.length <= 1) return;
    const timer = setInterval(goNext, 5000);
    return () => clearInterval(timer);
  }, [goNext, heroSlides.length]);

  // Reset current if slides changed
  useEffect(() => {
    if (current >= heroSlides.length && heroSlides.length > 0) setCurrent(0);
  }, [heroSlides.length, current]);

  // Inject preload link for first slide image (LCP optimization)
  useEffect(() => {
    const firstUrl = heroSlides[0]?.image_url;
    if (!firstUrl) return;
    const optimizedUrl = imgUrl(firstUrl, { width: 1280, quality: 75 });
    // Persist LCP URL so the inline boot script can preload it on the next visit
    // BEFORE React even hydrates (saves ~2s on the LCP "resource load delay" subpart).
    try { localStorage.setItem("z_lcp_hero_url", optimizedUrl); } catch { /* quota / private mode */ }
    const id = "hero-lcp-preload";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "preload";
    link.as = "image";
    link.href = optimizedUrl;
    link.imageSrcset = imgSrcSet(firstUrl, [640, 1024, 1280], { quality: 75 });
    link.imageSizes = "100vw";
    (link as any).fetchPriority = "high";
    document.head.appendChild(link);
  }, [heroSlides]);

  // Touch handlers for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartX.current;
    touchDeltaX.current = dx;
  };

  const handleTouchEnd = () => {
    if (touchDeltaX.current < -50) goNext();
    else if (touchDeltaX.current > 50) goPrev();
  };

  if (heroSlides.length === 0) {
    return (
      <section className="bg-muted">
        <div className="container py-3">
          <Skeleton className="h-[260px] md:h-[380px] rounded-xl" />
        </div>
      </section>
    );
  }

  return (
    <section className="bg-muted">
      <div className="container py-3">
        <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_180px] gap-2.5" style={{ minHeight: 380 }}>
          {/* Left sidebar banners */}
          <div className="hidden lg:flex flex-col gap-2" style={{ height: 380 }}>
            {leftBanners.map((b) => (
              <Link key={b.id} to={b.link || "/"} className="relative block rounded-xl overflow-hidden group" style={{ flex: 1 }}>
                <img src={imgUrl(b.image_url, { width: 240 }) || "/placeholder.svg"} srcSet={b.image_url ? imgSrcSet(b.image_url, [200, 400]) : undefined} sizes="200px" alt={b.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" decoding="async" {...({ fetchpriority: "low" } as any)} />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">{b.title}</span>
                </div>
              </Link>
            ))}
          </div>

          {/* Center carousel with horizontal slide animation */}
          <div
            ref={sliderRef}
            className="relative rounded-xl overflow-hidden touch-pan-y select-none bg-muted"
            style={{ height: 380, minHeight: 380 }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {heroSlides.map((slide, i) => (
              <div
                key={slide.id}
                className="absolute inset-0 w-full h-full"
                style={{
                  transform: i === current
                    ? "translateX(0)"
                    : direction === "left"
                      ? "translateX(100%)"
                      : "translateX(-100%)",
                  transition: isAnimating ? "transform 700ms cubic-bezier(0.4, 0, 0.2, 1)" : "none",
                  zIndex: i === current ? 2 : 1,
                  visibility: i === current || isAnimating ? "visible" : "hidden",
                }}
              >
                <img
                  src={imgUrl(slide.image_url, { width: 1280, quality: 75 }) || "/placeholder.svg"}
                  srcSet={slide.image_url ? imgSrcSet(slide.image_url, [640, 1024, 1280], { quality: 75 }) : undefined}
                  sizes="(max-width: 1024px) 100vw, 1024px"
                  alt={slide.title}
                  className="w-full h-full object-cover"
                  loading={i === 0 ? "eager" : "lazy"}
                  decoding={i === 0 ? "sync" : "async"}
                  width={1200}
                  height={380}
                  {...(i === 0 ? ({ fetchpriority: "high" } as any) : {})}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent flex flex-col justify-center pl-6 md:pl-12">
                  <h2 className="text-white text-xl md:text-4xl font-bold tracking-wide max-w-md">{slide.title}</h2>
                  {slide.subtitle && <p className="text-white/80 text-sm md:text-base mt-1 max-w-sm">{slide.subtitle}</p>}
                  {slide.cta && (
                    <Link to={slide.link || "/"} className="mt-4 inline-block w-fit px-6 py-2.5 text-xs font-bold bg-white text-gray-900 rounded-sm hover:bg-white/90 transition-colors uppercase tracking-wider">
                      {slide.cta}
                    </Link>
                  )}
                </div>
              </div>
            ))}

            {/* Navigation arrows */}
            <button onClick={goPrev} className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition-colors z-10 shadow-md">
              <ChevronLeft size={18} className="text-gray-900" />
            </button>
            <button onClick={goNext} className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/80 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition-colors z-10 shadow-md">
              <ChevronRight size={18} className="text-gray-900" />
            </button>

            {/* Dots */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
              {heroSlides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i, i > current ? "left" : "right")}
                  className={`rounded-full transition-all duration-300 ${i === current ? "bg-white w-6 h-2" : "bg-white/40 w-2 h-2 hover:bg-white/60"}`}
                />
              ))}
            </div>
          </div>

          {/* Right sidebar banners */}
          <div className="hidden lg:flex flex-col gap-2" style={{ height: 380 }}>
            {rightBanners.map((b) => (
              <Link key={b.id} to={b.link || "/"} className="relative block rounded-xl overflow-hidden group" style={{ flex: 1 }}>
                <img src={imgUrl(b.image_url, { width: 220 }) || "/placeholder.svg"} srcSet={b.image_url ? imgSrcSet(b.image_url, [200, 400]) : undefined} sizes="180px" alt={b.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" decoding="async" {...({ fetchpriority: "low" } as any)} />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <span className="text-white text-sm font-bold">{b.title}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
