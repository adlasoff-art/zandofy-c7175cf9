export interface SupportTicket {
  id: string;
  user_id: string | null;
  subject: string;
  status: string;
  priority: string;
  category: string;
  order_id: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  requester_type: string | null;
  requester_email: string | null;
  requester_name: string | null;
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  content: string;
  attachment_url: string | null;
  is_staff: boolean;
  created_at: string;
  sender_email?: string | null;
}

export const SUPPORT_STATUS_OPTIONS = [
  { value: "all", label: "Tous" },
  { value: "open", label: "Ouvert" },
  { value: "in_progress", label: "En cours" },
  { value: "resolved", label: "Résolu" },
  { value: "closed", label: "Fermé" },
];

export const SUPPORT_CATEGORY_OPTIONS = [
  { value: "all", label: "Toutes" },
  { value: "order", label: "Commande" },
  { value: "delivery", label: "Livraison" },
  { value: "payment", label: "Paiement" },
  { value: "account", label: "Compte" },
  { value: "product", label: "Produit" },
  { value: "other", label: "Autre" },
];

export const SUPPORT_PRIORITY_FILTER_OPTIONS = [
  { value: "all", label: "Toutes" },
  { value: "low", label: "Basse" },
  { value: "normal", label: "Normale" },
  { value: "medium", label: "Moyenne" },
  { value: "high", label: "Haute" },
  { value: "urgent", label: "Urgente" },
];

export const SUPPORT_PRIORITY_CREATE_OPTIONS = [
  { value: "low", label: "Basse" },
  { value: "medium", label: "Moyenne" },
  { value: "high", label: "Haute" },
  { value: "urgent", label: "Urgente" },
];

export const SUPPORT_REQUESTER_FILTER_OPTIONS = [
  { value: "all", label: "Tous" },
  { value: "guest", label: "Non enregistré" },
  { value: "client", label: "Client" },
  { value: "vendor", label: "Vendeur" },
];

export function supportStatusLabel(value: string) {
  return SUPPORT_STATUS_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function supportCategoryLabel(value: string) {
  return SUPPORT_CATEGORY_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function supportPriorityLabel(value: string) {
  return SUPPORT_PRIORITY_FILTER_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function supportRequesterLabel(value: string | null | undefined) {
  if (value === "guest") return "Non enregistré";
  if (value === "vendor") return "Vendeur";
  return "Client";
}

export function toTicketReference(ticketId: string) {
  return `ZD-${ticketId.replace(/-/g, "").toUpperCase()}`;
}

export function parseTicketReference(value: string) {
  const raw = value.trim();
  if (!raw) return null;

  if (/^[0-9a-fA-F-]{36}$/.test(raw)) {
    return raw.toLowerCase();
  }

  const compact = raw.replace(/^ZD-/i, "").replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(compact)) return null;

  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
}
