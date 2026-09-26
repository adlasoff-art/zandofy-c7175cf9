/**
 * Client helpers for geo commercial eligibility (RPC wrappers + pure relation helper).
 * Hard enforcement lives in SQL when platform_settings.geo_eligibility_enforced is true.
 */

import { supabase } from "@/integrations/supabase/client";

export type CommercialScope = "city" | "country" | "international" | "custom" | "inherit";
export type GeoRelation = "same_city" | "same_country_other_city" | "cross_border";

export type EligibilityResult = {
  eligible: boolean;
  enforced?: boolean;
  relation?: GeoRelation | string;
  matched_scope?: string;
  origin_country?: string | null;
  origin_city_id?: string | null;
  destination_country?: string | null;
  destination_city_id?: string | null;
  error?: string;
};

export function computeGeoRelation(params: {
  originCountry: string | null | undefined;
  originCityId: string | null | undefined;
  destCountry: string | null | undefined;
  destCityId: string | null | undefined;
}): GeoRelation {
  const oc = (params.originCountry || "").toUpperCase();
  const dc = (params.destCountry || "").toUpperCase();
  if (params.originCityId && params.destCityId && params.originCityId === params.destCityId) {
    return "same_city";
  }
  if (oc && dc && oc === dc) return "same_country_other_city";
  return "cross_border";
}

export async function isGeoEligibilityEnforced(): Promise<boolean> {
  const { data } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "geo_eligibility_enforced")
    .maybeSingle();
  const v = data?.value as unknown;
  if (v === true || v === "true") return true;
  if (typeof v === "object" && v && (v as { enabled?: boolean }).enabled === true) return true;
  return false;
}

export async function productEligibleForDestination(
  productId: string,
  countryCode: string,
  cityId?: string | null,
): Promise<EligibilityResult> {
  const { data, error } = await (supabase as any).rpc("product_eligible_for_destination", {
    p_product_id: productId,
    p_country_code: countryCode,
    p_city_id: cityId || null,
  });
  if (error) {
    console.warn("[geo-eligibility]", error.message);
    return { eligible: true, enforced: false, error: error.message };
  }
  return (data || { eligible: true }) as EligibilityResult;
}

export async function productsEligibleForDestination(
  productIds: string[],
  countryCode: string,
  cityId?: string | null,
): Promise<Map<string, EligibilityResult>> {
  const map = new Map<string, EligibilityResult>();
  if (!productIds.length) return map;
  const { data, error } = await (supabase as any).rpc("products_eligible_for_destination", {
    p_product_ids: productIds,
    p_country_code: countryCode,
    p_city_id: cityId || null,
  });
  if (error) {
    console.warn("[geo-eligibility] batch", error.message);
    for (const id of productIds) map.set(id, { eligible: true, enforced: false, error: error.message });
    return map;
  }
  for (const row of data || []) {
    map.set(row.product_id, (row.result || { eligible: true }) as EligibilityResult);
  }
  return map;
}

/** Soft client-side filter — never blocks when unsure (feed). */
export function filterEligibleIds(
  ids: string[],
  eligibility: Map<string, EligibilityResult>,
  enforced: boolean,
): string[] {
  if (!enforced) return ids;
  return ids.filter((id) => {
    const r = eligibility.get(id);
    return !r || r.eligible !== false;
  });
}

/**
 * Assert all products eligible for destination when flag enforced.
 * Throws on block or RPC failure (fail-closed for checkout).
 */
export async function assertProductsEligibleForCheckout(
  productIds: string[],
  countryCode: string,
  cityId?: string | null,
): Promise<void> {
  if (!productIds.length || !countryCode) return;
  const enforced = await isGeoEligibilityEnforced();
  if (!enforced) return;
  const map = await productsEligibleForDestination(productIds, countryCode, cityId);
  const rpcFailed = [...map.values()].some((r) => !!r.error);
  if (rpcFailed) {
    throw new Error(
      "Impossible de vérifier la zone de livraison. Réessayez dans un instant.",
    );
  }
  const blocked = productIds.filter((id) => map.get(id)?.eligible === false);
  if (blocked.length > 0) {
    throw new Error(
      "Certains articles ne sont pas livrables à l’adresse sélectionnée. Modifiez l’adresse ou retirez ces articles.",
    );
  }
}

export async function applyDiscoveryEligibilityFilter<T extends { id: string }>(
  items: T[],
  countryCode: string | null | undefined,
  cityId?: string | null,
): Promise<T[]> {
  if (!items.length || !countryCode) return items;
  const enforced = await isGeoEligibilityEnforced();
  if (!enforced) return items;
  const map = await productsEligibleForDestination(
    items.map((i) => i.id),
    countryCode,
    cityId,
  );
  // Feed: if batch RPC failed entirely, keep pool (availability > empty home)
  if ([...map.values()].every((r) => r.error)) return items;
  const allowed = new Set(filterEligibleIds(items.map((i) => i.id), map, true));
  return items.filter((i) => allowed.has(i.id));
}
