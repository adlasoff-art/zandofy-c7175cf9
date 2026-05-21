/**
 * 17track-ready tracking architecture
 * JSON mapping for international shipment tracking providers.
 * When 17track API is connected, this module maps external data to the internal format.
 */

import { supabase } from "@/integrations/supabase/client";

export interface TrackingEvent {
  timestamp: string;
  location: string;
  description: string;
  status: TrackingStatus;
}

export type TrackingStatus =
  | "info_received"
  | "in_transit"
  | "customs"
  | "out_for_delivery"
  | "delivered"
  | "exception"
  | "expired";

export interface TrackingResult {
  tracking_number: string;
  carrier: string;
  carrier_logo?: string;
  origin: string;
  destination: string;
  current_status: TrackingStatus;
  current_location?: string;
  estimated_delivery?: string;
  last_update: string;
  events: TrackingEvent[];
  /** Raw provider data for debugging */
  raw?: unknown;
}

/** Maps internal Zandofy shipment status to TrackingStatus */
export function mapInternalStatus(status: string): TrackingStatus {
  const map: Record<string, TrackingStatus> = {
    loading: "info_received",
    in_transit: "in_transit",
    customs: "customs",
    arrived: "out_for_delivery",
    delivered: "delivered",
  };
  return map[status] || "info_received";
}

/** Maps 17track API status codes to TrackingStatus */
export function map17trackStatus(statusCode: number): TrackingStatus {
  // 17track status codes: https://api.17track.net/en/doc
  const map: Record<number, TrackingStatus> = {
    0: "info_received",    // Not found
    10: "in_transit",       // In transit
    20: "expired",          // Expired
    30: "info_received",    // Ready to pick up
    35: "in_transit",       // Undelivered
    40: "delivered",        // Delivered
    50: "exception",        // Alert
  };
  return map[statusCode] || "info_received";
}

/** Convert a 17track API response to our TrackingResult */
export function parse17trackResponse(raw: any): TrackingResult | null {
  if (!raw || !raw.number) return null;

  const events: TrackingEvent[] = (raw.track?.z || []).map((e: any) => ({
    timestamp: e.a || "",
    location: e.c || "",
    description: e.z || "",
    status: map17trackStatus(raw.track?.e || 0),
  }));

  return {
    tracking_number: raw.number,
    carrier: raw.carrier?.name || "Unknown",
    carrier_logo: raw.carrier?.logo || undefined,
    origin: raw.track?.b?.split(" → ")?.[0] || "",
    destination: raw.track?.b?.split(" → ")?.[1] || "",
    current_status: map17trackStatus(raw.track?.e || 0),
    current_location: events[0]?.location || undefined,
    estimated_delivery: raw.track?.d || undefined,
    last_update: events[0]?.timestamp || new Date().toISOString(),
    events,
    raw,
  };
}

/** Convert internal Zandofy shipment to TrackingResult (fallback) */
export function mapInternalShipment(shipment: {
  awb_bl: string;
  origin: string;
  destination: string;
  mode: string;
  status: string;
  eta: string | null;
  updated_at: string;
}): TrackingResult {
  return {
    tracking_number: shipment.awb_bl,
    carrier: `Zandofy ${shipment.mode.toUpperCase()}`,
    origin: shipment.origin,
    destination: shipment.destination,
    current_status: mapInternalStatus(shipment.status),
    estimated_delivery: shipment.eta || undefined,
    last_update: shipment.updated_at,
    events: [
      {
        timestamp: shipment.updated_at,
        location: shipment.status === "delivered" ? shipment.destination : shipment.origin,
        description: `Statut: ${shipment.status.replace("_", " ")}`,
        status: mapInternalStatus(shipment.status),
      },
    ],
  };
}

/** Carrier database for common international carriers */
export const CARRIERS: Record<string, { name: string; prefix: string[] }> = {
  dhl: { name: "DHL Express", prefix: ["JD", "JJD"] },
  fedex: { name: "FedEx", prefix: ["6"] },
  ups: { name: "UPS", prefix: ["1Z"] },
  ems: { name: "EMS", prefix: ["E"] },
  china_post: { name: "China Post", prefix: ["R", "L", "C"] },
  aramex: { name: "Aramex", prefix: ["3"] },
  dpd: { name: "DPD", prefix: ["0"] },
};

/** Auto-detect carrier from tracking number */
export function detectCarrier(trackingNumber: string): string | null {
  const upper = trackingNumber.toUpperCase().trim();
  for (const [key, carrier] of Object.entries(CARRIERS)) {
    if (carrier.prefix.some((p) => upper.startsWith(p))) {
      return key;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 17track v2.2 — high-level client
// ─────────────────────────────────────────────────────────────────────────────

/** Maps 17track v2.2 status text to TrackingStatus */
function map17trackV2Status(statusText: string | null | undefined): TrackingStatus {
  if (!statusText) return "info_received";
  const s = statusText.toLowerCase();
  if (s.includes("delivered")) return "delivered";
  if (s.includes("out_for_delivery") || s.includes("outfordelivery")) return "out_for_delivery";
  if (s.includes("customs") || s.includes("inboundoutofcustoms") || s.includes("inboundincustoms")) return "customs";
  if (s.includes("transit") || s.includes("intransit")) return "in_transit";
  if (s.includes("expired")) return "expired";
  if (s.includes("alert") || s.includes("exception") || s.includes("undelivered")) return "exception";
  if (s.includes("notfound") || s.includes("inforeceived")) return "info_received";
  return "info_received";
}

/**
 * Parse a 17track v2.2 "accepted" entry (returned by track-shipment-17track edge function).
 * Shape: { number, carrier, track_info: { latest_status: { status, sub_status }, tracking: { providers: [...] } } }
 */
export function parse17trackV2Response(accepted: any): TrackingResult | null {
  if (!accepted || !accepted.number) return null;
  const trackInfo = accepted.track_info ?? {};
  const latest = trackInfo.latest_status ?? {};
  const milestones: any[] = trackInfo.milestone ?? [];
  const events: TrackingEvent[] = ([] as any[])
    .concat(...((trackInfo.tracking?.providers ?? []).map((p: any) => p.events ?? [])))
    .map((e: any) => ({
      timestamp: e.time_iso || e.time_utc || e.time_raw?.date || "",
      location: [e.location, e.address?.city, e.address?.country_iso].filter(Boolean).join(", "),
      description: e.description || e.stage || "",
      status: map17trackV2Status(e.sub_status || e.stage || ""),
    }))
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

  const route = trackInfo.tracking?.misc_info ?? {};

  return {
    tracking_number: accepted.number,
    carrier: accepted.carrier?.name || trackInfo.carrier?.name || "Unknown",
    carrier_logo: accepted.carrier?.icon || undefined,
    origin: route.origin_country || milestones?.[0]?.address?.country_iso || "",
    destination: route.destination_country || milestones?.[milestones.length - 1]?.address?.country_iso || "",
    current_status: map17trackV2Status(latest.sub_status || latest.status || ""),
    current_location: events[0]?.location || undefined,
    estimated_delivery: trackInfo.tracking?.misc_info?.estimated_delivery_date_to || undefined,
    last_update: events[0]?.timestamp || new Date().toISOString(),
    events,
    raw: accepted,
  };
}

export interface ExternalTrackingResponse {
  result: TrackingResult | null;
  configured: boolean;
  error?: string;
}

/**
 * Fetch tracking info from the 17track edge function.
 * Returns `{ configured: false }` when the API key is not set on the server,
 * letting the caller fall back to internal Zandofy tracking.
 */
export async function fetchExternalTracking(
  trackingNumber: string,
): Promise<ExternalTrackingResponse> {
  const trimmed = trackingNumber.trim();
  if (!trimmed) return { result: null, configured: false, error: "empty" };

  try {
    const { data, error } = await supabase.functions.invoke("track-shipment-17track", {
      body: { tracking_number: trimmed },
    });

    // The edge function returns 503 with `configured: false` when the secret is missing.
    // supabase-js surfaces that as `error` but `data` is still parsed when JSON.
    const payload = (data ?? (error as any)?.context?.body) as any;

    if (payload && payload.configured === false) {
      return { result: null, configured: false };
    }

    if (error && !payload) {
      return { result: null, configured: true, error: error.message };
    }

    if (payload?.error) {
      return { result: null, configured: true, error: payload.error };
    }

    const parsed = parse17trackV2Response(payload?.raw);
    return { result: parsed, configured: true };
  } catch (e) {
    return {
      result: null,
      configured: true,
      error: e instanceof Error ? e.message : "Unknown tracking error",
    };
  }
}
