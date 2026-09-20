/**
 * Country → MoMo gateway router (KelPay default, PawaPay when CMS-enabled).
 * @see docs/DISCOVERY_MOBILE_HANDOFF.md
 */

export type MomoGatewayId = "kelpay" | "pawapay";

export type PaymentGatewaysConfig = {
  default_momo: MomoGatewayId;
  by_country: Record<string, MomoGatewayId>;
  pawapay: { enabled: boolean };
};

export const PAYMENT_GATEWAYS_DEFAULTS: PaymentGatewaysConfig = {
  default_momo: "kelpay",
  by_country: { CD: "kelpay" },
  pawapay: { enabled: false },
};

export function normalizePaymentGateways(raw: unknown): PaymentGatewaysConfig {
  const d = PAYMENT_GATEWAYS_DEFAULTS;
  if (!raw || typeof raw !== "object") return { ...d, by_country: { ...d.by_country }, pawapay: { ...d.pawapay } };
  const v = raw as Partial<PaymentGatewaysConfig>;
  const by: Record<string, MomoGatewayId> = { ...d.by_country };
  if (v.by_country && typeof v.by_country === "object") {
    for (const [k, val] of Object.entries(v.by_country)) {
      const code = k.toUpperCase();
      if (val === "kelpay" || val === "pawapay") by[code] = val;
    }
  }
  return {
    default_momo: v.default_momo === "pawapay" ? "pawapay" : "kelpay",
    by_country: by,
    pawapay: { enabled: v.pawapay?.enabled === true },
  };
}

/**
 * Resolve MoMo gateway for a shipping/buyer country.
 * PawaPay only when enabled in CMS; otherwise always KelPay.
 */
export function resolveMomoGateway(
  countryCode: string | null | undefined,
  config?: Partial<PaymentGatewaysConfig> | null,
): MomoGatewayId {
  const cfg = normalizePaymentGateways(config || null);
  const code = (countryCode || "").toUpperCase();
  const mapped = code ? cfg.by_country[code] : undefined;
  const candidate = mapped || cfg.default_momo;
  if (candidate === "pawapay" && !cfg.pawapay.enabled) return "kelpay";
  return candidate;
}

/** Map discovery payment_prefs to checkout PaymentMethod ids. */
export function discoveryPrefToCheckoutMethod(
  pref: string,
): "mobile_money" | "card" | "off_platform" | null {
  if (pref === "mobile_money") return "mobile_money";
  if (pref === "card") return "card";
  if (pref === "off_platform") return "off_platform";
  return null;
}
