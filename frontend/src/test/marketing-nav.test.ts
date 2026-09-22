import { describe, expect, it } from "vitest";
import {
  buildMarketingNavLinks,
  cmsUrlToRouterHref,
  injectMarketingNav,
  normalizeNavHref,
} from "@/lib/marketing-nav";

describe("marketing-nav", () => {
  const marketing = buildMarketingNavLinks({
    discover: "Découvrir Zandofy",
    becomeVendor: "Devenir vendeur",
  });

  it("normalizes absolute CMS URLs to pathname", () => {
    expect(normalizeNavHref("https://www.zandofy.com/stores/")).toBe("/stores");
    expect(normalizeNavHref("/discover?x=1#y")).toBe("/discover");
    expect(cmsUrlToRouterHref("https://www.zandofy.com/stores")).toBe("/stores");
    expect(cmsUrlToRouterHref("javascript:alert(1)")).toBe("#");
  });

  it("inserts before /stores and dedupes", () => {
    const links = [
      { label: "Catégories", href: "#", hasMega: true, highlight: false },
      { label: "Nouveautés", href: "/category/nouveautes", hasMega: false, highlight: false },
      { label: "Découvrir Zandofy", href: "/discover", hasMega: false, highlight: false },
      { label: "Fournisseurs fiables", href: "/stores", hasMega: false, highlight: false },
      { label: "Électronique", href: "/category/electronics", hasMega: false, highlight: false },
    ];
    const out = injectMarketingNav(links, marketing);
    const hrefs = out.map((l) => l.href);
    expect(hrefs.filter((h) => h === "/discover")).toHaveLength(1);
    expect(hrefs.filter((h) => h === "/become-vendor")).toHaveLength(1);
    expect(hrefs.indexOf("/discover")).toBeLessThan(hrefs.indexOf("/stores"));
    expect(hrefs.indexOf("/become-vendor")).toBeLessThan(hrefs.indexOf("/stores"));
  });

  it("dedupes absolute CMS marketing URLs against relative inject", () => {
    const links = [
      { label: "Catégories", href: "#", hasMega: true, highlight: false },
      {
        label: "Découvrir",
        href: "https://www.zandofy.com/discover",
        hasMega: false,
        highlight: false,
      },
      { label: "Fournisseurs", href: "https://www.zandofy.com/stores", hasMega: false, highlight: false },
    ];
    const out = injectMarketingNav(links, marketing);
    const paths = out.map((l) => normalizeNavHref(l.href));
    expect(paths.filter((p) => p === "/discover")).toHaveLength(1);
    expect(paths.filter((p) => p === "/become-vendor")).toHaveLength(1);
    expect(paths.indexOf("/discover")).toBeLessThan(paths.indexOf("/stores"));
  });

  it("falls back after Soldes when no stores link", () => {
    const links = [
      { label: "Catégories", href: "#", hasMega: true, highlight: false },
      { label: "Soldes", href: "/category/soldes", hasMega: false, highlight: true },
      { label: "Maison", href: "/category/home", hasMega: false, highlight: false },
    ];
    const out = injectMarketingNav(links, marketing);
    expect(out.map((l) => l.href)).toEqual([
      "#",
      "/category/soldes",
      "/discover",
      "/become-vendor",
      "/category/home",
    ]);
  });

  it("does not treat Sales analytics as Soldes anchor", () => {
    const links = [
      { label: "Catégories", href: "#", hasMega: true, highlight: false },
      { label: "Sales analytics", href: "/admin/sales", hasMega: false, highlight: false },
      { label: "Maison", href: "/category/home", hasMega: false, highlight: false },
    ];
    const out = injectMarketingNav(links, marketing);
    // No Soldes/stores → insert after first (Catégories)
    expect(out.map((l) => l.href)).toEqual([
      "#",
      "/discover",
      "/become-vendor",
      "/admin/sales",
      "/category/home",
    ]);
  });
});
