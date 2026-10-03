/**
 * Regenerate BOT_UA_VERCEL_VALUE into both vercel.json files.
 * Run from repo root: node scripts/sync-bot-ua-vercel.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const botUaPath = join(root, "frontend/api/_shared/bot-ua.ts");
const src = readFileSync(botUaPath, "utf8");

const tokensMatch = src.match(/SEO_BOT_UA_TOKENS = \[([\s\S]*?)\] as const/);
if (!tokensMatch) {
  console.error("Could not parse SEO_BOT_UA_TOKENS");
  process.exit(1);
}

const tokens = [...tokensMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
const escapeRegexToken = (token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const value = `(?i).*(${tokens.map(escapeRegexToken).join("|")}).*`;

function patchVercel(path) {
  const json = JSON.parse(readFileSync(path, "utf8"));
  let n = 0;
  for (const rule of json.rewrites || []) {
    for (const h of rule.has || []) {
      if (h.key === "user-agent") {
        h.value = value;
        n++;
      }
    }
  }
  writeFileSync(path, JSON.stringify(json, null, 2) + "\n", "utf8");
  console.log(`patched ${n} UA rules in ${path}`);
}

patchVercel(join(root, "vercel.json"));
patchVercel(join(root, "frontend/vercel.json"));
console.log("BOT_UA_VERCEL_VALUE length", value.length);
