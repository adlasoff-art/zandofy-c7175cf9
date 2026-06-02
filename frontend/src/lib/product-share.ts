import type { ColorOption } from "@/lib/product-pdp";

export type ShareDynamicVariant = {
  typeName: string;
  unit?: string | null;
  options: Array<{ label: string }>;
};

const COLOR_EMOJI_BY_KEY: Record<string, string> = {
  black: "⚫",
  noir: "⚫",
  white: "⚪",
  blanc: "⚪",
  red: "🔴",
  rouge: "🔴",
  blue: "🔵",
  bleu: "🔵",
  green: "🟢",
  vert: "🟢",
  yellow: "🟡",
  jaune: "🟡",
  pink: "🩷",
  rose: "🩷",
  orange: "🟠",
  purple: "🟣",
  violet: "🟣",
  brown: "🟤",
  marron: "🟤",
  beige: "🟤",
  grey: "⚪",
  gray: "⚪",
  gris: "⚪",
};

function colorEmoji(hex: string, name: string): string {
  const n = name.trim().toLowerCase();
  if (COLOR_EMOJI_BY_KEY[n]) return COLOR_EMOJI_BY_KEY[n];
  const h = hex.replace("#", "").toLowerCase();
  if (h === "000000" || h === "000") return "⚫";
  if (h === "ffffff" || h === "fff") return "⚪";
  return "🎨";
}

/** Prix arrondi pour partage WhatsApp (ex. 12.9 → 13 $). */
export function formatShareUnitPrice(unitPrice: number, currency = "USD"): string {
  const rounded = Math.round(unitPrice);
  if (currency === "USD") return `$${rounded}`;
  return `${rounded} ${currency}`;
}

/** Plage min–max pour pointures / tailles numériques (ex. 36-46). */
export function formatVariantOptionRange(options: Array<{ label: string }>): string {
  if (options.length === 0) return "";
  const nums = options
    .map((o) => {
      const m = String(o.label).match(/\d+/);
      return m ? parseInt(m[0], 10) : NaN;
    })
    .filter((n) => !Number.isNaN(n))
    .sort((a, b) => a - b);

  if (nums.length >= 2) return `${nums[0]}-${nums[nums.length - 1]}`;
  if (nums.length === 1) return String(nums[0]);
  if (options.length >= 2) return `${options[0].label}-${options[options.length - 1].label}`;
  return options.map((o) => o.label).join(", ");
}

export function buildProductShareMessage(opts: {
  productName: string;
  storeName?: string | null;
  unitPrice: number;
  currency?: string;
  productUrl: string;
  colorOptions: ColorOption[];
  apparelSizes: string[];
  dynamicVariants: ShareDynamicVariant[];
  weightGrams?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
}): string {
  const lines: string[] = [];

  lines.push(`🛍️ *${opts.productName}*`);

  if (opts.storeName?.trim()) {
    lines.push(`🏪 ${opts.storeName.trim()}`);
  }

  lines.push(`💰 ${formatShareUnitPrice(opts.unitPrice, opts.currency ?? "USD")}`);

  if (opts.colorOptions.length > 0) {
    const colorLine = opts.colorOptions
      .map((c) => `${colorEmoji(c.hex, c.name)} ${c.name || c.hex}`)
      .join("  ");
    lines.push(`🎨 Couleurs : ${colorLine}`);
  }

  if (opts.apparelSizes.length > 0) {
    lines.push(`📏 Tailles : ${opts.apparelSizes.join(", ")}`);
  }

  for (const dv of opts.dynamicVariants) {
    const range = formatVariantOptionRange(dv.options);
    if (!range) continue;
    const label = dv.unit ? `${dv.typeName} (${dv.unit})` : dv.typeName;
    const icon = /pointure/i.test(dv.typeName) ? "👟" : "📐";
    lines.push(`${icon} ${label} : ${range}`);
  }

  const dims: string[] = [];
  if (opts.weightGrams && opts.weightGrams > 0) {
    dims.push(
      opts.weightGrams >= 1000
        ? `Poids ${(opts.weightGrams / 1000).toFixed(1)} kg`
        : `Poids ${opts.weightGrams} g`,
    );
  }
  if (opts.lengthCm) dims.push(`L ${opts.lengthCm} cm`);
  if (opts.widthCm) dims.push(`l ${opts.widthCm} cm`);
  if (opts.heightCm) dims.push(`H ${opts.heightCm} cm`);
  if (dims.length > 0) {
    lines.push(`📦 ${dims.join(" · ")}`);
  }

  lines.push("");
  lines.push(opts.productUrl);

  return lines.join("\n");
}
