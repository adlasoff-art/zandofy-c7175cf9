

## Plan: Transaction Fee %, CMS Topbar Sync, Trend Tags Confirmation

### Summary

Three changes:
1. **Add a transaction fee % field** (default 5%) to the pricing calculator. The new formula becomes: `effective_cost = cost_calc + (cost_calc * transaction_fee_pct / 100)`, then apply the existing margin/multiplier on `effective_cost` instead of raw `cost_calc`.
2. **Sync CMS topbar texts** with the Header. Currently, `TextsTab` saves to `platform_settings.cms_texts` but `I18nContext` never reads from it -- it uses hardcoded translations. Fix: load `cms_texts` from DB in `I18nProvider` and override the static translations.
3. **Trend tags admin/vendor** -- already implemented in previous work (TrendTagsTab in CMS + vendor dropdown). Confirm functional.

---

### 1. Transaction Fee % in Pricing

**SQL Migration** (manual copy for production):
```sql
-- Add transaction_fee_pct to platform_settings pricing_defaults
-- No schema change needed -- it's a JSON field in platform_settings.
-- Just ensure the pricing_defaults row includes transaction_fee_pct: 5

-- Add column to products for per-product override tracking (optional but useful)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS transaction_fee_pct numeric(5,2);
```

**Files to modify:**

- **`frontend/src/lib/pricing-utils.ts`**: Update `calculateSalePrice` to accept `transactionFeePct` param. New formula:
  ```
  effectiveCost = costCalc + (costCalc * transactionFeePct / 100)
  salePrice = effectiveCost + (effectiveCost * marginPct / 100) * multiplier + vendorExtra
  ```

- **`frontend/src/components/vendor/PricingCalculator.tsx`**:
  - Load `transaction_fee_pct` from `platform_settings.pricing_defaults` (default 5).
  - Display it as a read-only field (admin-only, vendor cannot change).
  - Show the effective cost (cost_calc + fee) in the preview.
  - Pass the fee to `calculateSalePrice`.

- **`frontend/src/pages/admin/AdminVendorPricingPage.tsx`**: Add editable `transaction_fee_pct` field in global pricing defaults section so admin can change from 5% to any value.

### 2. CMS Topbar Texts Sync

**File to modify:**

- **`frontend/src/contexts/I18nContext.tsx`**:
  - In `I18nProvider`, fetch `platform_settings` where `key = 'cms_texts'`.
  - Override the static `translations` map with DB values for matching keys (by locale).
  - Store overrides in state so `t()` function checks DB values first.

No migration needed -- `platform_settings` table and `cms_texts` key already exist.

### 3. Trend Tags -- Already Done

The `TrendTagsTab` component exists in CMS, and `VendorProductManager` has the trend tag dropdown. No additional work needed.

---

### SQL Migration to Copy Manually

```sql
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS transaction_fee_pct numeric(5,2);
```

That's the only schema change. The `transaction_fee_pct` default value (5%) lives in `platform_settings.pricing_defaults` JSON.

---

### Files Changed (4 files)

| File | Change |
|------|--------|
| `frontend/src/lib/pricing-utils.ts` | Add `transactionFeePct` param to `calculateSalePrice` |
| `frontend/src/components/vendor/PricingCalculator.tsx` | Load and display transaction fee %, pass to formula |
| `frontend/src/pages/admin/AdminVendorPricingPage.tsx` | Add transaction fee % field in global settings |
| `frontend/src/contexts/I18nContext.tsx` | Load CMS texts from DB and override static translations |

