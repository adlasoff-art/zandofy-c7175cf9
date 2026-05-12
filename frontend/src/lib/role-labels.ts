import type { AppRole } from "@/hooks/use-roles";

/**
 * Source de vérité unique pour les libellés UI des rôles.
 * Aligné sur la chaîne logistique Zandofy (Phase 10.5) :
 *   vendor → forwarder (fret intl) → shipper (hub local) → operator (entreprise last-mile) → rider → client
 */

export type RoleKey = AppRole | "customer";

export const ROLE_LABELS_FR: Record<RoleKey, string> = {
  admin: "Admin",
  manager: "Manager",
  vendor: "Vendeur",
  forwarder: "Transitaire",
  shipper: "Hub local",
  operator: "Entreprise de livraison",
  rider: "Livreur",
  customer: "Client",
};

export const ROLE_LABELS_EN: Record<RoleKey, string> = {
  admin: "Admin",
  manager: "Manager",
  vendor: "Vendor",
  forwarder: "Forwarder",
  shipper: "Hub agent",
  operator: "Delivery operator",
  rider: "Rider",
  customer: "Customer",
};

export const ROLE_LABELS_FR_PLURAL: Record<RoleKey, string> = {
  admin: "Admins",
  manager: "Managers",
  vendor: "Vendeurs",
  forwarder: "Transitaires",
  shipper: "Hubs locaux",
  operator: "Entreprises de livraison",
  rider: "Livreurs",
  customer: "Clients",
};

/** Tous les rôles app_role attribuables côté admin. */
export const ALL_APP_ROLES: AppRole[] = [
  "admin",
  "manager",
  "vendor",
  "forwarder",
  "shipper",
  "operator",
  "rider",
];

export function roleLabel(role: RoleKey | string, lang: "fr" | "en" = "fr"): string {
  const dict = lang === "en" ? ROLE_LABELS_EN : ROLE_LABELS_FR;
  return (dict as Record<string, string>)[role] ?? role;
}

export function roleLabelPlural(role: RoleKey | string): string {
  return (ROLE_LABELS_FR_PLURAL as Record<string, string>)[role] ?? role;
}