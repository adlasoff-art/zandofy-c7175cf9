import {
  Droplets,
  Footprints,
  HardDrive,
  Monitor,
  Weight,
  type LucideIcon,
} from "lucide-react";

const VARIANT_ICON_MAP: Record<string, LucideIcon> = {
  footprints: Footprints,
  droplets: Droplets,
  monitor: Monitor,
  weight: Weight,
  "hard-drive": HardDrive,
};

type Props = {
  icon?: string | null;
  typeName: string;
  unit?: string | null;
  className?: string;
  iconSize?: number;
};

/** Affiche le nom du type de variante (ex. Pointure) avec icône Lucide optionnelle — jamais le slug brut (footprints). */
export function VariantTypeLabel({ icon, typeName, unit, className = "", iconSize = 14 }: Props) {
  const key = icon?.trim().toLowerCase() ?? "";
  const Icon = key ? VARIANT_ICON_MAP[key] : null;

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {Icon ? <Icon size={iconSize} className="shrink-0 text-muted-foreground" aria-hidden /> : null}
      <span>{typeName}</span>
      {unit ? <span className="text-muted-foreground font-normal">({unit})</span> : null}
    </span>
  );
}

/** Titre drawer / panier : icône visuelle remplacée par le libellé humain uniquement dans le texte exporté. */
export function variantTypeTitle(variant: { icon?: string | null; typeName: string; unit?: string | null }) {
  const unitPart = variant.unit ? ` (${variant.unit})` : "";
  return `${variant.typeName}${unitPart}`;
}
