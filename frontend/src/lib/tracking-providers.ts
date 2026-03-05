/**
 * 17track-ready tracking architecture
 * JSON mapping for international shipment tracking providers.
 * When 17track API is connected, this module maps external data to the internal format.
 */

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
