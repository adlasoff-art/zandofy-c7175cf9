import { slugify } from "@/utils/slugify";

type CategorySlugInput = {
  name?: string | null;
  name_fr?: string | null;
  nameFr?: string | null;
};

function localizedNames(cat: CategorySlugInput) {
  const fr = cat.name_fr ?? cat.nameFr ?? cat.name ?? "";
  const en = cat.name ?? cat.name_fr ?? cat.nameFr ?? "";
  return { fr, en };
}

/** URL segment for /category/:slug — matches CategoryPage resolver. */
export function categorySlug(cat: CategorySlugInput, locale: "fr" | "en" = "fr"): string {
  const { fr, en } = localizedNames(cat);
  const primary = locale === "fr" ? fr : en;
  const fallback = cat.name ?? cat.name_fr ?? cat.nameFr ?? "";
  return slugify(primary || fallback);
}

export function categoryPath(cat: CategorySlugInput, locale: "fr" | "en" = "fr"): string {
  return `/category/${categorySlug(cat, locale)}`;
}
