import { describe, expect, it } from "vitest";
import {
  assessProductSeoCoverage,
  countWords,
  deriveSeoKeywords,
  imageCount,
  isVideoMediaUrl,
  photoQuotaMessageFr,
  validatePhotoQuota,
  countProductPhotoUrls,
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

  it("photo quota: min 1 max 5 (ceiling, not exact)", () => {
    expect(validatePhotoQuota(0).ok).toBe(false);
    expect(validatePhotoQuota(0)).toMatchObject({ reason: "too_few" });
    expect(validatePhotoQuota(1).ok).toBe(true);
    expect(validatePhotoQuota(3).ok).toBe(true);
    expect(validatePhotoQuota(5).ok).toBe(true);
    expect(validatePhotoQuota(6).ok).toBe(false);
    expect(validatePhotoQuota(6)).toMatchObject({ reason: "too_many" });
    const few = validatePhotoQuota(0);
    if (!few.ok) {
      expect(photoQuotaMessageFr(few)).toContain("au moins une photo");
    }
    const many = validatePhotoQuota(6);
    if (!many.ok) {
      expect(photoQuotaMessageFr(many)).toContain("jusqu’à 5");
    }
  });

  it("counts product photo urls excluding videos", () => {
    expect(
      countProductPhotoUrls([
        "https://x/a.jpg",
        "https://x/b.mp4",
        "https://x/c.png?v=1",
        null,
        "https://x/d.webm",
      ])
    ).toBe(2);
  });

  it("assesses soft SEO coverage without blocking publish", () => {
    const weak = assessProductSeoCoverage({
      metaTitle: "",
      metaDescription: "court",
      seoKeywords: "",
      shortDescription: "trop court",
    });
    expect(weak.score).toBeLessThan(weak.maxScore);
    expect(weak.warningsFr.length).toBeGreaterThan(0);

    const strong = assessProductSeoCoverage({
      metaTitle: "Robe prix usine Kinshasa",
      metaDescription:
        "Robe élégante import Chine livrée en RDC — description SEO d’au moins cinquante caractères.",
      seoKeywords: "robe, kinshasa, import chine",
      shortDescription:
        "Robe fluide pour femme disponible en plusieurs tailles avec envoi vers Kinshasa et suivi commande",
    });
    expect(strong.score).toBe(strong.maxScore);
    expect(strong.warningsFr).toHaveLength(0);
  });
});
