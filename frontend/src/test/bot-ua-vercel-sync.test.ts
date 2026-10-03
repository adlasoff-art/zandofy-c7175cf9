/**
 * Sync check helper (used by vitest). Reconstructs Vercel UA value from tokens.
 * Keep vercel.json rewrites identical to BOT_UA_VERCEL_VALUE.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BOT_UA_VERCEL_VALUE, isSeoBot } from "../../api/_shared/bot-ua";

function collectUaValues(vercelPath: string): string[] {
  const json = JSON.parse(readFileSync(vercelPath, "utf8")) as {
    rewrites?: Array<{ has?: Array<{ key?: string; value?: string }> }>;
  };
  return (json.rewrites || [])
    .flatMap((r) => r.has || [])
    .filter((h) => h.key === "user-agent" && typeof h.value === "string")
    .map((h) => h.value as string);
}

describe("bot-ua vercel sync", () => {
  it("root vercel.json user-agent values match BOT_UA_VERCEL_VALUE", () => {
    const path = resolve(__dirname, "../../../vercel.json");
    const values = collectUaValues(path);
    expect(values.length).toBeGreaterThan(0);
    for (const v of values) {
      expect(v).toBe(BOT_UA_VERCEL_VALUE);
    }
  });

  it("frontend vercel.json user-agent values match BOT_UA_VERCEL_VALUE", () => {
    const path = resolve(__dirname, "../../vercel.json");
    const values = collectUaValues(path);
    expect(values.length).toBeGreaterThan(0);
    for (const v of values) {
      expect(v).toBe(BOT_UA_VERCEL_VALUE);
    }
  });

  it("still recognizes GPTBot after regex escaping", () => {
    expect(isSeoBot("GPTBot/1.0")).toBe(true);
    expect(isSeoBot("ChatGPT-User/1.0")).toBe(true);
  });
});
