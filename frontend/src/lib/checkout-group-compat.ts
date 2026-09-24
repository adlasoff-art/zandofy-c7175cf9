/**
 * Pure compatibility matrix for multi-store checkout sessions.
 * Mirror of RPC get_checkout_group_compat — keep rules in sync.
 */

export type GroupCheckoutPolicy = "solo_only" | "own_stores_only" | "multi_vendor_ok";

export type CheckoutPaymentFlags = {
  mobile_money: boolean;
  card: boolean;
  paypal: boolean;
  cod: boolean;
  /** Deferred vendor-collected: off_platform or whatsapp */
  off_platform: boolean;
  whatsapp: boolean;
};

export type CompatStoreInput = {
  id: string;
  owner_id: string;
  shop_type?: "local" | "international" | string | null;
  group_checkout_policy: GroupCheckoutPolicy;
  paymentFlags: CheckoutPaymentFlags;
};

export type CompatReasonCode =
  | "OK"
  | "EMPTY"
  | "SOLO_ONLY"
  | "OWN_STORES_MISMATCH"
  | "MULTI_VENDOR_REQUIRED"
  | "MIXED_PAYMENT_MODEL"
  | "NO_COMMON_PAYMENT_METHOD";

export type OnlineMethod = "mobile_money" | "card" | "paypal";
export type DeferredMethod = "off_platform" | "whatsapp" | "cod";

export type GroupCompatResult = {
  ok: boolean;
  reasonCode: CompatReasonCode;
  eligiblePaymentMethods: Array<OnlineMethod | DeferredMethod>;
  blockingStoreIds: string[];
  /** True when every store allows deferred-only (all deferred, no online) */
  allDeferred: boolean;
};

const ONLINE: OnlineMethod[] = ["mobile_money", "card", "paypal"];
const DEFERRED: DeferredMethod[] = ["off_platform", "whatsapp", "cod"];

function storeAllowsOnline(f: CheckoutPaymentFlags): boolean {
  return !!(f.mobile_money || f.card || f.paypal);
}

function storeAllowsDeferred(f: CheckoutPaymentFlags): boolean {
  return !!(f.off_platform || f.whatsapp || f.cod);
}

function isDeferredOnly(f: CheckoutPaymentFlags): boolean {
  return storeAllowsDeferred(f) && !storeAllowsOnline(f);
}

/**
 * Evaluate whether selected stores may share one checkout_session payment.
 */
export function evaluateGroupCheckout(stores: CompatStoreInput[]): GroupCompatResult {
  if (!stores.length) {
    return {
      ok: false,
      reasonCode: "EMPTY",
      eligiblePaymentMethods: [],
      blockingStoreIds: [],
      allDeferred: false,
    };
  }

  if (stores.length === 1) {
    const f = stores[0].paymentFlags;
    const methods: Array<OnlineMethod | DeferredMethod> = [];
    for (const m of ONLINE) if (f[m]) methods.push(m);
    for (const m of DEFERRED) if (f[m]) methods.push(m);
    return {
      ok: methods.length > 0,
      reasonCode: methods.length > 0 ? "OK" : "NO_COMMON_PAYMENT_METHOD",
      eligiblePaymentMethods: methods,
      blockingStoreIds: methods.length > 0 ? [] : [stores[0].id],
      allDeferred: isDeferredOnly(f),
    };
  }

  // Policy: any solo_only blocks multi-store
  const soloBlockers = stores.filter((s) => s.group_checkout_policy === "solo_only");
  if (soloBlockers.length > 0) {
    return {
      ok: false,
      reasonCode: "SOLO_ONLY",
      eligiblePaymentMethods: [],
      blockingStoreIds: soloBlockers.map((s) => s.id),
      allDeferred: false,
    };
  }

  // own_stores_only: all must share owner; any multi_vendor_ok with different owners still need mutual ok
  const owners = new Set(stores.map((s) => s.owner_id));
  const hasOwnOnly = stores.some((s) => s.group_checkout_policy === "own_stores_only");
  if (hasOwnOnly && owners.size > 1) {
    return {
      ok: false,
      reasonCode: "OWN_STORES_MISMATCH",
      eligiblePaymentMethods: [],
      blockingStoreIds: stores
        .filter((s) => s.group_checkout_policy === "own_stores_only")
        .map((s) => s.id),
      allDeferred: false,
    };
  }

  // Different owners: every store must be multi_vendor_ok
  if (owners.size > 1) {
    const notMulti = stores.filter((s) => s.group_checkout_policy !== "multi_vendor_ok");
    if (notMulti.length > 0) {
      return {
        ok: false,
        reasonCode: "MULTI_VENDOR_REQUIRED",
        eligiblePaymentMethods: [],
        blockingStoreIds: notMulti.map((s) => s.id),
        allDeferred: false,
      };
    }
  }

  // Mix deferred-only with online-capable → blocked
  const deferredOnly = stores.filter((s) => isDeferredOnly(s.paymentFlags));
  const onlineCapable = stores.filter((s) => storeAllowsOnline(s.paymentFlags));
  if (deferredOnly.length > 0 && onlineCapable.length > 0) {
    return {
      ok: false,
      reasonCode: "MIXED_PAYMENT_MODEL",
      eligiblePaymentMethods: [],
      blockingStoreIds: [...deferredOnly, ...onlineCapable].map((s) => s.id),
      allDeferred: false,
    };
  }

  // Intersection of payment methods
  const methods: Array<OnlineMethod | DeferredMethod> = [];
  for (const m of ONLINE) {
    if (stores.every((s) => s.paymentFlags[m])) methods.push(m);
  }
  for (const m of DEFERRED) {
    if (stores.every((s) => s.paymentFlags[m])) methods.push(m);
  }

  if (methods.length === 0) {
    return {
      ok: false,
      reasonCode: "NO_COMMON_PAYMENT_METHOD",
      eligiblePaymentMethods: [],
      blockingStoreIds: stores.map((s) => s.id),
      allDeferred: false,
    };
  }

  return {
    ok: true,
    reasonCode: "OK",
    eligiblePaymentMethods: methods,
    blockingStoreIds: [],
    allDeferred: methods.every((m) => DEFERRED.includes(m as DeferredMethod)),
  };
}

export function compatReasonMessageFr(code: CompatReasonCode): string {
  switch (code) {
    case "OK":
      return "";
    case "EMPTY":
      return "Aucun magasin sélectionné.";
    case "SOLO_ONLY":
      return "Une ou plusieurs boutiques n’autorisent pas les achats groupés. Décochez-les ou commandez séparément.";
    case "OWN_STORES_MISMATCH":
      return "Ces boutiques n’appartiennent pas au même vendeur. Commandez séparément.";
    case "MULTI_VENDOR_REQUIRED":
      return "Toutes les boutiques doivent autoriser les achats multi-vendeurs.";
    case "MIXED_PAYMENT_MODEL":
      return "Payez ces boutiques séparément (paiement différé et paiement en ligne incompatibles).";
    case "NO_COMMON_PAYMENT_METHOD":
      return "Aucun mode de paiement commun entre ces boutiques.";
    default:
      return "Sélection incompatible pour un paiement unique.";
  }
}
