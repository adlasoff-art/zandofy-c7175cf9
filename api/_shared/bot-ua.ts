/**
 * Shared SEO crawler User-Agent patterns.
 * Keep Vercel rewrite `has.user-agent.value` in sync with BOT_UA_VERCEL_VALUE
 * (vercel.json cannot import TS — copy the string when updating).
 *
 * AI answer engines are included for HTML prerender.
 * Bulk scrapers (CCBot, Bytespider) stay Disallow in robots.txt — do NOT add them here.
 */

/** Tokens matched case-insensitively (used to build RegExp + Vercel string). */
export const SEO_BOT_UA_TOKENS = [
  "googlebot",
  "bingbot",
  "yandex",
  "duckduckbot",
  "baiduspider",
  "slurp",
  "facebookexternalhit",
  "facebot",
  "twitterbot",
  "linkedinbot",
  "whatsapp",
  "telegrambot",
  "discordbot",
  "applebot",
  "pinterest",
  "skypeuripreview",
  "embedly",
  "quora link preview",
  "outbrain",
  "vkshare",
  "w3c_validator",
  "redditbot",
  "tumblr",
  "bitlybot",
  "nuzzel",
  "qwantify",
  "pinterestbot",
  "petalbot",
  "seznambot",
  "ahrefsbot",
  "semrushbot",
  "mj12bot",
  "dotbot",
  // AI search / answers — prerender meta + body
  "gptbot",
  "chatgpt-user",
  "oai-searchbot",
  "claudebot",
  "anthropic",
  "perplexity",
  "google-extended",
] as const;

function escapeRegexToken(token: string): string {
  return token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const UA_ALTERNATION = SEO_BOT_UA_TOKENS.map(escapeRegexToken).join("|");

/** Exact string for Vercel `has` → `user-agent` → `value` (all rewrite blocks). */
export const BOT_UA_VERCEL_VALUE = `(?i).*(${UA_ALTERNATION}).*`;

/** Runtime matcher for meta-injector Edge Function. */
export const BOT_REGEX = new RegExp(`(${UA_ALTERNATION})`, "i");

export function isSeoBot(ua: string | null | undefined): boolean {
  if (!ua) return false;
  return BOT_REGEX.test(ua);
}
