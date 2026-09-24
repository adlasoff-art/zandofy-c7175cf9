/**
 * Smoke checklists (manual / staging).
 * Untouchables: WhatsApp fail-closed, CMS landings RLS, VITE_* renames.
 *
 * Ops prerequisite (checkout sessions):
 * - Apply 20260924160000_checkout_sessions_and_group_policy.sql
 * - Apply 20260924170000_checkout_sessions_no_client_update.sql (no client UPDATE on sessions)
 * - Apply 20260924180000_group_checkout_default_multi_vendor.sql (default multi_vendor_ok)
 * - Redeploy Edge: kelpay-payment, kelpay-webhook, kelpay-check, keccel-cardpay
 */
export const PLATFORM_JOURNEYS_SMOKE = [
  "Auth phone signup (fluid) → session → banner asks for real email",
  "Attach real email → confirmation mail received → verify",
  "Cart with 2 platform stores (default multi_vendor_ok) → checkout OK if common MoMo/card",
  "Vendor sets solo_only → that store blocks group cart again",
  "Checkout mono-store MoMo → one order charged / confirmed",
  "Card return → cart cleared + success/tracking link",
  "Become vendor: KYC required server-side; payments tab deep-link works",
  "Vendor extras: activate from dashboard (free/paid)",
  "Chat mobile: Enter = newline; Send button only",
  "PWA update modal → clear caches → reload",
  "APK/TWA or /get-app download page loads",
] as const;

/** Checkout session epic (1 payment → N store orders). */
export const CHECKOUT_SESSION_SMOKE = [
  "Ops: migrations 24160000 + 24170000 + 24180000 applied (staging then prod)",
  "Default policy multi_vendor_ok on new + backfilled stores",
  "Mono-store MoMo legacy → 1 order pending (unchanged)",
  "Mono-store multi-origin → 1 MoMo PIN → 2 orders pending (same session)",
  "2 platform stores (default) + MoMo → 1 pay → 2 orders paid",
  "Vendor opt-out solo_only → cart CTA blocked when that store selected with another",
  "Local + intl both multi → 2 orders, freight per group, 1 charge",
  "Mix WA-only + MoMo store → blocked MIXED_PAYMENT_MODEL",
  "WhatsApp single store → fail-closed unchanged",
  "Webhook replay → confirm_checkout_session_payment idempotent",
  "Vendor A order list → never sees vendor B sibling order",
  "Checkout récap: sous-totaux par boutique + badge Local/Intl + 1 paiement N commandes",
  "Client dashboard → paiement groupé label when siblings share session",
  "RetryPaymentModal → charge amount = session sum",
] as const;
