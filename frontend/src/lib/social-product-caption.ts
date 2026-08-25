/**
 * Caption builder for Facebook / Instagram product posts.
 * Keep in sync with enqueue_product_social_posts() SQL (migration social_product_posts).
 */

export type SocialPlatform = "facebook" | "instagram";
export type SocialImageMode = "primary" | "all";

export interface SocialCaptionInput {
  title: string;
  slug?: string | null;
  productId: string;
  shortDescription?: string | null;
  currency?: string | null;
  price?: number | null;
  colors?: string[];
  sizes?: string[];
  material?: string | null;
  style?: string | null;
  originCountry?: string | null;
}

const PAYMENT_KEYWORD_RE =
  /\b(momo|orange\s*money|airtel\s*money|mpesa|iban|compte\s*bancaire|mobile\s*money|visa|mastercard)\b[:\s]*\S*/gi;
const LONG_DIGIT_RE = /\b\d{8,}\b/g;

export function sanitizePaymentText(text: string | null | undefined): string {
  if (!text) return "";
  let v = text;
  v = v.replace(PAYMENT_KEYWORD_RE, "");
  v = v.replace(LONG_DIGIT_RE, "");
  v = v.replace(/[ \t]{2,}/g, " ");
  v = v.replace(/\n{3,}/g, "\n\n");
  return v.trim();
}

export function buildProductUrl(slug: string | null | undefined, productId: string): string {
  const path = (slug && slug.trim()) || productId;
  return `https://zandofy.com/product/${path}`;
}

export function buildDetailsBlock(input: SocialCaptionInput): string {
  const parts: string[] = [];
  const colors = (input.colors || []).map((c) => c.trim()).filter(Boolean);
  const sizes = (input.sizes || []).map((s) => s.trim()).filter(Boolean);
  if (colors.length) parts.push(`Couleurs : ${[...new Set(colors)].join(", ")}`);
  if (sizes.length) parts.push(`Tailles : ${[...new Set(sizes)].join(", ")}`);
  if (input.material?.trim()) parts.push(`Matière : ${input.material.trim()}`);
  if (input.style?.trim()) parts.push(`Style : ${input.style.trim()}`);
  if (input.originCountry?.trim()) parts.push(`Origine : ${input.originCountry.trim()}`);
  return sanitizePaymentText(parts.join(" · "));
}

export function buildSocialCaption(platform: SocialPlatform, input: SocialCaptionInput): string {
  const title = (input.title || "Produit Zandofy").trim();
  const url = buildProductUrl(input.slug, input.productId);
  const short = sanitizePaymentText(input.shortDescription);
  const details = buildDetailsBlock(input);
  const currency = (input.currency || "USD").trim() || "USD";
  const price = Number(input.price ?? 0);
  const priceLine = `Prix : ${currency} ${price.toFixed(2)}`;

  if (platform === "facebook") {
    const blocks = [title, url];
    if (short) blocks.push(short);
    if (details) blocks.push(details);
    blocks.push(priceLine);
    return blocks.join("\n\n");
  }

  // Instagram: link last (not clickable in-feed)
  const blocks = [title];
  if (short) blocks.push(short);
  if (details) blocks.push(details);
  blocks.push(priceLine);
  blocks.push(url);
  return blocks.join("\n\n");
}
