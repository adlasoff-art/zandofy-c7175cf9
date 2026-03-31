

# Fix: Keccel CardPay Reference Length (Max 25 Characters)

## Problem

The **deployed** edge function at `supabase/functions/keccel-cardpay/index.ts` (line 92) generates references like:
```
keccel_card_a73e4c42-1504-4d99-a3f8-3d1b70eb0450_1774888637574
```
That's ~65 characters. Keccel's Visa gateway rejects anything over **25 characters**, blocking OTP delivery and payment completion.

There is also a duplicate at `frontend/supabase/functions/keccel-cardpay/index.ts` (line 84) with a partial fix that still lacks a hard length cap.

## Root Cause

The reference concatenates `method` + full UUID `order.id` + full timestamp — no truncation applied.

## Fix (Both Files)

Replace the reference generation in **both** edge function copies with a deterministic, hard-capped 25-character reference:

```typescript
// Exactly 25 chars: "KC" (2) + uuid-based hex (23), sliced to guarantee max
const visaRef = `KC${crypto.randomUUID().replace(/-/g, "").toUpperCase().slice(0, 23)}`;
const reference = visaRef; // always exactly 25 chars
```

This uses `crypto.randomUUID()` (native in Deno), strips dashes, uppercases, and hard-slices to 23 chars after the `KC` prefix = **exactly 25 characters every time**.

## Files to Modify

1. **`supabase/functions/keccel-cardpay/index.ts`** (line 92) — the deployed version
2. **`frontend/supabase/functions/keccel-cardpay/index.ts`** (line 84) — the frontend copy

Both get the same fix. No migration needed — this is purely edge function logic.

## Verification

After deployment, every reference sent to `https://api.keccel.net/cardpay` will be exactly 25 alphanumeric characters (e.g., `KC8A3F7B1D2E4C6A9F0B3D5E7`), within Keccel's limit.

