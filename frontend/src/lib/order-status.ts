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

/** The linear happy-path flow for LOCAL shops (stock physique, livraison directe) */
export const LOCAL_STATUS_FLOW: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready_for_pickup",
  "out_for_delivery",
  "delivered",
];

/** Tracking steps shown to customers (visual stepper) */
export const CUSTOMER_TRACKING_STEPS = STATUS_FLOW.map((key) => ({
  key,
  label: STATUS_CONFIG[key].label,
  icon: STATUS_CONFIG[key].icon,
}));

/** Customer tracking steps for local orders */
export const LOCAL_CUSTOMER_TRACKING_STEPS = LOCAL_STATUS_FLOW.map((key) => ({
  key,
  label: STATUS_CONFIG[key].label,
  icon: STATUS_CONFIG[key].icon,
}));

/** Vendor can advance orders up to "shipped" (index 4) for international */
export const VENDOR_MAX_STATUS_INDEX = 4; // shipped

/** Vendor can advance local orders up to "out_for_delivery" (index 4) */
export const VENDOR_LOCAL_MAX_STATUS_INDEX = 4; // out_for_delivery

/** Get the correct status flow based on shop type */
export function getStatusFlow(shopType?: string): OrderStatus[] {
  return shopType === "local" ? LOCAL_STATUS_FLOW : STATUS_FLOW;
}

/** Get the next status in the flow */
export function getNextStatus(current: string, shopType?: string): OrderStatus | null {
  const flow = getStatusFlow(shopType);
  const idx = flow.indexOf(current as OrderStatus);
  return idx >= 0 && idx < flow.length - 1 ? flow[idx + 1] : null;
}

/** Get step index for stepper UI */
export function getStepIndex(status: string, shopType?: string): number {
  const flow = getStatusFlow(shopType);
  const idx = flow.indexOf(status as OrderStatus);
  return idx >= 0 ? idx : 0;
}

/** Can a vendor advance to the next status? (international flow) */
export function canVendorAdvance(currentStatus: string): boolean {
  const idx = STATUS_FLOW.indexOf(currentStatus as OrderStatus);
  return idx >= 0 && idx < VENDOR_MAX_STATUS_INDEX;
}

/** Can a vendor advance to the next status? (local flow) */
export function canVendorAdvanceLocal(currentStatus: string): boolean {
  const idx = LOCAL_STATUS_FLOW.indexOf(currentStatus as OrderStatus);
  return idx >= 0 && idx < VENDOR_LOCAL_MAX_STATUS_INDEX;
}

/** Can an admin advance to the next status? Always yes if not at end */
export function canAdminAdvance(currentStatus: string, shopType?: string): boolean {
  const flow = getStatusFlow(shopType);
  const idx = flow.indexOf(currentStatus as OrderStatus);
  return idx >= 0 && idx < flow.length - 1;
}
