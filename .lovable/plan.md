

# Fix: GitHub Actions Edge Function Deployment Failure

## Problem Identified

Your GitHub Actions workflow fails at the **deploy step** (`exit code 1`) every time. The Node.js 20 message is just a warning — it's not the cause.

The **real cause** is a mismatch in `frontend/supabase/config.toml`: it declares a function `[functions.verify-confirmation-code]` (line 51-52), but **no directory `frontend/supabase/functions/verify-confirmation-code/` exists**. When `supabase functions deploy` runs, it tries to deploy all functions listed in config.toml, finds a missing one, and crashes with exit code 1 — blocking **all** deployments (including `keccel-cardpay`).

Additionally, the function `ai-recommendations` exists as a directory but has no config entry in `config.toml` — it won't deploy but won't cause a crash either.

## Fix (2 changes)

### 1. Remove phantom function from config.toml

Remove lines 51-52 from `frontend/supabase/config.toml`:
```toml
# DELETE these two lines:
[functions.verify-confirmation-code]
verify_jwt = false
```

### 2. Add missing config entries

Add config blocks for functions that exist as directories but aren't in config.toml:

```toml
[functions.keccel-cardpay]
verify_jwt = false

[functions.ai-recommendations]
verify_jwt = false
```

## Result

After these changes are pushed to GitHub, the workflow will:
- Link to your Supabase project successfully (assuming `SUPABASE_PROJECT_ID` and `SUPABASE_ACCESS_TOKEN` secrets are correct in GitHub)
- Deploy **all 18 edge functions** including `keccel-cardpay` with the fixed 25-char reference

## Files to Modify

- `frontend/supabase/config.toml` — remove `verify-confirmation-code` block, add `keccel-cardpay` and `ai-recommendations` blocks

