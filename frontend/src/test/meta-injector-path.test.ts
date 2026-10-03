import { describe, it, expect } from "vitest";
import {
  isDynamicSeoPath,
  resolveRequestPathname,
} from "../../api/meta-injector-path";
import {
  BOT_UA_VERCEL_VALUE,
  isSeoBot,
} from "../../api/_shared/bot-ua";

describe("resolveRequestPathname", () => {
  it("prefers __pathname query from Vercel rewrite", () => {
    const url = new URL(
      "https://zandofy.com/api/meta-injector?__pathname=/product/veste-blazer",
    );
    const req = new Request(url.toString(), {
      headers: { "user-agent": "facebookexternalhit/1.1" },
    });
    expect(resolveRequestPathname(req, url)).toBe("/product/veste-blazer");
  });

  it("falls back to x-vercel-original-path header", () => {
    const url = new URL("https://zandofy.com/api/meta-injector");
    const req = new Request(url.toString(), {
      headers: {
        "x-vercel-original-path": "/product/foo",
        "user-agent": "Googlebot",
      },
    });
    expect(resolveRequestPathname(req, url)).toBe("/product/foo");
  });

  it("uses url.pathname when not meta-injector route", () => {
    const url = new URL("https://zandofy.com/product/bar");
    const req = new Request(url.toString());
    expect(resolveRequestPathname(req, url)).toBe("/product/bar");
  });

  it("returns / for bare meta-injector without pathname hint", () => {
    const url = new URL("https://zandofy.com/api/meta-injector");
    const req = new Request(url.toString());
    expect(resolveRequestPathname(req, url)).toBe("/");
  });
});

describe("isDynamicSeoPath", () => {
  it("matches product store category blog", () => {
    expect(isDynamicSeoPath("/product/x")).toBe(true);
    expect(isDynamicSeoPath("/store/x")).toBe(true);
    expect(isDynamicSeoPath("/category/x")).toBe(true);
    expect(isDynamicSeoPath("/blog/x")).toBe(true);
    expect(isDynamicSeoPath("/faq")).toBe(false);
    expect(isDynamicSeoPath("/")).toBe(false);
  });
});

describe("isSeoBot / AI crawlers", () => {
  it("matches Googlebot and classic social crawlers", () => {
    expect(isSeoBot("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isSeoBot("facebookexternalhit/1.1")).toBe(true);
  });

  it("matches AI answer crawlers for prerender", () => {
    expect(isSeoBot("Mozilla/5.0 AppleWebKit/537.36 (compatible; GPTBot/1.0)")).toBe(true);
    expect(isSeoBot("ClaudeBot/1.0")).toBe(true);
    expect(isSeoBot("PerplexityBot/1.0")).toBe(true);
    expect(isSeoBot("OAI-SearchBot/1.0")).toBe(true);
    expect(isSeoBot("ChatGPT-User/1.0")).toBe(true);
    expect(isSeoBot("Google-Extended")).toBe(true);
  });

  it("does not treat humans or blocked scrapers as SEO bots", () => {
    expect(isSeoBot("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120")).toBe(false);
    expect(isSeoBot(null)).toBe(false);
    // CCBot / Bytespider remain Disallow in robots.txt — not in prerender allowlist
    expect(isSeoBot("CCBot/2.0")).toBe(false);
    expect(isSeoBot("Bytespider")).toBe(false);
  });

  it("exports a Vercel has-value string that includes gptbot", () => {
    expect(BOT_UA_VERCEL_VALUE).toContain("gptbot");
    expect(BOT_UA_VERCEL_VALUE.startsWith("(?i).")).toBe(true);
  });
});

describe("resolveRequestPathname home", () => {
  it("resolves __pathname=/ for homepage bot rewrite", () => {
    const url = new URL("https://www.zandofy.com/api/meta-injector?__pathname=/");
    const req = new Request(url.toString(), {
      headers: { "user-agent": "Googlebot" },
    });
    expect(resolveRequestPathname(req, url)).toBe("/");
  });

  it("resolves help-center hub path", () => {
    const url = new URL(
      "https://www.zandofy.com/api/meta-injector?__pathname=/help-center",
    );
    const req = new Request(url.toString());
    expect(resolveRequestPathname(req, url)).toBe("/help-center");
  });
});
