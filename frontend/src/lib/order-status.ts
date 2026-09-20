import {
  Clock, CheckCircle2, Box, Truck, Package, UserCheck, Users, MapPin, Gift, XCircle, RotateCcw, PackageCheck,
} from "lucide-react";

export const ORDER_STATUSES = [
  "awaiting_payment",
  "pending",
  "confirmed",
  "preparing",
  "in_shipping",
  "shipped",
  "assigning_rider",
  "rider_assigned",
  "out_for_delivery",
  "ready_for_pickup",
  "delivered",
  "cancelled",
  "returned",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ACTIVE_ORDER_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "in_shipping",
  "shipped",
  "assigning_rider",
  "rider_assigned",
  "out_for_delivery",
  "ready_for_pickup",
] as const;

export const NON_REVENUE_ORDER_STATUSES = ["awaiting_payment", "cancelled", "returned", "refunded", "payment_failed"] as const;

export const REAL_REVENUE_ORDER_STATUSES = ["delivered"] as const;

export const STATUS_CONFIG: Record<
  string,
  { label: string; icon: typeof Clock; color: string; badgeClass: string }
> = {
  awaiting_payment:  { label: "Paiement en attente",    icon: Clock,        color: "text-amber-500",    badgeClass: "bg-amber-100 text-amber-700" },
  pending:           { label: "Reçue",                icon: Clock,        color: "text-amber-500",    badgeClass: "bg-amber-100 text-amber-700" },
  confirmed:         { label: "Confirmée",            icon: CheckCircle2, color: "text-blue-500",     badgeClass: "bg-blue-100 text-blue-700" },
  preparing:         { label: "En préparation",       icon: Box,          color: "text-yellow-600",   badgeClass: "bg-yellow-100 text-yellow-700" },
  in_shipping:       { label: "En expédition",        icon: Truck,        color: "text-indigo-500",   badgeClass: "bg-indigo-100 text-indigo-700" },
  shipped:           { label: "Arrivée au hub",       icon: Package,      color: "text-purple-500",   badgeClass: "bg-purple-100 text-purple-700" },
  assigning_rider:   { label: "Assignation livreur",  icon: Users,        color: "text-cyan-500",     badgeClass: "bg-cyan-100 text-cyan-700" },
  rider_assigned:    { label: "Livreur assigné",      icon: UserCheck,    color: "text-teal-500",     badgeClass: "bg-teal-100 text-teal-700" },
  out_for_delivery:  { label: "En livraison",         icon: MapPin,       color: "text-orange-500",   badgeClass: "bg-orange-100 text-orange-700" },
  ready_for_pickup:  { label: "Prêt à récupérer",    icon: PackageCheck, color: "text-lime-600",     badgeClass: "bg-lime-100 text-lime-700" },
  delivered:         { label: "Livrée",               icon: Gift,         color: "text-emerald-500",  badgeClass: "bg-primary/10 text-primary" },
  cancelled:         { label: "Annulée",              icon: XCircle,      color: "text-destructive",  badgeClass: "bg-destructive/10 text-destructive" },
  returned:          { label: "Retournée",            icon: RotateCcw,    color: "text-rose-500",     badgeClass: "bg-rose-100 text-rose-700" },
  payment_failed:    { label: "Paiement échoué",      icon: XCircle,      color: "text-destructive",  badgeClass: "bg-destructive/10 text-destructive" },
};

/** The linear happy-path flow for INTERNATIONAL shops (excludes cancelled/returned) */
export const STATUS_FLOW: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "in_shipping",
  "shipped",
  "assigning_rider",
  "rider_assigned",
  "out_for_delivery",
  "delivered",
];

/** Local hub / pickup — no freight hub, no rider assignment */
export const LOCAL_PICKUP_STATUS_FLOW: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready_for_pickup",
  "delivered",
];

/** Local home delivery — preparation then rider last-mile */
export const LOCAL_DELIVERY_STATUS_FLOW: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "assigning_rider",
  "rider_assigned",
  "out_for_delivery",
  "delivered",
];

/**
 * @deprecated Prefer LOCAL_PICKUP_STATUS_FLOW / LOCAL_DELIVERY_STATUS_FLOW via getStatusFlow.
 * Kept as pickup default for callers that omit delivery_choice.
 */
export const LOCAL_STATUS_FLOW: OrderStatus[] = LOCAL_PICKUP_STATUS_FLOW;

export type TrackingStep = {
  key: OrderStatus;
  label: string;
  icon: typeof Clock;
};

function stepsFromFlow(flow: OrderStatus[]): TrackingStep[] {
  return flow.map((key) => ({
    key,
    label: STATUS_CONFIG[key].label,
    icon: STATUS_CONFIG[key].icon,
  }));
}

/** Tracking steps shown to customers (visual stepper) — international */
export const CUSTOMER_TRACKING_STEPS = stepsFromFlow(STATUS_FLOW);

/** @deprecated Use getCustomerTrackingSteps(shopType, deliveryChoice) */
export const LOCAL_CUSTOMER_TRACKING_STEPS = stepsFromFlow(LOCAL_PICKUP_STATUS_FLOW);

/** Vendor can advance orders up to "shipped" (index 4) for international */
export const VENDOR_MAX_STATUS_INDEX = 4; // shipped

/** Vendor local pickup: advance up to ready_for_pickup (index 3) */
export const VENDOR_LOCAL_PICKUP_MAX_STATUS_INDEX = 3;

/** Vendor local delivery: advance up to out_for_delivery (index 5) */
export const VENDOR_LOCAL_DELIVERY_MAX_STATUS_INDEX = 5;

/** @deprecated Use canVendorAdvanceLocal(status, deliveryChoice) */
export const VENDOR_LOCAL_MAX_STATUS_INDEX = VENDOR_LOCAL_DELIVERY_MAX_STATUS_INDEX;

export type DeliveryChoice = "home_delivery" | "hub_pickup" | string | null | undefined;

/** Get the correct status flow based on shop type + delivery choice */
export function getStatusFlow(shopType?: string, deliveryChoice?: DeliveryChoice): OrderStatus[] {
  if (shopType === "local") {
    return deliveryChoice === "home_delivery"
      ? LOCAL_DELIVERY_STATUS_FLOW
      : LOCAL_PICKUP_STATUS_FLOW;
  }
  return STATUS_FLOW;
}

/** Customer-facing tracking steps */
export function getCustomerTrackingSteps(
  shopType?: string | null,
  deliveryChoice?: DeliveryChoice
): TrackingStep[] {
  return stepsFromFlow(getStatusFlow(shopType || undefined, deliveryChoice));
}

/** Get the next status in the flow */
export function getNextStatus(
  current: string,
  shopType?: string,
  deliveryChoice?: DeliveryChoice
): OrderStatus | null {
  const flow = getStatusFlow(shopType, deliveryChoice);
  const idx = flow.indexOf(current as OrderStatus);
  return idx >= 0 && idx < flow.length - 1 ? flow[idx + 1] : null;
}

/** Get step index for stepper UI */
export function getStepIndex(
  status: string,
  shopType?: string,
  deliveryChoice?: DeliveryChoice
): number {
  const flow = getStatusFlow(shopType, deliveryChoice);
  const idx = flow.indexOf(status as OrderStatus);
  if (idx >= 0) return idx;

  // Status not in this flow (legacy / switched mode) — best-effort by global order
  const globalIdx = ORDER_STATUSES.indexOf(status as OrderStatus);
  if (globalIdx < 0) return 0;
  let best = 0;
  for (let i = 0; i < flow.length; i++) {
    const stepGlobal = ORDER_STATUSES.indexOf(flow[i]);
    if (stepGlobal >= 0 && stepGlobal <= globalIdx) best = i;
  }
  // Terminal delivered/cancelled outside flow still map to last step visually when past end
  if (status === "delivered" || status === "cancelled" || status === "returned") {
    return Math.max(best, flow.length - 1);
  }
  return best;
}

/** Can a vendor advance to the next status? (international flow) */
export function canVendorAdvance(currentStatus: string): boolean {
  const idx = STATUS_FLOW.indexOf(currentStatus as OrderStatus);
  return idx >= 0 && idx < VENDOR_MAX_STATUS_INDEX;
}

/** Can a vendor advance to the next status? (local flow) */
export function canVendorAdvanceLocal(
  currentStatus: string,
  deliveryChoice?: DeliveryChoice
): boolean {
  const flow = getStatusFlow("local", deliveryChoice);
  const maxIdx =
    deliveryChoice === "home_delivery"
      ? VENDOR_LOCAL_DELIVERY_MAX_STATUS_INDEX
      : VENDOR_LOCAL_PICKUP_MAX_STATUS_INDEX;
  const idx = flow.indexOf(currentStatus as OrderStatus);
  return idx >= 0 && idx < maxIdx;
}

/** Can an admin advance to the next status? Always yes if not at end */
export function canAdminAdvance(
  currentStatus: string,
  shopType?: string,
  deliveryChoice?: DeliveryChoice
): boolean {
  const flow = getStatusFlow(shopType, deliveryChoice);
  const idx = flow.indexOf(currentStatus as OrderStatus);
  return idx >= 0 && idx < flow.length - 1;
}
