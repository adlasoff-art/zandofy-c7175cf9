import { Clock } from "lucide-react";
import { useTimer } from "@/hooks/use-timer";

interface FlashTimerProps {
  productId: string;
  durationHours: number;
  enabled: boolean;
}

export function FlashTimer({ productId, durationHours, enabled }: FlashTimerProps) {
  const { hours, minutes, seconds, isActive, isExpired } = useTimer({
    productId,
    durationHours,
    enabled,
  });

  if (!isActive) return null;

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-sm bg-sale/10 border border-sale/20">
      <Clock size={16} className="text-sale shrink-0" />
      <span className="text-sm font-medium text-foreground">
        La promotion se termine dans
      </span>
      <div className="flex items-center gap-1 font-mono font-bold text-sale">
        <span className="bg-sale text-sale-foreground px-1.5 py-0.5 rounded text-sm">
          {pad(hours)}
        </span>
        <span className="text-sale">:</span>
        <span className="bg-sale text-sale-foreground px-1.5 py-0.5 rounded text-sm">
          {pad(minutes)}
        </span>
        <span className="text-sale">:</span>
        <span className="bg-sale text-sale-foreground px-1.5 py-0.5 rounded text-sm">
          {pad(seconds)}
        </span>
      </div>
    </div>
  );
}
