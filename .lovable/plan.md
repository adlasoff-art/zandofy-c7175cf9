

# Audit: Keccel CardPay Reference — Still Too Long

## Finding

The code in **both** files already contains the correct fix:

- `supabase/functions/keccel-cardpay/index.ts` line 92: `KC${crypto.randomUUID()...}` ✅
- `frontend/supabase/functions/keccel-cardpay/index.ts` line 84: `KC${crypto.randomUUID()...}` ✅

The reference `keccel_card_28cd06cb-7e4d-4caa-8bed-527604b40ed5_1774968197285` uses the **old** format that no longer exists in the current codebase. This means the **deployed** Edge Function hasn't been updated — the old code is still running in production.

## Root Cause

The fix was committed to the repository but **not redeployed**. The Supabase Edge Function running in production still uses the old code.

## What You Need To Do (Manual Steps)

Since the code is correct in GitHub, you need to **redeploy the Edge Function**:

### Option A — Via Supabase Dashboard (Vercel-linked project)
1. Go to your **Supabase project dashboard** (the one linked to your Vercel deployment, not Lovable Cloud)
2. Navigate to **Edge Functions**
3. Find `keccel-cardpay`
4. Redeploy it, or trigger a new deployment from the linked GitHub repo

### Option B — Via Supabase CLI
```bash
supabase functions deploy keccel-cardpay --project-ref YOUR_PROJECT_REF
```
Run this from the `frontend/` directory (where `frontend/supabase/functions/keccel-cardpay/` lives).

### Option C — Trigger via Git
If your Supabase project auto-deploys edge functions from GitHub pushes, make a small commit (e.g., add a comment) to `frontend/supabase/functions/keccel-cardpay/index.ts` and push to the branch that triggers deployment.

## Verification

After redeployment, test a card payment. The reference in the Keccel API request should look like `KC8A3F7B1D2E4C6A9F0B3D5E7` (exactly 25 characters), not the old `keccel_card_...` format.

## No Code Changes Needed

The fix is already in the codebase. This is purely a deployment issue.

