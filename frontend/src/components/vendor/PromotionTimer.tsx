import { format } from "date-fns";

interface PromotionTimerProps {
  enabled: boolean;
  startDate: string;
  endDate: string;
  onEnabledChange: (v: boolean) => void;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
}

export function PromotionTimer({ enabled, startDate, endDate, onEnabledChange, onStartChange, onEndChange }: PromotionTimerProps) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
        />
        Timer de promotion
      </label>
      {enabled && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Début promo</label>
            <input
              type="datetime-local"
              className="w-full mt-1 px-3 py-2 text-sm bg-card border border-border rounded-md"
              value={startDate}
              onChange={(e) => onStartChange(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Fin promo</label>
            <input
              type="datetime-local"
              className="w-full mt-1 px-3 py-2 text-sm bg-card border border-border rounded-md"
              value={endDate}
              onChange={(e) => onEndChange(e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
