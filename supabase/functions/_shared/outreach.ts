/** Shared outreach helpers for Edge Functions. */

export type OutreachChannel =
  | "email"
  | "push"
  | "in_app"
  | "whatsapp_me"
  | "whatsapp_cloud";

export type UtilityTemplateRow = {
  id: string;
  slug: string;
  label: string;
  audience: string;
  category: string;
  channels: string[] | null;
  email_subject: string | null;
  email_html: string | null;
  push_title: string | null;
  push_body: string | null;
  in_app_title: string | null;
  in_app_message: string | null;
  whatsapp_body: string | null;
  whatsapp_cloud_template_name: string | null;
  whatsapp_cloud_language: string | null;
  is_active: boolean;
};

export function interpolateOutreach(
  template: string | null | undefined,
  vars: Record<string, string>,
): string {
  if (!template) return "";
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key: string) => {
    return vars[key] ?? "";
  });
}

export type OutreachConfig = {
  whatsapp_cloud_enabled: boolean;
  default_send_window: {
    start_hour: number;
    end_hour: number;
    timezone: string;
  };
};

export const DEFAULT_OUTREACH_CONFIG: OutreachConfig = {
  whatsapp_cloud_enabled: false,
  default_send_window: {
    start_hour: 18,
    end_hour: 19,
    timezone: "Africa/Kinshasa",
  },
};

export async function loadOutreachConfig(supabase: any): Promise<OutreachConfig> {
  const { data } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "outreach_config")
    .maybeSingle();
  const v = (data?.value || {}) as Partial<OutreachConfig>;
  return {
    whatsapp_cloud_enabled: v.whatsapp_cloud_enabled === true,
    default_send_window: {
      start_hour: v.default_send_window?.start_hour ?? 18,
      end_hour: v.default_send_window?.end_hour ?? 19,
      timezone: v.default_send_window?.timezone || "Africa/Kinshasa",
    },
  };
}

/** True if "now" is inside [start_hour, end_hour) in the given IANA timezone. */
export function isWithinSendWindow(
  cfg: OutreachConfig["default_send_window"],
  now = new Date(),
): boolean {
  try {
    const hourStr = new Intl.DateTimeFormat("en-GB", {
      timeZone: cfg.timezone,
      hour: "numeric",
      hour12: false,
    }).format(now);
    // Some ICU builds return "24" for midnight — normalize to 0–23
    const hour = Number(hourStr) % 24;
    if (!Number.isFinite(hour)) return true;
    const start = cfg.start_hour;
    const end = cfg.end_hour;
    if (start === end) return true;
    if (start < end) return hour >= start && hour < end;
    // wraps midnight
    return hour >= start || hour < end;
  } catch {
    return true;
  }
}

export async function logOutreach(
  supabase: any,
  row: {
    user_id: string | null;
    template_id: string | null;
    channel: OutreachChannel;
    status: string;
    actor_admin_id?: string | null;
    meta?: Record<string, unknown>;
  },
) {
  const { error } = await supabase.from("outreach_send_log").insert({
    user_id: row.user_id,
    template_id: row.template_id,
    channel: row.channel,
    status: row.status,
    actor_admin_id: row.actor_admin_id ?? null,
    meta: row.meta ?? {},
  });
  if (error) console.warn("[outreach] log failed:", error.message);
}
