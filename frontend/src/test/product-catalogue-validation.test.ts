import { describe, expect, it } from "vitest";
import {
  countWords,
  deriveSeoKeywords,
  imageCount,
  isVideoMediaUrl,
} from "@/lib/product-catalogue-validation";

describe("product-catalogue-validation", () => {
  it("counts whitespace-split nonempty words", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("  one  two   three ")).toBe(3);
    expect(countWords("quinze mots exactement ici pour le test SEO min")).toBe(9);
  });

  it("counts only image media items", () => {
    expect(
      imageCount(
        [{ type: "image" }, { type: "video" }],
        [{ type: "image" }, { type: "image" }]
      )
    ).toBe(3);
    expect(imageCount([{ type: "video" }], [])).toBe(0);
  });

  it("derives seo keywords filtering short stopwords", () => {
    const kw = deriveSeoKeywords("Robe d été chic pour femmes mode africaine robe");
    expect(kw).toContain("robe");
    expect(kw).toContain("chic");
    expect(kw).not.toMatch(/^de,|,\s*de,|,\s*pour,/);
    expect(kw.split(", ").length).toBeGreaterThanOrEqual(3);
  });

  it("detects video urls by extension", () => {
    expect(isVideoMediaUrl("https://x/a.mp4")).toBe(true);
    expect(isVideoMediaUrl("https://x/a.jpg")).toBe(false);
  });
});
