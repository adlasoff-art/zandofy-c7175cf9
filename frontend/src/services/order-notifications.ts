import { supabase } from "@/integrations/supabase/client";

/**
 * Triggers multi-channel notifications (in-app, email, push) for key order status changes.
 * Called after successfully updating an order status.
 * Statuses that trigger: confirmed, in_shipping, shipped (arrived at hub)
 */
export async function triggerOrderStatusNotification(orderId: string, newStatus: string) {
  const NOTIFIABLE_STATUSES = ["pending", "confirmed", "in_shipping", "shipped", "out_for_delivery", "delivered"];
  if (!NOTIFIABLE_STATUSES.includes(newStatus)) return;

  try {
    await supabase.functions.invoke("notify-order-status", {
      body: { orderId, newStatus },
    });
  } catch (err) {
    console.error("Failed to trigger order status notification:", err);
  }
}
