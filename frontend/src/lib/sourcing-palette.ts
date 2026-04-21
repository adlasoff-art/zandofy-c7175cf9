/**
 * Predefined color palette for product sourcing responses.
 * 25 curated nuances admins can pick from when describing a found product.
 * Values are HSL strings so they map directly to Tailwind/inline styles.
 */
export interface SourcingColor {
  key: string;
  label: string;
  hsl: string;
}

export const SOURCING_COLOR_PALETTE: SourcingColor[] = [
  { key: "black", label: "Noir", hsl: "0 0% 8%" },
  { key: "white", label: "Blanc", hsl: "0 0% 98%" },
  { key: "gray", label: "Gris", hsl: "220 9% 60%" },
  { key: "silver", label: "Argent", hsl: "210 16% 82%" },
  { key: "beige", label: "Beige", hsl: "39 33% 80%" },
  { key: "brown", label: "Marron", hsl: "25 35% 35%" },
  { key: "tan", label: "Camel", hsl: "33 50% 55%" },
  { key: "red", label: "Rouge", hsl: "0 75% 50%" },
  { key: "burgundy", label: "Bordeaux", hsl: "350 60% 30%" },
  { key: "pink", label: "Rose", hsl: "340 80% 75%" },
  { key: "fuchsia", label: "Fuchsia", hsl: "320 70% 55%" },
  { key: "purple", label: "Violet", hsl: "270 55% 50%" },
  { key: "lavender", label: "Lavande", hsl: "260 40% 75%" },
  { key: "navy", label: "Bleu marine", hsl: "220 60% 25%" },
  { key: "blue", label: "Bleu", hsl: "215 75% 50%" },
  { key: "sky", label: "Bleu ciel", hsl: "200 80% 70%" },
  { key: "teal", label: "Sarcelle", hsl: "180 55% 40%" },
  { key: "mint", label: "Menthe", hsl: "150 50% 70%" },
  { key: "green", label: "Vert", hsl: "140 50% 40%" },
  { key: "olive", label: "Olive", hsl: "70 30% 35%" },
  { key: "yellow", label: "Jaune", hsl: "50 90% 60%" },
  { key: "gold", label: "Or", hsl: "42 75% 55%" },
  { key: "orange", label: "Orange", hsl: "25 90% 55%" },
  { key: "coral", label: "Corail", hsl: "10 80% 65%" },
  { key: "multicolor", label: "Multicolore", hsl: "0 0% 50%" },
];

export const SOURCING_COLOR_KEYS = SOURCING_COLOR_PALETTE.map((c) => c.key);

export function getSourcingColor(key: string): SourcingColor | undefined {
  return SOURCING_COLOR_PALETTE.find((c) => c.key === key);
}

export const SOURCING_CURRENCIES = ["USD", "EUR", "XAF", "CDF", "NGN", "GBP", "CNY"] as const;
export type SourcingCurrency = (typeof SOURCING_CURRENCIES)[number];