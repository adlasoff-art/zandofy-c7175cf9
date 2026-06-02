import { describe, it, expect } from "vitest";
import {
  isDynamicSeoPath,
  resolveRequestPathname,
} from "../../api/meta-injector-path";

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
  });
});
