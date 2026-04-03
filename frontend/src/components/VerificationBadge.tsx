import { Trophy } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { computeStoreYears, formatStoreYears } from "@/lib/store-years";

interface VerificationBadgeProps {
  variant: "icon-only" | "full";
  verifiedYears?: number | null;
  storeCreatedAt?: string | null;
}

export function VerificationBadge({ variant, verifiedYears, storeCreatedAt }: VerificationBadgeProps) {
  const years = computeStoreYears(verifiedYears, null, storeCreatedAt);
  const label = formatStoreYears(years);

  if (variant === "icon-only") {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="w-5 h-5 rounded-full bg-certified flex items-center justify-center shrink-0 cursor-default">
              <Trophy size={10} className="text-certified-foreground" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Fournisseur certifié par Zandofy · {label}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="w-6 h-6 rounded-full bg-certified flex items-center justify-center shrink-0">
        <Trophy size={13} className="text-certified-foreground" />
      </div>
      <span className="text-xs font-semibold text-certified">
        Certifié Zandofy · {label}
      </span>
    </div>
  );
}
