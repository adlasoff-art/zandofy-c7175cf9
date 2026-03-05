import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QuantitySelectorProps {
  value: number;
  onChange: (qty: number) => void;
  min: number;
  max?: number;
  step?: number;
  hideMoqText?: boolean;
}

export function QuantitySelector({
  value,
  onChange,
  min,
  max = 99999,
  step = 1,
  hideMoqText = false,
}: QuantitySelectorProps) {
  const decrement = () => {
    const next = value - step;
    if (next >= min) onChange(next);
  };

  const increment = () => {
    const next = value + step;
    if (next <= max) onChange(next);
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = parseInt(e.target.value, 10);
    if (isNaN(raw)) return;
    if (raw < min) onChange(min);
    else if (raw > max) onChange(max);
    else onChange(raw);
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="inline-flex items-center border border-border rounded-sm overflow-hidden">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-none border-r border-border shrink-0"
          onClick={decrement}
          disabled={value <= min}
          aria-label="Diminuer la quantité"
        >
          <Minus size={16} />
        </Button>
        <input
          type="number"
          value={value}
          onChange={handleInput}
          className="w-16 h-10 text-center text-sm font-medium bg-background text-foreground outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          min={min}
          max={max}
          aria-label="Quantité"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-none border-l border-border shrink-0"
          onClick={increment}
          disabled={value >= max}
          aria-label="Augmenter la quantité"
        >
          <Plus size={16} />
        </Button>
      </div>
      {!hideMoqText && (
        <p className="text-xs text-muted-foreground">
          Quantité minimale : <span className="font-medium text-foreground">{min} pièce{min > 1 ? "s" : ""}</span>
        </p>
      )}
    </div>
  );
}
