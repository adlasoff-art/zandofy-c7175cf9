import { describe, expect, it } from "vitest";
import {
  DISCOVER_SEED,
  emptyLandingLocale,
  mergeLandingContent,
  sanitizeCmsText,
} from "@/lib/cms-marketing-landings";

describe("cms-marketing-landings", () => {
  const fallback = DISCOVER_SEED.fr;

  it("returns fallback when CMS is null", () => {
    expect(mergeLandingContent(null, fallback)).toEqual(fallback);
  });

  it("keeps fallback for empty CMS strings", () => {
    const merged = mergeLandingContent(
      {
        hero: { title: "", subtitle: "  ", highlight: "CMS" },
        why: { title: "Pourquoi CMS" },
      },
      fallback
    );
    expect(merged.hero.title).toBe(fallback.hero.title);
    expect(merged.hero.subtitle).toBe(fallback.hero.subtitle);
    expect(merged.hero.highlight).toBe("CMS");
    expect(merged.why.title).toBe("Pourquoi CMS");
    expect(merged.why.subtitle).toBe(fallback.why.subtitle);
  });

  it("uses CMS benefit list when non-empty", () => {
    const merged = mergeLandingContent(
      {
        benefits: [{ title: "A", desc: "B" }],
      },
      fallback
    );
    expect(merged.benefits).toEqual([{ title: "A", desc: "B" }]);
  });

  it("merges section toggles", () => {
    const merged = mergeLandingContent(
      { sections: { trust: false, faq: true } },
      emptyLandingLocale({
        sections: { why: true, how: true, trust: true, faq: true, final: true },
      })
    );
    expect(merged.sections.trust).toBe(false);
    expect(merged.sections.faq).toBe(true);
    expect(merged.sections.why).toBe(true);
  });

  it("sanitizes HTML tags from CMS strings", () => {
    expect(sanitizeCmsText("<script>alert(1)</script>Hello")).toBe("alert(1)Hello");
    const merged = mergeLandingContent(
      { hero: { title: "<b>Bold</b> title" } },
      fallback
    );
    expect(merged.hero.title).toBe("Bold title");
  });
});
