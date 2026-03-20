import { useState, useEffect, useCallback, useRef } from "react";
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
  image_url_2: string | null;
  cta_text: string | null;
  cta_link: string | null;
  bg_color: string | null;
  text_color: string | null;
  start_date: string;
  end_date: string;
  show_timer: boolean;
  timer_color: string | null;
}

function CountdownTimer({ endDate, color }: { endDate: string; color: string }) {
  const [remaining, setRemaining] = useState(() => Math.max(0, new Date(endDate).getTime() - Date.now()));

  useEffect(() => {
    if (remaining <= 0) return;
    const interval = setInterval(() => {
      const r = Math.max(0, new Date(endDate).getTime() - Date.now());
      setRemaining(r);
      if (r <= 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [endDate, remaining > 0]);

  if (remaining <= 0) return null;

  const totalSeconds = Math.floor(remaining / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex items-center gap-1 pointer-events-none">
      {[pad(hours), pad(minutes), pad(seconds)].map((v, i) => (
        <span key={i} className="flex items-center gap-1">
          <span
            className="text-sm font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm"
            style={{ color, backgroundColor: "rgba(0,0,0,0.45)" }}
          >
            {v}
          </span>
          {i < 2 && <span style={{ color }} className="text-sm font-bold">:</span>}
        </span>
      ))}
    </div>
  );
}

/** For placements with 2 images: auto-alternates between them */
function DualImageSlider({ image1, image2, hovered }: { image1: string; image2: string; hovered: boolean }) {
  const [showSecond, setShowSecond] = useState(false);

  useEffect(() => {
    if (!image2) return;
    const interval = setInterval(() => {
      setShowSecond((prev) => !prev);
    }, 3000);
    return () => clearInterval(interval);
  }, [image2]);

  return (
    <>
      <img
        src={image1}
        alt="Promo 1"
        className={cn(
          "absolute inset-0 w-full h-full object-cover transition-all duration-700",
          showSecond ? "opacity-0" : "opacity-100",
          hovered ? "scale-105" : "scale-100"
        )}
        loading="lazy"
      />
      <img
        src={image2}
        alt="Promo 2"
        className={cn(
          "absolute inset-0 w-full h-full object-cover transition-all duration-700",
          showSecond ? "opacity-100" : "opacity-0",
          hovered ? "scale-105" : "scale-100"
        )}
        loading="lazy"
      />
    </>
  );
}

export function FeaturedSidebar() {
  const [placements, setPlacements] = useState<FeaturedPlacement[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [slideDir, setSlideDir] = useState<"left" | "right">("left");
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    const now = new Date().toISOString();
    (supabase.from("featured_placements" as any) as any)
      .select("id, placement_type, product_id, store_id, title, image_url, image_url_2, cta_text, cta_link, bg_color, text_color, start_date, end_date, show_timer, timer_color")
      .eq("is_active", true)
      .lte("start_date", now)
      .gte("end_date", now)
      .order("sort_order")
      .then(({ data }: any) => {
        setPlacements(data || []);
        setLoading(false);
      });
  }, []);

  // Auto-slide every 5s between placements, paused on hover
  useEffect(() => {
    if (placements.length <= 1 || hovered) return;
    const interval = setInterval(() => {
      goTo((current + 1) % placements.length, "left");
    }, 5000);
    return () => clearInterval(interval);
  }, [placements.length, hovered, current]);

  const goTo = useCallback((idx: number, dir: "left" | "right") => {
    if (animating) return;
    setSlideDir(dir);
    setAnimating(true);
    setTimeout(() => {
      setCurrent(idx);
      setTimeout(() => setAnimating(false), 50);
    }, 300);
  }, [animating]);

  const prev = useCallback(() => goTo((current - 1 + placements.length) % placements.length, "right"), [current, placements.length, goTo]);
  const next = useCallback(() => goTo((current + 1) % placements.length, "left"), [current, placements.length, goTo]);

  if (loading || placements.length === 0) return null;

  const item = placements[current];
  const link = item.cta_link || (item.product_id ? `/product/${item.product_id}` : "#");
  const hasDualImages = !!(item.image_url && item.image_url_2);

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
          className="relative rounded-xl overflow-hidden shadow-md border border-border group"
          style={{ aspectRatio: "300/600", maxHeight: 600 }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <Link to={link} className="block w-full h-full">
            {/* Background */}
            <div
              className="absolute inset-0"
              style={{ backgroundColor: item.bg_color || "hsl(var(--card))" }}
            />

            {/* Image(s) */}
            {hasDualImages ? (
              <DualImageSlider
                image1={item.image_url!}
                image2={item.image_url_2!}
                hovered={hovered}
              />
            ) : item.image_url ? (
              <img
                src={item.image_url}
                alt={item.title || "Promotion"}
                className={cn(
                  "absolute inset-0 w-full h-full object-cover transition-all duration-500",
                  hovered ? "scale-105" : "scale-100",
                  animating && slideDir === "left" && "animate-[slideOutLeft_300ms_ease-in-out_forwards]",
                  animating && slideDir === "right" && "animate-[slideOutRight_300ms_ease-in-out_forwards]",
                  !animating && "animate-[slideIn_300ms_ease-in-out]"
                )}
                loading="lazy"
              />
            ) : null}

            {/* Countdown timer */}
            {item.show_timer && (
              <CountdownTimer
                endDate={item.end_date}
                color={item.timer_color || "#ffffff"}
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
                    onClick={(e) => { e.preventDefault(); goTo(i, i > current ? "left" : "right"); }}
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
