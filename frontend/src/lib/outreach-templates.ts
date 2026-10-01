/** Shared outreach template helpers (admin + client). */

export type OutreachChannel =
  | "email"
  | "push"
  | "in_app"
  | "whatsapp_me"
  | "whatsapp_cloud";

export type UtilityMessageTemplate = {
  id: string;
  slug: string;
  label: string;
  audience: "customer" | "vendor" | "all";
  category: "utility" | "marketing" | "auth";
  channels: string[];
  email_subject: string | null;
  email_html: string | null;
  push_title: string | null;
  push_body: string | null;
  in_app_title: string | null;
  in_app_message: string | null;
  whatsapp_body: string | null;
  whatsapp_cloud_template_name: string | null;
  whatsapp_cloud_language: string | null;
  variables: string[] | unknown;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
};

export type OutreachVars = Record<string, string | null | undefined>;

export function interpolateOutreach(
  template: string | null | undefined,
  vars: OutreachVars,
): string {
  if (!template) return "";
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => {
    const v = vars[key];
    return v == null ? "" : String(v);
  });
}

export function templateSupportsChannel(
  t: Pick<UtilityMessageTemplate, "channels">,
  channel: OutreachChannel,
): boolean {
  return Array.isArray(t.channels) && t.channels.includes(channel);
}

export const OUTREACH_CHANNEL_LABELS: Record<OutreachChannel, string> = {
  email: "Email",
  push: "Push",
  in_app: "In-app",
  whatsapp_me: "WhatsApp (wa.me)",
  whatsapp_cloud: "WhatsApp Cloud",
};

export const DEFAULT_CTA_URL = "https://www.zandofy.com";
