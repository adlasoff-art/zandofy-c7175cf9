/**
 * WhatsApp deep-link helpers for forwarder TMS (wa.me — no Meta Cloud API).
 */

export type WaTemplateKey = "arrived" | "reminder" | "urgent";

export const DEFAULT_WA_TEMPLATES: Record<WaTemplateKey, string> = {
  arrived:
    "Bonjour, votre colis {{awb}} est arrivé chez {{company}}. Suivi: {{tracking_url}}",
  reminder:
    "Rappel {{company}}: votre colis {{awb}} ({{status}}) vous attend. {{tracking_url}}",
  urgent:
    "URGENT {{company}}: merci de récupérer le colis {{awb}} dès que possible. {{tracking_url}}",
};

export function renderWaTemplate(
  template: string,
  vars: Record<string, string | number | null | undefined>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const v = vars[key];
    return v == null || v === "" ? "" : String(v);
  });
}

/** Normalize phone to digits only for wa.me (expects country code, no +). */
export function normalizeWaPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return digits;
}

export function buildWaMeUrl(phone: string, text: string): string | null {
  const digits = normalizeWaPhone(phone);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function resolveWaTemplates(
  raw: Record<string, string> | null | undefined,
): Record<WaTemplateKey, string> {
  return {
    arrived: raw?.arrived?.trim() || DEFAULT_WA_TEMPLATES.arrived,
    reminder: raw?.reminder?.trim() || DEFAULT_WA_TEMPLATES.reminder,
    urgent: raw?.urgent?.trim() || DEFAULT_WA_TEMPLATES.urgent,
  };
}
