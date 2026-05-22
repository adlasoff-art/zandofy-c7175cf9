import { supabase } from "@/integrations/supabase/client";

const FOR_YOU_HIDE_DAYS = 3;

/** Record or refresh that the user viewed a product (PDP / recommendation click). */
export async function recordProductView(userId: string, productId: string): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await (supabase as any)
    .from("user_product_views")
    .upsert(
      { user_id: userId, product_id: productId, last_seen_at: now },
      { onConflict: "user_id,product_id" },
    );
  if (error) {
    console.warn("[user_product_views] upsert failed:", error.message);
  }
}

/** Product IDs the user saw within the last N days (default 3). */
export async function fetchRecentlyViewedProductIds(
  userId: string,
  withinDays = FOR_YOU_HIDE_DAYS,
): Promise<Set<string>> {
  const since = new Date();
  since.setDate(since.getDate() - withinDays);
  const { data, error } = await (supabase as any)
    .from("user_product_views")
    .select("product_id")
    .eq("user_id", userId)
    .gte("last_seen_at", since.toISOString());
  if (error) {
    console.warn("[user_product_views] fetch failed:", error.message);
    return new Set();
  }
  return new Set((data ?? []).map((r: { product_id: string }) => r.product_id));
}
