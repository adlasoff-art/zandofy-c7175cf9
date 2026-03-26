import { fromTable } from "@/lib/supabase-helpers";

type OptionalOrderField =
  | "shipping_payment_proof_url"
  | "last_mile_payment_proof_url"
  | "hub_pickup_proof_url"
  | "deferred_payment_provider"
  | "deferred_payment_phone";

type OptionalOrderValues = Record<OptionalOrderField, string | null>;

const EMPTY_OPTIONAL_ORDER_VALUES: OptionalOrderValues = {
  shipping_payment_proof_url: null,
  last_mile_payment_proof_url: null,
  hub_pickup_proof_url: null,
  deferred_payment_provider: null,
  deferred_payment_phone: null,
};

export async function withOptionalOrderFields<T extends { id: string }>(
  orders: T[],
  fields: OptionalOrderField[],
): Promise<T[]> {
  if (orders.length === 0) {
    return orders;
  }

  const baseOrders = orders.map((order) => ({ ...EMPTY_OPTIONAL_ORDER_VALUES, ...order })) as Array<
    T & OptionalOrderValues
  >;

  if (fields.length === 0) {
    return baseOrders as T[];
  }

  const { data, error } = await fromTable("orders")
    .select(["id", ...fields].join(", "))
    .in("id", orders.map((order) => order.id));

  if (error || !data) {
    console.warn("[withOptionalOrderFields] Optional order fields unavailable:", error?.message || error);
    return baseOrders as T[];
  }

  const optionalMap = new Map<string, Partial<OptionalOrderValues>>(
    (data as Array<{ id: string } & Partial<OptionalOrderValues>>).map((row) => [row.id, row]),
  );

  return baseOrders.map((order) => ({
    ...order,
    ...optionalMap.get(order.id),
  })) as T[];
}