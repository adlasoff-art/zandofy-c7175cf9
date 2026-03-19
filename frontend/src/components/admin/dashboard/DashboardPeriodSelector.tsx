import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays } from "lucide-react";

export type PeriodKey = "today" | "7d" | "14d" | "30d" | "3m" | "6m" | "9m" | "1y";

export const PERIOD_OPTIONS: { value: PeriodKey; label: string; days: number }[] = [
  { value: "today", label: "Aujourd'hui", days: 1 },
  { value: "7d", label: "7 jours", days: 7 },
  { value: "14d", label: "14 jours", days: 14 },
  { value: "30d", label: "30 jours", days: 30 },
  { value: "3m", label: "3 mois", days: 90 },
  { value: "6m", label: "6 mois", days: 180 },
  { value: "9m", label: "9 mois", days: 270 },
  { value: "1y", label: "1 an", days: 365 },
];

export function getPeriodDays(period: PeriodKey): number {
  return PERIOD_OPTIONS.find((p) => p.value === period)?.days ?? 30;
}

export function getPeriodDate(period: PeriodKey): Date {
  const d = new Date();
  d.setDate(d.getDate() - getPeriodDays(period));
  d.setHours(0, 0, 0, 0);
  return d;
}

interface Props {
  value: PeriodKey;
  onChange: (v: PeriodKey) => void;
}

export function DashboardPeriodSelector({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <CalendarDays size={16} className="text-muted-foreground" />
      <Select value={value} onValueChange={(v) => onChange(v as PeriodKey)}>
        <SelectTrigger className="w-[160px] h-9 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PERIOD_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
