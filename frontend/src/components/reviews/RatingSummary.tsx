import { Star, Camera } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";

interface RatingSummaryProps {
  avgRating: number;
  totalReviews: number;
  distribution: Record<number, number>; // star -> count
  activeFilter: "all" | "photos" | number;
  onFilterChange: (filter: "all" | "photos" | number) => void;
}

export function RatingSummary({
  avgRating,
  totalReviews,
  distribution,
  activeFilter,
  onFilterChange,
}: RatingSummaryProps) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-6">
        {/* Average */}
        <div className="flex flex-col items-center justify-center p-4 bg-card border border-border rounded-sm min-w-[120px]">
          <span className="text-4xl font-bold text-foreground">
            {totalReviews > 0 ? avgRating : "—"}
          </span>
          <div className="flex gap-0.5 my-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                size={14}
                className={
                  s <= Math.round(avgRating)
                    ? "fill-accent text-accent"
                    : "text-border"
                }
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">
            {totalReviews} {t("reviews.noReviews")}
          </span>
        </div>

        {/* Breakdown bars */}
        <div className="flex-1 space-y-1.5">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = distribution[star] || 0;
            const pct = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
            return (
              <button
                key={star}
                onClick={() =>
                  onFilterChange(activeFilter === star ? "all" : star)
                }
                className="flex items-center gap-2 w-full text-sm group"
              >
                <span className="w-3 text-muted-foreground">{star}</span>
                <Star size={11} className="fill-accent text-accent" />
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-6 text-xs text-muted-foreground text-right">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "all" as const, label: t("reviews.all") },
          { key: "photos" as const, label: t("reviews.withPhotos") },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => onFilterChange(f.key)}
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
              activeFilter === f.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:border-primary"
            }`}
          >
            {f.key === "photos" && <Camera size={11} className="inline mr-1" />}
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}
