/**
 * Shared gate for vendor off-platform payment numbers / QR access.
 * Prefer SQL store_off_platform_numbers_allowed; fall back to client if RPC absent.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_OFF_PLATFORM_TRIAL_DAYS = 30;

export type OffPlatformAccess = {
  allowed: boolean;
  reason: "grant" | "subscription" | "trial" | "denied";
  trialEndsAt: string | null;
  trialDays: number;
  daysLeft: number | null;
};

async function fetchTrialDays(): Promise<number> {
  const { data } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", "vendor_monetization")
    .maybeSingle();
  const days = Number((data?.value as any)?.off_platform_trial_days);
  return Number.isFinite(days) && days > 0 ? days : DEFAULT_OFF_PLATFORM_TRIAL_DAYS;
}

function buildTrialMeta(
  createdAtIso: string | null | undefined,
  trialDays: number,
): Pick<OffPlatformAccess, "trialEndsAt" | "daysLeft"> & { inTrial: boolean } {
  const createdAt = createdAtIso ? new Date(createdAtIso) : null;
  const trialEndsAt =
    createdAt && !Number.isNaN(createdAt.getTime())
      ? new Date(createdAt.getTime() + trialDays * 24 * 60 * 60 * 1000)
      : null;
  const now = Date.now();
  const inTrial = trialEndsAt ? trialEndsAt.getTime() > now : false;
  const daysLeft =
    trialEndsAt && inTrial
      ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now) / (24 * 60 * 60 * 1000)))
      : null;
  return {
    trialEndsAt: trialEndsAt?.toISOString() ?? null,
    daysLeft,
    inTrial,
  };
}

function classifyReason(
  override: any,
  inTrial: boolean,
  allowed: boolean,
): OffPlatformAccess["reason"] {
  if (!allowed) return "denied";
  if (
    override?.mm_granted_by_admin === true &&
    override?.vendor_custom_payment_numbers_enabled === true
  ) {
    return "grant";
  }
  if (
    override?.vendor_custom_payment_numbers_enabled === true &&
    override?.mm_granted_by_admin == null
  ) {
    return "grant";
  }
  if (override?.vendor_off_platform_enabled === true && inTrial) return "trial";
  return "subscription";
}

async function resolveClientFallback(
  storeId: string,
  trialDays: number,
  storeCreatedAt: string | null | undefined,
  override: any,
): Promise<OffPlatformAccess> {
  const meta = buildTrialMeta(storeCreatedAt, trialDays);
  const now = Date.now();

  if (
    override?.mm_granted_by_admin === true &&
    override?.vendor_custom_payment_numbers_enabled === true
  ) {
    return {
      allowed: true,
      reason: "grant",
      trialEndsAt: meta.trialEndsAt,
      trialDays,
      daysLeft: meta.daysLeft,
    };
  }

  const { data: subs } = await (supabase as any)
    .from("store_package_subscriptions")
    .select("paid_until, is_active, service_packages!inner(slug)")
    .eq("store_id", storeId)
    .eq("is_active", true)
    .eq("service_packages.slug", "vendor_mm_numbers")
    .limit(1);

  const sub = subs?.[0];
  if (sub?.is_active && !(sub.paid_until && new Date(sub.paid_until).getTime() <= now)) {
    return {
      allowed: true,
      reason: "subscription",
      trialEndsAt: meta.trialEndsAt,
      trialDays,
      daysLeft: meta.daysLeft,
    };
  }

  if (override?.vendor_off_platform_enabled === true && meta.inTrial) {
    return {
      allowed: true,
      reason: "trial",
      trialEndsAt: meta.trialEndsAt,
      trialDays,
      daysLeft: meta.daysLeft,
    };
  }

  if (
    override?.vendor_custom_payment_numbers_enabled === true &&
    override?.mm_granted_by_admin == null
  ) {
    return {
      allowed: true,
      reason: "grant",
      trialEndsAt: meta.trialEndsAt,
      trialDays,
      daysLeft: meta.daysLeft,
    };
  }

  return {
    allowed: false,
    reason: "denied",
    trialEndsAt: meta.trialEndsAt,
    trialDays,
    daysLeft: meta.daysLeft,
  };
}

export async function resolveOffPlatformAccess(storeId: string): Promise<OffPlatformAccess> {
  const trialDays = await fetchTrialDays();

  const [{ data: store }, { data: override }] = await Promise.all([
    supabase.from("stores").select("created_at").eq("id", storeId).maybeSingle(),
    (supabase as any)
      .from("vendor_pricing_overrides")
      .select(
        "vendor_custom_payment_numbers_enabled, mm_granted_by_admin, vendor_off_platform_enabled",
      )
      .eq("store_id", storeId)
      .maybeSingle(),
  ]);

  const meta = buildTrialMeta(store?.created_at, trialDays);

  const { data: allowedRpc, error: rpcErr } = await (supabase as any).rpc(
    "store_off_platform_numbers_allowed",
    { p_store_id: storeId },
  );

  if (rpcErr) {
    return resolveClientFallback(storeId, trialDays, store?.created_at, override);
  }

  const allowed = allowedRpc === true;
  return {
    allowed,
    reason: classifyReason(override, meta.inTrial, allowed),
    trialEndsAt: meta.trialEndsAt,
    trialDays,
    daysLeft: meta.daysLeft,
  };
}

export function useVendorOffPlatformAccess(storeId: string | undefined) {
  return useQuery({
    queryKey: ["vendor-off-platform-access", storeId],
    queryFn: () => resolveOffPlatformAccess(storeId!),
    enabled: !!storeId,
    staleTime: 30_000,
  });
}
