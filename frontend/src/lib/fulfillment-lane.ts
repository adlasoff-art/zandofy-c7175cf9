/**
 * Fulfillment lane helpers (Phase C3).
 * Lane derives from geo_relation; cart groups by store × lane (+ origin for freight).
 */

import type { GeoRelation } from "@/lib/geo-eligibility";
import { computeGeoRelation } from "@/lib/geo-eligibility";

export type FulfillmentLane = "last_mile" | "domestic" | "freight";

export function laneFromGeoRelation(relation: GeoRelation | string | null | undefined): FulfillmentLane {
  switch (relation) {
    case "same_city":
      return "last_mile";
    case "same_country_other_city":
      return "domestic";
    case "cross_border":
    default:
      return "freight";
  }
}

export function deriveLane(params: {
  originCountry: string | null | undefined;
  originCityId: string | null | undefined;
  destCountry: string | null | undefined;
  destCityId: string | null | undefined;
}): { relation: GeoRelation; lane: FulfillmentLane } {
  const relation = computeGeoRelation(params);
  return { relation, lane: laneFromGeoRelation(relation) };
}

export type CartLaneGroupKey = string; // `${storeId}|${lane}|${origin?}`

export function buildLaneGroupKey(
  storeId: string,
  lane: FulfillmentLane,
  origin?: string | null,
  useOriginForFreight = true,
): CartLaneGroupKey {
  if (useOriginForFreight && lane === "freight" && origin) {
    return `${storeId}|${lane}|${origin}`;
  }
  return `${storeId}|${lane}`;
}

export function parseLaneGroupKey(key: CartLaneGroupKey): {
  storeId: string;
  lane: FulfillmentLane;
  origin?: string;
} {
  const parts = key.split("|");
  return {
    storeId: parts[0] || "default",
    lane: (parts[1] as FulfillmentLane) || "freight",
    origin: parts[2],
  };
}

export const LANE_LABELS_FR: Record<FulfillmentLane, string> = {
  last_mile: "Livraison locale",
  domestic: "Livraison nationale",
  freight: "Expédition internationale",
};
