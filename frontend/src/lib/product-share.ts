import type { ColorOption } from "@/lib/product-pdp";

export type ShareDynamicVariant = {
  typeName: string;
  unit?: string | null;
  options: Array<{ label: string }>;
};

export type SharePaymentNumber = {
  operator: string;
  operator_label: string;
  phone_number: string;
};

/** Operators included in WhatsApp product share (platform defaults). */
export const SHARE_PAYMENT_OPERATORS = ["orange_money", "mpesa", "airtel_money"] as const;

const OPERATOR_EMOJI: Record<string, string> = {
  orange_money: "🟠",
  mpesa: "📱",
  airtel_money: "🔴",
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

/** Prix arrondi pour partage WhatsApp (ex. 6.99 → $7). */
export function formatShareUnitPrice(unitPrice: number, currency = "USD"): string {
  const rounded = Math.round(unitPrice);
  if (currency === "USD") return `$${rounded}`;
  return `${rounded} ${currency}`;
}

export function formatShareWeight(grams: number): string {
  if (grams >= 1000) {
    const kg = grams / 1000;
    const text = Number.isInteger(kg) ? String(kg) : kg.toFixed(1).replace(/\.0$/, "");
    return `${text} kg`;
  }
  return `${Math.round(grams)} g`;
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

export function filterSharePaymentNumbers(numbers: SharePaymentNumber[]): SharePaymentNumber[] {
  const byOp = new Map(
    numbers
      .filter((n) => n.phone_number?.trim())
      .map((n) => [n.operator, { ...n, phone_number: n.phone_number.trim() }]),
  );
  return SHARE_PAYMENT_OPERATORS.map((op) => byOp.get(op)).filter(Boolean) as SharePaymentNumber[];
}

export function buildProductShareMessage(opts: {
  productName: string;
  storeName?: string | null;
  storeUrl?: string | null;
  unitPrice: number;
  currency?: string;
  productUrl: string;
  moq?: number | null;
  colorOptions: ColorOption[];
  apparelSizes: string[];
  dynamicVariants: ShareDynamicVariant[];
  weightGrams?: number | null;
  paymentNumbers?: SharePaymentNumber[];
  chinaWhatsAppNumber?: string | null;
}): string {
  const lines: string[] = [];
  const currency = opts.currency ?? "USD";
  const moq = Math.max(1, Math.round(opts.moq || 1));
  const unitRounded = Math.round(opts.unitPrice);
  const unitLabel = formatShareUnitPrice(opts.unitPrice, currency);
  const moqTotalLabel =
    currency === "USD" ? `$${unitRounded * moq}` : `${unitRounded * moq} ${currency}`;

  lines.push(`👉 *${opts.productName}*`);

  if (opts.storeName?.trim()) {
    lines.push(`🏪 ${opts.storeName.trim()}`);
  }
  if (opts.storeUrl?.trim()) {
    lines.push(`🔗 ${opts.storeUrl.trim()}`);
  }

  lines.push("");
  lines.push(`• *MOQ* : ${moq}`);
  lines.push(`• *1 pièce* : ${unitLabel}`);
  if (moq > 1) {
    lines.push(`• *${moq} pièces* : ${moqTotalLabel}`);
  }

  if (opts.weightGrams && opts.weightGrams > 0) {
    lines.push(`• *Poids 1 pièce* : ${formatShareWeight(opts.weightGrams)}`);
    if (moq > 1) {
      lines.push(`• *Poids MOQ (${moq})* : ${formatShareWeight(opts.weightGrams * moq)}`);
    }
  }

  if (opts.apparelSizes.length > 0) {
    lines.push(`• *taille* : ${opts.apparelSizes.map((s) => s.toLowerCase()).join(", ")}`);
  }

  if (opts.colorOptions.length > 0) {
    const colorLine = opts.colorOptions
      .map((c) => `${colorEmoji(c.hex, c.name)} ${c.name || c.hex}`)
      .join(", ");
    lines.push(`• *couleur* : ${colorLine}`);
  }

  for (const dv of opts.dynamicVariants) {
    const labels = dv.options.map((o) => o.label).filter(Boolean);
    if (labels.length === 0) continue;
    const allNumeric = labels.every((l) => /^\d+$/.test(String(l).trim()));
    const value = allNumeric && labels.length >= 2
      ? formatVariantOptionRange(dv.options)
      : labels.join(", ");
    const name = (dv.typeName || "option").toLowerCase();
    lines.push(`• *${name}* : ${value}`);
  }

  const payments = filterSharePaymentNumbers(opts.paymentNumbers || []);
  if (payments.length > 0) {
    lines.push("");
    lines.push("----------");
    lines.push("");
    lines.push("*Numéro de commandes*");
    for (const p of payments) {
      const emoji = OPERATOR_EMOJI[p.operator] || "📱";
      lines.push(`${emoji} *${p.phone_number}* (${p.operator_label})`);
    }
  }

  lines.push("");
  lines.push(
    "Commander directement sur l’application Zandofy ou sur le site, les prix sont encore plus bas et vous obtenez des points bonus pour chaque commande effectuée",
  );
  lines.push(`👉 ${opts.productUrl}`);

  const china = opts.chinaWhatsAppNumber?.trim();
  if (china) {
    lines.push("");
    lines.push(
      `⚠️ *Envoyez votre commande uniquement sur ce numéro* 👉 *${china}* pour une exécution rapide de votre commande en Chine.`,
    );
  }

  lines.push("");
  lines.push("Merci de faire confiance à Zandofy 😊");

  return lines.join("\n");
}
