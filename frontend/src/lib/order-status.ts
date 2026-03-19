import {
  Clock, CheckCircle2, Box, Truck, Package, UserCheck, Users, MapPin, Gift, XCircle, RotateCcw,
} from "lucide-react";

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "in_shipping",
  "shipped",
  "assigning_rider",
  "rider_assigned",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "returned",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_CONFIG: Record<
  string,
  { label: string; icon: typeof Clock; color: string; badgeClass: string }
> = {
  pending:           { label: "Reçue",                icon: Clock,       color: "text-amber-500",    badgeClass: "bg-amber-100 text-amber-700" },
  confirmed:         { label: "Confirmée",            icon: CheckCircle2, color: "text-blue-500",     badgeClass: "bg-blue-100 text-blue-700" },
  preparing:         { label: "En préparation",       icon: Box,         color: "text-yellow-600",   badgeClass: "bg-yellow-100 text-yellow-700" },
  in_shipping:       { label: "En expédition",        icon: Truck,       color: "text-indigo-500",   badgeClass: "bg-indigo-100 text-indigo-700" },
  shipped:           { label: "Arrivée au hub",       icon: Package,     color: "text-purple-500",   badgeClass: "bg-purple-100 text-purple-700" },
  assigning_rider:   { label: "Assignation livreur",  icon: Users,       color: "text-cyan-500",     badgeClass: "bg-cyan-100 text-cyan-700" },
  rider_assigned:    { label: "Livreur assigné",      icon: UserCheck,   color: "text-teal-500",     badgeClass: "bg-teal-100 text-teal-700" },
  out_for_delivery:  { label: "En livraison",         icon: MapPin,      color: "text-orange-500",   badgeClass: "bg-orange-100 text-orange-700" },
  delivered:         { label: "Livrée",               icon: Gift,        color: "text-emerald-500",  badgeClass: "bg-primary/10 text-primary" },
  cancelled:         { label: "Annulée",              icon: XCircle,     color: "text-destructive",  badgeClass: "bg-destructive/10 text-destructive" },
  returned:          { label: "Retournée",            icon: RotateCcw,   color: "text-rose-500",     badgeClass: "bg-rose-100 text-rose-700" },
  payment_failed:    { label: "Paiement échoué",      icon: XCircle,     color: "text-destructive",  badgeClass: "bg-destructive/10 text-destructive" },
};

/** The linear happy-path flow (excludes cancelled/returned) */
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

/** Tracking steps shown to customers (visual stepper) */
export const CUSTOMER_TRACKING_STEPS = STATUS_FLOW.map((key) => ({
  key,
  label: STATUS_CONFIG[key].label,
  icon: STATUS_CONFIG[key].icon,
}));

/** Vendor can advance orders up to "shipped" (index 4) */
export const VENDOR_MAX_STATUS_INDEX = 4; // shipped

/** Get the next status in the flow */
export function getNextStatus(current: string): OrderStatus | null {
  const idx = STATUS_FLOW.indexOf(current as OrderStatus);
  return idx >= 0 && idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null;
}

/** Get step index for stepper UI */
export function getStepIndex(status: string): number {
  const idx = STATUS_FLOW.indexOf(status as OrderStatus);
  return idx >= 0 ? idx : 0;
}

/** Can a vendor advance to the next status? */
export function canVendorAdvance(currentStatus: string): boolean {
  const idx = STATUS_FLOW.indexOf(currentStatus as OrderStatus);
  return idx >= 0 && idx < VENDOR_MAX_STATUS_INDEX;
}

/** Can an admin advance to the next status? Always yes if not at end */
export function canAdminAdvance(currentStatus: string): boolean {
  const idx = STATUS_FLOW.indexOf(currentStatus as OrderStatus);
  return idx >= 0 && idx < STATUS_FLOW.length - 1;
}
