import { supabase } from "@/integrations/supabase/client";

/**
 * Create an open checkout_session and link orders after insert.
 * Used when N>1 orders share one online payment (same store multi-origin or multi-store).
 */

export async function createCheckoutSession(userId: string): Promise<string> {
  const { data, error } = await (supabase as any)
    .from("checkout_sessions")
    .insert({
      user_id: userId,
      status: "open",
      currency: "USD",
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();
  if (error || !data?.id) {
    throw new Error(error?.message || "Impossible de créer la session de paiement");
  }
  return data.id as string;
}

export async function linkOrdersToCheckoutSession(
  sessionId: string,
  orderIds: string[],
  anchorOrderId: string,
  totalAmount: number
): Promise<void> {
  if (!sessionId || orderIds.length === 0) {
    throw new Error("Session ou commandes manquantes");
  }
  const { error: linkErr } = await (supabase as any)
    .from("orders")
    .update({ checkout_session_id: sessionId })
    .in("id", orderIds);
  if (linkErr) {
    throw new Error(linkErr.message || "Liaison commandes ↔ session échouée");
  }

  // Verify all rows linked (RLS / partial failure)
  const { data: linked, error: verifyErr } = await (supabase as any)
    .from("orders")
    .select("id")
    .in("id", orderIds)
    .eq("checkout_session_id", sessionId);
  if (verifyErr || !linked || linked.length !== orderIds.length) {
    throw new Error("Liaison session incomplète — réessayez");
  }

  // total_amount / anchor updated by Edge at payment initiate (service role).
  // Clients cannot UPDATE checkout_sessions after 20260924170000.
  void totalAmount;
  void anchorOrderId;
}

/** True when online gateways need a checkout_session for N child orders. */
export function shouldCreateCheckoutSession(
  orderCount: number,
  paymentMethod: string
): boolean {
  if (orderCount <= 1) return false;
  return ["mobile_money", "card", "paypal", "stripe"].includes(paymentMethod);
}

/** Best-effort: mark created orders failed after a mid-checkout abort. */
export async function abortCreatedOrders(orderIds: string[]): Promise<void> {
  if (!orderIds.length) return;
  for (const oid of orderIds) {
    try {
      await (supabase as any).rpc("refund_customer_wallet_for_order", { p_order_id: oid });
    } catch {
      /* ignore */
    }
  }
  await supabase
    .from("orders")
    .update({ status: "payment_failed" } as any)
    .in("id", orderIds)
    .in("status", ["awaiting_payment", "pending"]);
}
