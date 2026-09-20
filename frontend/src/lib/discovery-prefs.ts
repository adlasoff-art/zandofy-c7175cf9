/**
 * Discovery onboarding preferences — guest (localStorage) + authenticated (profiles.discovery_prefs).
 * Maps purchase_scope → HomeMarket; audience → gender_target ranking.
 */

export const DISCOVERY_PREFS_KEY = "zandofy_discovery_prefs";
export const DISCOVERY_SNOOZE_KEY = "zandofy_discovery_onboarding_snoozed";
export const DISCOVERY_PREFS_VERSION = 1;
export const DISCOVERY_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

export type ShoppingAudience = "male" | "female" | "both" | "any";
export type PurchaseScope = "city" | "country" | "any_country";
export type ReceiptMode = "home_delivery" | "pickup";
export type PaymentPref = "mobile_money" | "card" | "off_platform" | "later";

export type DiscoveryPrefs = {
  version: number;
  audience: ShoppingAudience | null;
  interest_category_ids: string[];
  purchase_scope: PurchaseScope | null;
  receipt_mode: ReceiptMode | null;
  payment_prefs: PaymentPref[];
  country_code: string | null;
  completed_at: string | null;
  skipped_at: string | null;
  updated_at: string;
};

export type DiscoveryOnboardingStepsConfig = {
  /** Show payment step (default true). */
  payment?: boolean;
  /** Show receipt step when purchase_scope is city/country (default true). */
  receipt?: boolean;
};

export function emptyDiscoveryPrefs(): DiscoveryPrefs {
  return {
    version: DISCOVERY_PREFS_VERSION,
    audience: null,
    interest_category_ids: [],
    purchase_scope: null,
    receipt_mode: null,
    payment_prefs: [],
    country_code: null,
    completed_at: null,
    skipped_at: null,
    updated_at: new Date().toISOString(),
  };
}

export function normalizeDiscoveryPrefs(raw: unknown): DiscoveryPrefs {
  const base = emptyDiscoveryPrefs();
  if (!raw || typeof raw !== "object") return base;
  const v = raw as Partial<DiscoveryPrefs>;
  return {
    version: typeof v.version === "number" ? v.version : DISCOVERY_PREFS_VERSION,
    audience: (["male", "female", "both", "any"] as const).includes(v.audience as ShoppingAudience)
      ? (v.audience as ShoppingAudience)
      : null,
    interest_category_ids: Array.isArray(v.interest_category_ids)
      ? v.interest_category_ids
          .filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 64)
          .slice(0, 5)
      : [],
    purchase_scope: (["city", "country", "any_country"] as const).includes(v.purchase_scope as PurchaseScope)
      ? (v.purchase_scope as PurchaseScope)
      : null,
    receipt_mode: v.receipt_mode === "home_delivery" || v.receipt_mode === "pickup" ? v.receipt_mode : null,
    payment_prefs: Array.isArray(v.payment_prefs)
      ? v.payment_prefs.filter((p): p is PaymentPref =>
          ["mobile_money", "card", "off_platform", "later"].includes(p as string),
        )
      : [],
    country_code: typeof v.country_code === "string" && v.country_code.length === 2 ? v.country_code.toUpperCase() : null,
    completed_at: typeof v.completed_at === "string" ? v.completed_at : null,
    skipped_at: typeof v.skipped_at === "string" ? v.skipped_at : null,
    updated_at: typeof v.updated_at === "string" ? v.updated_at : new Date().toISOString(),
  };
}

export function readDiscoveryPrefsFromStorage(): DiscoveryPrefs | null {
  try {
    const raw = localStorage.getItem(DISCOVERY_PREFS_KEY);
    if (!raw) return null;
    return normalizeDiscoveryPrefs(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeDiscoveryPrefsToStorage(prefs: DiscoveryPrefs): void {
  try {
    localStorage.setItem(DISCOVERY_PREFS_KEY, JSON.stringify({ ...prefs, updated_at: new Date().toISOString() }));
  } catch {
    /* private mode */
  }
}

export function isDiscoverySnoozed(): boolean {
  try {
    const raw = localStorage.getItem(DISCOVERY_SNOOZE_KEY);
    if (!raw) return false;
    const until = Number(raw);
    return Number.isFinite(until) && Date.now() < until;
  } catch {
    return false;
  }
}

export function snoozeDiscoveryOnboarding(ms = DISCOVERY_SNOOZE_MS): void {
  try {
    localStorage.setItem(DISCOVERY_SNOOZE_KEY, String(Date.now() + ms));
  } catch {
    /* ignore */
  }
}

export function clearDiscoverySnooze(): void {
  try {
    localStorage.removeItem(DISCOVERY_SNOOZE_KEY);
  } catch {
    /* ignore */
  }
}

/** Map purchase_scope → HomeMarket. */
export function purchaseScopeToHomeMarket(
  scope: PurchaseScope | null | undefined,
): "local" | "international" | "all" {
  if (scope === "city" || scope === "country") return "local";
  if (scope === "any_country") return "all";
  return "all";
}

/** Whether receipt step should be shown for this scope. */
export function shouldShowReceiptStep(
  scope: PurchaseScope | null | undefined,
  stepsConfig?: DiscoveryOnboardingStepsConfig,
): boolean {
  if (stepsConfig?.receipt === false) return false;
  return scope === "city" || scope === "country";
}

export function audienceToGenderTargets(audience: ShoppingAudience | null | undefined): string[] {
  if (audience === "male") return ["male", "homme"];
  if (audience === "female") return ["female", "femme"];
  if (audience === "both") return ["male", "homme", "female", "femme", "unisex"];
  return [];
}

export function audienceToProfileGender(audience: ShoppingAudience | null | undefined): string | null {
  if (audience === "male") return "male";
  if (audience === "female") return "female";
  return null;
}

/**
 * Mix products ~65% interest×audience, ~25% same-audience exploration, ~10% other.
 * Falls back to rating order when pools are thin.
 */
export function rankProductsByDiscoveryPrefs<
  T extends {
    id: string;
    category_id?: string | null;
    categoryId?: string | null;
    gender_target?: string | null;
    genderTarget?: string | null;
    rating?: number | null;
  },
>(products: T[], prefs: DiscoveryPrefs | null, take = 24): T[] {
  if (!products.length) return [];
  if (!prefs?.completed_at && !prefs?.audience && !(prefs?.interest_category_ids?.length)) {
    return products.slice(0, take);
  }

  const interestSet = new Set(prefs?.interest_category_ids || []);
  const genderTargets = audienceToGenderTargets(prefs?.audience ?? null);
  const genderSet = new Set(genderTargets.map((g) => g.toLowerCase()));

  const catId = (p: T) => p.category_id || p.categoryId || null;
  const genderOf = (p: T) => (p.gender_target || p.genderTarget || "").toLowerCase();

  const matchesGender = (p: T) => {
    if (genderSet.size === 0) return true;
    const g = genderOf(p);
    if (!g || g === "unisex") return true;
    return genderSet.has(g);
  };

  const inInterest = (p: T) => {
    const id = catId(p);
    return interestSet.size > 0 && !!id && interestSet.has(id);
  };

  const primary = products.filter((p) => inInterest(p) && matchesGender(p));
  const exploration = products.filter((p) => !inInterest(p) && matchesGender(p));
  const other = products.filter((p) => !matchesGender(p));

  const nPrimary = Math.max(1, Math.round(take * 0.65));
  const nExplore = Math.max(1, Math.round(take * 0.25));
  const nOther = Math.max(0, take - nPrimary - nExplore);

  const pick = (pool: T[], n: number, exclude: Set<string>) => {
    const out: T[] = [];
    for (const p of pool) {
      if (out.length >= n) break;
      if (exclude.has(p.id)) continue;
      out.push(p);
      exclude.add(p.id);
    }
    return out;
  };

  const taken = new Set<string>();
  const result = [
    ...pick(primary, nPrimary, taken),
    ...pick(exploration, nExplore, taken),
    ...pick(other, nOther, taken),
  ];

  if (result.length < take) {
    for (const p of products) {
      if (result.length >= take) break;
      if (taken.has(p.id)) continue;
      result.push(p);
      taken.add(p.id);
    }
  }

  return result.slice(0, take);
}

/**
 * Merge guest vs profile prefs.
 * A completed onboarding always beats an incomplete one; among completed, newer completed_at wins;
 * otherwise newer updated_at.
 */
export function mergeDiscoveryPrefs(a: DiscoveryPrefs | null, b: DiscoveryPrefs | null): DiscoveryPrefs {
  if (!a) return b ? normalizeDiscoveryPrefs(b) : emptyDiscoveryPrefs();
  if (!b) return normalizeDiscoveryPrefs(a);
  const aDone = !!a.completed_at;
  const bDone = !!b.completed_at;
  if (aDone && !bDone) return normalizeDiscoveryPrefs(a);
  if (bDone && !aDone) return normalizeDiscoveryPrefs(b);
  if (aDone && bDone) {
    return new Date(a.completed_at!).getTime() >= new Date(b.completed_at!).getTime()
      ? normalizeDiscoveryPrefs(a)
      : normalizeDiscoveryPrefs(b);
  }
  return new Date(a.updated_at).getTime() >= new Date(b.updated_at).getTime()
    ? normalizeDiscoveryPrefs(a)
    : normalizeDiscoveryPrefs(b);
}
