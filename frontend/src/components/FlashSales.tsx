import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Flame, Clock } from "lucide-react";
import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";
import { fetchFlashSaleProducts, type Product } from "@/services/api";
import { useI18n } from "@/contexts/I18nContext";

function useCountdown(targetDate: Date) {
  const [timeLeft, setTimeLeft] = useState(getTimeLeft(targetDate));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(getTimeLeft(targetDate));
    }, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  return timeLeft;
}

function getTimeLeft(target: Date) {
  const diff = Math.max(0, target.getTime() - Date.now());
  return {
    hours: Math.floor(diff / (1000 * 60 * 60)),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

export function FlashSales() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();

  // Find the nearest promo end date from fetched products, fallback to 8h
  const [saleEnd, setSaleEnd] = useState(() => new Date(Date.now() + 8 * 60 * 60 * 1000));
  const countdown = useCountdown(saleEnd);

  useEffect(() => {
    fetchFlashSaleProducts().then((data) => {
      setProducts(data);
      setLoading(false);

      // Use earliest real promo_end_date from DB if available
      const now = Date.now();
      const endDates = data
        .map((p: any) => p.promoEndDate ? new Date(p.promoEndDate).getTime() : null)
        .filter((t): t is number => t !== null && t > now);

      if (endDates.length > 0) {
        setSaleEnd(new Date(Math.min(...endDates)));
      }
    });
  }, []);

  if (!loading && products.length === 0) return null;

  return (
    <section id="flash" className="py-6 bg-card" aria-labelledby="home-flash-heading">
      <div className="container">
        {/* Section header — stacks vertically on mobile */}
        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 id="home-flash-heading" className="text-base md:text-lg font-bold text-foreground flex items-center gap-1.5 whitespace-nowrap">
              <Flame size={18} className="text-sale" aria-hidden />
              {t("home.flashSales")}
            </h2>
            <ChevronRight size={16} className="text-muted-foreground hidden md:block" />
          </div>

          {/* Countdown — on its own line on mobile */}
          <div className="flex items-center gap-1.5 text-xs">
            <Clock size={12} className="text-sale shrink-0" />
            <span className="text-sale whitespace-nowrap">{t("home.endsIn")}</span>
            <div className="flex gap-0.5 font-mono">
              <span className="bg-foreground text-card px-1.5 py-0.5 rounded text-[11px] font-bold w-[26px] text-center tabular-nums">
                {String(countdown.hours).padStart(2, "0")}
              </span>
              <span className="text-foreground font-bold">:</span>
              <span className="bg-foreground text-card px-1.5 py-0.5 rounded text-[11px] font-bold w-[26px] text-center tabular-nums">
                {String(countdown.minutes).padStart(2, "0")}
              </span>
              <span className="text-foreground font-bold">:</span>
              <span className="bg-foreground text-card px-1.5 py-0.5 rounded text-[11px] font-bold w-[26px] text-center tabular-nums">
                {String(countdown.seconds).padStart(2, "0")}
              </span>
            </div>
          </div>
        </div>

        {/* Horizontal scroll with snap for swipe */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin snap-x snap-mandatory touch-pan-x">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="min-w-[155px] w-[155px] md:min-w-[170px] md:w-[170px] shrink-0 snap-start">
                  <ProductCardSkeleton />
                </div>
              ))
            : products.map((product, i) => (
                <div key={product.id} className="min-w-[155px] w-[155px] md:min-w-[170px] md:w-[170px] shrink-0 snap-start">
                  <Link to={`/product/${product.slug || product.id}`}>
                    <ProductCard product={product} index={i} />
                  </Link>
                </div>
              ))}
        </div>
      </div>
    </section>
  );
}
