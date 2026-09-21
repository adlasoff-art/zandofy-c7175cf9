/**
 * Discovery feed assembler — CMS ratios + prefs + geo proxy + rotation seed.
 * Local-first (city/country): core excludes intl; explore intl capped; apparel-aware core.
 * @see docs/DISCOVERY_ENGINE.md
 */

import {
  audienceToGenderTargets,
  type DiscoveryPrefs,
  type PurchaseScope,
} from "@/lib/discovery-prefs";

/** Local defaults — keep in sync with DISCOVERY_MIX_DEFAULTS in use-auth-settings. */
export type DiscoveryMixConfig = {
  core_pct: number;
  explore_pct: number;
  neutral_pct: number;
  city_pct: number;
  country_within_core_pct: number;
  rotation_hours: number;
  /**
   * Max share of total feed that may be international when scope is city/country.
   * Clamped 0–25; ignored for any_country. Soft default 10 when absent.
   */
  intl_cap_pct: number;
};

export const DISCOVERY_MIX_FALLBACK: DiscoveryMixConfig = {
  core_pct: 65,
  explore_pct: 25,
  neutral_pct: 10,
  city_pct: 45,
  country_within_core_pct: 20,
  rotation_hours: 12,
  intl_cap_pct: 10,
};

/** Stable empty category tree — avoid `= []` default identity storms in effect deps. */
export const EMPTY_CATEGORY_TREE: CategoryTreeNode[] = [];

export type CategoryTreeNode = {
  id: string;
  parent_id?: string | null;
  apparel_fields_enabled?: boolean | null;
};

export type DiscoveryProductLike = {
  id: string;
  category_id?: string | null;
  categoryId?: string | null;
  gender_target?: string | null;
  genderTarget?: string | null;
  shop_type?: string | null;
  shopType?: string | null;
  origin_country?: string | null;
  originCountry?: string | null;
  store_city_id?: string | null;
  storeCityId?: string | null;
  store_city?: string | null;
  storeCity?: string | null;
  rating?: number | null;
};

export type AssembleDiscoveryOptions = {
  prefs: DiscoveryPrefs | null;
  mix?: Partial<DiscoveryMixConfig> | null;
  take?: number;
  /** Expanded interest set (roots + descendants). */
  interestCategoryIds?: string[];
  /**
   * Expanded apparel category ids (flag true + descendants).
   * When empty/absent, treat all categories as apparel-strict for core gender.
   */
  apparelCategoryIds?: string[] | Set<string>;
  surface?: string;
  seedKey?: string;
  nowMs?: number;
};

function catId(p: DiscoveryProductLike) {
  return p.category_id || p.categoryId || null;
}
function genderOf(p: DiscoveryProductLike) {
  return (p.gender_target || p.genderTarget || "").toLowerCase();
}
function shopTypeOf(p: DiscoveryProductLike) {
  return (p.shop_type || p.shopType || "").toLowerCase();
}
function originOf(p: DiscoveryProductLike) {
  return (p.origin_country || p.originCountry || "").toUpperCase();
}
function storeCityIdOf(p: DiscoveryProductLike) {
  return p.store_city_id || p.storeCityId || null;
}
function sameCity(p: DiscoveryProductLike, cityId: string | null) {
  if (!cityId) return false;
  const id = storeCityIdOf(p);
  return !!id && id === cityId;
}

/** Simple string hash → uint32 for seeded shuffle. */
export function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rotationBucket(rotationHours: number, nowMs = Date.now()): number {
  const ms = Math.max(1, rotationHours) * 60 * 60 * 1000;
  return Math.floor(nowMs / ms);
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  let s = seed || 1;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function isNeutralGender(g: string) {
  return !g || g === "unisex";
}

function matchesAudienceCore(p: DiscoveryProductLike, audience: DiscoveryPrefs["audience"]): boolean {
  const g = genderOf(p);
  if (isNeutralGender(g)) return false;
  if (!audience || audience === "any") return true;
  if (audience === "both") {
    return ["male", "homme", "female", "femme"].includes(g);
  }
  const targets = new Set(audienceToGenderTargets(audience).map((x) => x.toLowerCase()));
  return targets.has(g);
}

function isOppositeAudience(p: DiscoveryProductLike, audience: DiscoveryPrefs["audience"]): boolean {
  if (audience === "male") {
    const g = genderOf(p);
    return g === "female" || g === "femme";
  }
  if (audience === "female") {
    const g = genderOf(p);
    return g === "male" || g === "homme";
  }
  return false;
}

function isLocalShop(p: DiscoveryProductLike) {
  return shopTypeOf(p) === "local";
}

function isIntlShop(p: DiscoveryProductLike) {
  return shopTypeOf(p) === "international";
}

function sameCountry(p: DiscoveryProductLike, country: string | null) {
  if (!country) return isLocalShop(p);
  const o = originOf(p);
  if (!o) return isLocalShop(p);
  return o === country.toUpperCase();
}

/** International shop OR foreign origin — used for feed-wide intl_cap accounting. */
function isIntlLike(p: DiscoveryProductLike, country: string | null) {
  if (isIntlShop(p)) return true;
  if (country && originOf(p) && originOf(p) !== country.toUpperCase()) return true;
  return false;
}

function clampIntlCap(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return DISCOVERY_MIX_FALLBACK.intl_cap_pct;
  return Math.min(25, Math.max(0, Math.round(v)));
}

function pick<T extends { id: string }>(pool: T[], n: number, exclude: Set<string>): T[] {
  const out: T[] = [];
  for (const p of pool) {
    if (out.length >= n) break;
    if (exclude.has(p.id)) continue;
    out.push(p);
    exclude.add(p.id);
  }
  return out;
}

function countsForTake(take: number, mix: DiscoveryMixConfig, scope: PurchaseScope | null) {
  const core = Math.max(0, Math.round((take * mix.core_pct) / 100));
  const explore = Math.max(0, Math.round((take * mix.explore_pct) / 100));
  let neutral = take - core - explore;
  if (neutral < 0) neutral = 0;

  if (scope === "city") {
    const city = Math.round((take * mix.city_pct) / 100);
    const country = Math.max(0, Math.round((take * mix.country_within_core_pct) / 100));
    const cityAdj = Math.min(city, core);
    const countryAdj = Math.min(country, Math.max(0, core - cityAdj));
    return {
      core,
      explore,
      neutral,
      city: cityAdj,
      country: countryAdj,
      restCore: Math.max(0, core - cityAdj - countryAdj),
    };
  }
  return { core, explore, neutral, city: 0, country: 0, restCore: core };
}

/**
 * Apparel category ids = nodes with apparel_fields_enabled + all descendants.
 */
export function expandApparelCategoryIds(categories: CategoryTreeNode[]): string[] {
  const roots = categories.filter((c) => c.apparel_fields_enabled === true).map((c) => c.id);
  if (!roots.length) return [];
  return expandInterestCategoryIds(roots, categories);
}

function toIdSet(ids: string[] | Set<string> | undefined): Set<string> {
  if (!ids) return new Set();
  return ids instanceof Set ? ids : new Set(ids);
}

/**
 * Assemble a discovery-ranked slice.
 * Requires completed_at — callers gate on hasCompleted.
 */
export function assembleDiscoveryFeed<T extends DiscoveryProductLike>(
  products: T[],
  opts: AssembleDiscoveryOptions,
): T[] {
  const take = opts.take ?? 24;
  if (!products.length) return [];

  const prefs = opts.prefs;
  // Only personalize after a finished onboarding — avoids partial junk prefs reshaping the catalogue
  if (!prefs?.completed_at) {
    return products.slice(0, take);
  }

  const mixRaw: DiscoveryMixConfig = { ...DISCOVERY_MIX_FALLBACK, ...(opts.mix || {}) };
  const mix: DiscoveryMixConfig = {
    ...mixRaw,
    intl_cap_pct: clampIntlCap(mixRaw.intl_cap_pct),
  };
  const interestIds = opts.interestCategoryIds?.length
    ? opts.interestCategoryIds
    : prefs.interest_category_ids || [];
  const interestSet = new Set(interestIds);
  const apparelSet = toIdSet(opts.apparelCategoryIds);
  /** When tree not loaded yet, keep legacy strict gender core (safer than opening all unisex). */
  const apparelKnown = apparelSet.size > 0;
  const country = prefs.country_code;
  const cityId = prefs.city_id;
  const scope = prefs.purchase_scope;
  const audience = prefs.audience;
  const localScoped = scope === "city" || scope === "country";

  const seed = hashSeed(
    `${opts.seedKey || "guest"}|${rotationBucket(mix.rotation_hours, opts.nowMs)}|${opts.surface || "default"}`,
  );
  const shuffled = seededShuffle(products, seed);

  const inInterest = (p: T) => {
    const id = catId(p);
    return interestSet.size === 0 ? true : !!id && interestSet.has(id);
  };

  const isApparel = (p: T) => {
    if (!apparelKnown) return true;
    const id = catId(p);
    // Unknown / missing category → apparel-strict (never open unisex core by accident)
    if (!id) return true;
    return apparelSet.has(id);
  };

  /** Core eligibility: apparel → strict audience; non-apparel interest → OK even unisex. */
  const eligibleCore = (p: T) => {
    if (!inInterest(p)) return false;
    if (isApparel(p)) return matchesAudienceCore(p, audience);
    return true;
  };

  const coreAudience = (p: T) => matchesAudienceCore(p, audience);
  const isNeutral = (p: T) => isNeutralGender(genderOf(p));
  const isLocalMarket = (p: T) => isLocalShop(p) && sameCountry(p, country);

  const localSame = shuffled.filter((p) => isLocalMarket(p));
  const trueCity = cityId ? localSame.filter((p) => sameCity(p, cityId)) : [];
  const trueCityA = seededShuffle(trueCity, seed ^ 0xa5a5);
  const localSameA = seededShuffle(localSame, seed ^ 0xa5a5);
  const mid = Math.ceil(localSameA.length / 2);
  const cityProxy = trueCityA.length > 0 ? trueCityA : localSameA.slice(0, mid);
  const countryProxy =
    trueCityA.length > 0
      ? localSameA.filter((p) => !sameCity(p, cityId))
      : localSameA.slice(mid);

  const corePoolBase = shuffled.filter((p) => eligibleCore(p));
  const coreLocalInterest = corePoolBase.filter((p) => isLocalMarket(p));
  const coreAnyInterest = corePoolBase;

  // Soft core: audience match without interest (apparel-style gender fill only)
  const coreAudienceOnly = shuffled.filter((p) => coreAudience(p) && !inInterest(p));

  // Transverse: non-apparel outside interests (Maison/Auto/…)
  const transverseLocal = seededShuffle(
    shuffled.filter((p) => {
      if (!isLocalMarket(p)) return false;
      if (inInterest(p)) return false;
      if (apparelKnown && isApparel(p)) return false;
      if (isOppositeAudience(p, audience)) return false;
      return true;
    }),
    seed ^ 0x9abc,
  );

  // Explore local: out-of-interest / transverse, never opposite H/F when audience is male/female
  const exploreLocal = seededShuffle(
    shuffled.filter((p) => {
      if (!isLocalMarket(p)) return false;
      if (isOppositeAudience(p, audience)) return false;
      if (!inInterest(p) && coreAudience(p)) return true;
      if (apparelKnown && !isApparel(p) && !inInterest(p)) return true;
      return false;
    }),
    seed ^ 0x1234,
  );

  const exploreIntl = seededShuffle(
    shuffled.filter((p) => {
      if (isOppositeAudience(p, audience)) return false;
      return isIntlLike(p, country);
    }),
    seed ^ 0x2345,
  );

  // Legacy open explore when any_country (no intl cap) — still no opposite gender
  const exploreOpen = seededShuffle(
    shuffled.filter((p) => {
      if (isNeutral(p)) return false;
      if (isOppositeAudience(p, audience)) return false;
      if (isIntlLike(p, country)) return true;
      if (!inInterest(p) && coreAudience(p)) return true;
      if (apparelKnown && !isApparel(p) && !inInterest(p)) return true;
      return false;
    }),
    seed ^ 0x1234,
  );

  // Neutral: unisex/empty + soft transverse. Local-scoped: keep intl out of the primary pool
  // so C cannot silently blow intl_cap (intl unisex only via capped fill below).
  const neutralLocal = seededShuffle(
    [
      ...shuffled.filter((p) => isNeutral(p) && !isIntlLike(p, country)),
      ...transverseLocal.filter((p) => !isNeutral(p)),
    ],
    seed ^ 0x5678,
  );
  const neutralIntl = seededShuffle(
    shuffled.filter((p) => isNeutral(p) && isIntlLike(p, country) && !isOppositeAudience(p, audience)),
    seed ^ 0x5679,
  );
  const neutralPool = localScoped ? neutralLocal : seededShuffle([...neutralLocal, ...neutralIntl], seed ^ 0x5678);

  const { explore: nExplore, neutral: nNeutral, city: nCity, country: nCountry, restCore, core: nCore } =
    countsForTake(take, mix, scope);

  const intlCapSlots = localScoped
    ? Math.min(nExplore + nNeutral, Math.round((take * mix.intl_cap_pct) / 100))
    : take;

  const taken = new Set<string>();
  const result: T[] = [];

  const pushFrom = (pool: T[], n: number) => {
    if (n <= 0) return;
    result.push(...pick(pool, n, taken));
  };

  const intlUsed = () => result.filter((p) => isIntlLike(p, country)).length;
  const intlRemaining = () => (localScoped ? Math.max(0, intlCapSlots - intlUsed()) : take);
  const pushIntlCapped = (pool: T[], n: number) => {
    if (n <= 0) return;
    pushFrom(pool, Math.min(n, intlRemaining()));
  };

  if (scope === "city") {
    const cityCore = cityProxy.filter((p) => eligibleCore(p));
    const countryCore = countryProxy.filter((p) => eligibleCore(p));
    pushFrom(cityCore, nCity);
    if (result.length < nCity) {
      pushFrom(
        cityProxy.filter((p) => coreAudience(p) || (apparelKnown && !isApparel(p) && inInterest(p))),
        nCity - result.length,
      );
    }
    const afterCity = result.length;
    pushFrom(countryCore, nCountry);
    if (result.length < afterCity + nCountry) {
      pushFrom(
        countryProxy.filter((p) => coreAudience(p) || (apparelKnown && !isApparel(p) && inInterest(p))),
        afterCity + nCountry - result.length,
      );
    }
    pushFrom(coreLocalInterest, restCore);
    // Local-only core fill — never inject intl into heart when scoped
    const needCore = nCore - result.length;
    if (needCore > 0) {
      pushFrom(
        coreAudienceOnly.filter((p) => isLocalMarket(p)),
        needCore,
      );
    }
    if (result.length < nCore) {
      // Soft local fill: gendered audience OR known non-apparel (not unknown/uncategorized)
      pushFrom(
        localSame.filter(
          (p) => coreAudience(p) || (apparelKnown && !isApparel(p)),
        ),
        nCore - result.length,
      );
    }
  } else if (scope === "country") {
    pushFrom(coreLocalInterest.length ? coreLocalInterest : coreAnyInterest.filter(isLocalMarket), nCore);
    if (result.length < nCore) {
      pushFrom(
        coreAudienceOnly.filter((p) => isLocalMarket(p)),
        nCore - result.length,
      );
    }
    if (result.length < nCore) {
      pushFrom(
        localSame.filter(
          (p) => coreAudience(p) || (apparelKnown && !isApparel(p)),
        ),
        nCore - result.length,
      );
    }
  } else {
    const boosted = [
      ...coreAnyInterest.filter((p) => sameCountry(p, country)),
      ...coreAnyInterest.filter((p) => !sameCountry(p, country)),
    ];
    pushFrom(boosted.length ? boosted : coreAnyInterest, nCore);
    if (result.length < nCore) pushFrom(coreAudienceOnly, nCore - result.length);
  }

  // Explore: local first, then intl up to remaining cap (local scope) / open explore (any_country)
  if (localScoped) {
    const beforeExplore = result.length;
    pushFrom(exploreLocal, nExplore);
    pushFrom(transverseLocal, nExplore - (result.length - beforeExplore));
    const localExploreUsed = result.length - beforeExplore;
    pushIntlCapped(exploreIntl, Math.max(0, nExplore - localExploreUsed));
  } else {
    pushFrom(exploreOpen, nExplore);
  }

  // Neutral: local first; intl unisex only within remaining intl_cap
  pushFrom(neutralPool, nNeutral);
  if (localScoped && result.length < nCore + nExplore + nNeutral) {
    const needNeutral = nCore + nExplore + nNeutral - result.length;
    pushIntlCapped(neutralIntl, needNeutral);
  }

  // Strict backfill: local-first when scoped; never dump opposite-gender or uncapped intl
  if (result.length < take) {
    if (localScoped) {
      pushFrom(coreLocalInterest, take - result.length);
      if (result.length < take) pushFrom(exploreLocal, take - result.length);
      if (result.length < take) pushFrom(neutralLocal, take - result.length);
      if (result.length < take) {
        const safeLocal = localSame.filter((p) => !isOppositeAudience(p, audience));
        pushFrom(safeLocal, take - result.length);
      }
      if (result.length < take) pushIntlCapped(exploreIntl, take - result.length);
      if (result.length < take) pushIntlCapped(neutralIntl, take - result.length);
    } else {
      if (result.length < take) pushFrom(coreAnyInterest, take - result.length);
      if (result.length < take) pushFrom(coreAudienceOnly, take - result.length);
      if (result.length < take) pushFrom(exploreOpen, take - result.length);
      if (result.length < take) pushFrom(neutralPool, take - result.length);
    }
  }

  if (result.length < take) {
    if (localScoped) {
      // Exhaust local catalogue before any uncapped residual
      const safeLocal = shuffled.filter(
        (p) => !isOppositeAudience(p, audience) && !isIntlLike(p, country),
      );
      pushFrom(safeLocal, take - result.length);
      if (result.length < take) {
        const safeIntl = shuffled.filter(
          (p) => !isOppositeAudience(p, audience) && isIntlLike(p, country),
        );
        pushIntlCapped(safeIntl, take - result.length);
      }
    } else {
      const safe = shuffled.filter((p) => !isOppositeAudience(p, audience));
      pushFrom(safe, take - result.length);
    }
  }
  if (result.length < take && (audience === "both" || audience === "any" || !audience)) {
    if (localScoped) {
      const localRest = shuffled.filter((p) => !isIntlLike(p, country));
      pushFrom(localRest, take - result.length);
      if (result.length < take) pushIntlCapped(shuffled, take - result.length);
    } else {
      pushFrom(shuffled, take - result.length);
    }
  }

  return result.slice(0, take);
}

/** Expand root category ids with descendants given parent_id map. */
export function expandInterestCategoryIds(
  rootIds: string[],
  categories: { id: string; parent_id?: string | null }[],
): string[] {
  if (!rootIds.length) return [];
  const children = new Map<string | null, string[]>();
  for (const c of categories) {
    const p = c.parent_id ?? null;
    if (!children.has(p)) children.set(p, []);
    children.get(p)!.push(c.id);
  }
  const out = new Set<string>(rootIds);
  const stack = [...rootIds];
  while (stack.length) {
    const id = stack.pop()!;
    for (const child of children.get(id) || []) {
      if (!out.has(child)) {
        out.add(child);
        stack.push(child);
      }
    }
  }
  return [...out];
}

/** Thin wrapper for call sites still using the old name. */
export function rankProductsByDiscoveryPrefs<T extends DiscoveryProductLike>(
  products: T[],
  prefs: DiscoveryPrefs | null,
  take = 24,
): T[] {
  return assembleDiscoveryFeed(products, { prefs, take, surface: "legacy_rank" });
}
