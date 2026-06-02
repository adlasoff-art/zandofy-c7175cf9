import { describe, it, expect } from "vitest";
import { resolveProductOgImage, toAbsoluteOgImage } from "@/lib/og-image";

describe("toAbsoluteOgImage", () => {
  it("returns absolute URL for Supabase storage path", () => {
    const url = "https://xxx.supabase.co/storage/v1/object/public/products/a.jpg";
    expect(toAbsoluteOgImage(url)).toBe(url);
  });

  it("prefixes site URL for relative paths", () => {
    expect(toAbsoluteOgImage("/images/p.jpg")).toBe("https://zandofy.com/images/p.jpg");
  });

  it("falls back to og-default for empty or placeholder", () => {
    expect(toAbsoluteOgImage("")).toContain("og-default.jpg");
    expect(toAbsoluteOgImage("/placeholder.svg")).toContain("og-default.jpg");
  });
});

describe("resolveProductOgImage", () => {
  it("uses primary gallery URL when present", () => {
    const out = resolveProductOgImage(
      "https://cdn.example.com/featured.jpg",
      "/placeholder.svg",
    );
    expect(out).toBe("https://cdn.example.com/featured.jpg");
  });
});
