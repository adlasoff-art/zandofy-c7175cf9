import { Trophy } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface VerificationBadgeProps {
  variant: "icon-only" | "full";
  verifiedYears?: number;
}

export function VerificationBadge({ variant, verifiedYears }: VerificationBadgeProps) {
  if (!verifiedYears || verifiedYears <= 0) return null;

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
            Fournisseur certifié par Zandofy
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
        Certifié Zandofy · Vérifié {verifiedYears} ans
      </span>
    </div>
  );
}
