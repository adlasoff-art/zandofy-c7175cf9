import { Trophy, Truck, UserCheck } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type CertificationType = "vendor" | "rider" | "client";

interface CertificationBadgeProps {
  type: CertificationType;
  variant?: "icon-only" | "full";
  className?: string;
}

const CERT_CONFIG: Record<CertificationType, {
  label: string;
  tooltipFr: string;
  icon: React.ElementType;
  bgClass: string;
  textClass: string;
  iconClass: string;
}> = {
  vendor: {
    label: "Vendeur Certifié",
    tooltipFr: "Vendeur certifié par Zandofy",
    icon: Trophy,
    bgClass: "bg-[hsl(var(--cert-vendor))]",
    textClass: "text-[hsl(var(--cert-vendor))]",
    iconClass: "text-[hsl(var(--cert-vendor-foreground))]",
  },
  rider: {
    label: "Livreur Certifié",
    tooltipFr: "Livreur certifié par Zandofy",
    icon: Truck,
    bgClass: "bg-[hsl(var(--cert-rider))]",
    textClass: "text-[hsl(var(--cert-rider))]",
    iconClass: "text-[hsl(var(--cert-rider-foreground))]",
  },
  client: {
    label: "Client Certifié",
    tooltipFr: "Client certifié par Zandofy",
    icon: UserCheck,
    bgClass: "bg-[hsl(var(--cert-client))]",
    textClass: "text-[hsl(var(--cert-client))]",
    iconClass: "text-[hsl(var(--cert-client-foreground))]",
  },
};

export function CertificationBadge({ type, variant = "icon-only", className = "" }: CertificationBadgeProps) {
  const cfg = CERT_CONFIG[type];
  const Icon = cfg.icon;

  if (variant === "icon-only") {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`w-5 h-5 rounded-full ${cfg.bgClass} flex items-center justify-center shrink-0 cursor-default ${className}`}>
              <Icon size={10} className={cfg.iconClass} />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {cfg.tooltipFr}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`w-6 h-6 rounded-full ${cfg.bgClass} flex items-center justify-center shrink-0`}>
        <Icon size={13} className={cfg.iconClass} />
      </div>
      <span className={`text-xs font-semibold ${cfg.textClass}`}>
        {cfg.label}
      </span>
    </div>
  );
}
