/**
 * WhatsApp order receipt message for checkout payment_method=whatsapp.
 * No full shipping address — ref, lines, total, customer phone, dashboard link.
 */

export type WhatsAppReceiptLine = {
  name: string;
  quantity: number;
  variant?: string | null;
  unitPrice?: number;
};

export type WhatsAppReceiptInput = {
  orderRef: string;
  storeName?: string | null;
  lines: WhatsAppReceiptLine[];
  total: number;
  currencyLabel?: string;
  customerPhone?: string | null;
  customerName?: string | null;
  dashboardUrl?: string;
  locale?: "fr" | "en";
};

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

function formatMoney(amount: number, currencyLabel: string): string {
  const n = Number.isFinite(amount) ? amount : 0;
  const rounded = Math.round(n * 100) / 100;
  return `${rounded.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currencyLabel}`.trim();
}

/**
 * Build a short WhatsApp prefill for the vendor (receipt of order received, not paid).
 */
export function buildWhatsAppOrderReceiptMessage(input: WhatsAppReceiptInput): string {
  const locale = input.locale === "en" ? "en" : "fr";
  const currency = (input.currencyLabel || "USD").trim() || "USD";
  const dash =
    input.dashboardUrl?.trim() ||
    (typeof window !== "undefined"
      ? `${window.location.origin}/dashboard?tab=orders`
      : "https://www.zandofy.com/dashboard?tab=orders");

  const header =
    locale === "en"
      ? `🛒 New Zandofy order (awaiting confirmation)`
      : `🛒 Nouvelle commande Zandofy (en attente de confirmation)`;

  const refLine =
    locale === "en" ? `Ref: ${input.orderRef}` : `Réf: ${input.orderRef}`;

  const storeLine = input.storeName
    ? locale === "en"
      ? `Store: ${truncate(input.storeName, 60)}`
      : `Boutique: ${truncate(input.storeName, 60)}`
    : null;

  const customerBits: string[] = [];
  if (input.customerName?.trim()) customerBits.push(truncate(input.customerName, 40));
  if (input.customerPhone?.trim()) customerBits.push(input.customerPhone.trim());
  const customerLine =
    customerBits.length > 0
      ? locale === "en"
        ? `Customer: ${customerBits.join(" · ")}`
        : `Client: ${customerBits.join(" · ")}`
      : null;

  const maxLines = 12;
  const lines = (input.lines || []).slice(0, maxLines);
  const itemLines = lines.map((l) => {
    const variant = l.variant?.trim() ? ` (${truncate(l.variant, 24)})` : "";
    const qty = Math.max(1, Math.floor(Number(l.quantity) || 1));
    const price =
      l.unitPrice != null && Number.isFinite(l.unitPrice)
        ? ` — ${formatMoney(Number(l.unitPrice) * qty, currency)}`
        : "";
    return `• ${truncate(l.name || "Produit", 48)}${variant} ×${qty}${price}`;
  });
  if ((input.lines || []).length > maxLines) {
    itemLines.push(
      locale === "en"
        ? `… +${(input.lines || []).length - maxLines} more`
        : `… +${(input.lines || []).length - maxLines} autres`,
    );
  }

  const totalLine =
    locale === "en"
      ? `Total: ${formatMoney(input.total, currency)}`
      : `Total: ${formatMoney(input.total, currency)}`;

  const footer =
    locale === "en"
      ? `Please confirm payment with the customer. Order details: ${dash}`
      : `Merci de confirmer le paiement avec le client. Détails: ${dash}`;

  return [
    header,
    refLine,
    storeLine,
    customerLine,
    "",
    ...(itemLines.length ? itemLines : [locale === "en" ? "• (items)" : "• (articles)"]),
    "",
    totalLine,
    "",
    footer,
  ]
    .filter((x) => x !== null && x !== undefined)
    .join("\n");
}
