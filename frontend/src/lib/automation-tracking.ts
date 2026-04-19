import { supabase } from "@/integrations/supabase/client";

const ANON_KEY = "zandofy_anon_id";

export function getAnonId(): string {
  let id = localStorage.getItem(ANON_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(ANON_KEY, id);
  }
  return id;
}

export type AutomationEventType =
  | "delivered_popup"
  | "delivered_email"
  | "delivered_push"
  | "failed_email"
  | "clicked_popup_cta"
  | "clicked_email_link"
  | "dismissed_popup"
  | "converted_signup"
  | "converted_order";

export async function logAutomationEvent(
  workflowId: string,
  eventType: AutomationEventType,
  metadata: Record<string, any> = {}
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const anonId = getAnonId();
    await (supabase as any).from("automation_events").insert({
      workflow_id: workflowId,
      user_id: user?.id ?? null,
      anon_id: user ? null : anonId,
      event_type: eventType,
      metadata,
    });
  } catch (err) {
    console.error("[automation-tracking] log error:", err);
  }
}
