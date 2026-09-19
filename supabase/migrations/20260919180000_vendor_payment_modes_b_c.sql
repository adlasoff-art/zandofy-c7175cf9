-- Purpose: Vendor payments waves B+C — application payment prefs, vendor mode RPC,
--          trial settings, preferred/QR payment numbers, manual channel stubs.
-- Tables: vendor_applications, vendor_pricing_overrides, store_payment_numbers, platform_settings
-- Rollback: DROP COLUMN payment_preferences; DROP FUNCTION vendor_update_payment_modes;
--           DROP COLUMN is_preferred, qr_image_url on store_payment_numbers (manual).

-- B1: payment preferences on vendor applications
ALTER TABLE public.vendor_applications
  ADD COLUMN IF NOT EXISTS payment_preferences jsonb
  DEFAULT '{"mobile_money": true, "card": true, "off_platform": false}'::jsonb;

COMMENT ON COLUMN public.vendor_applications.payment_preferences IS
  'Vendor onboarding choices: { mobile_money, card, off_platform } booleans';

-- C2: preferred number + QR on store payment numbers
ALTER TABLE public.store_payment_numbers
  ADD COLUMN IF NOT EXISTS is_preferred boolean NOT NULL DEFAULT false;

ALTER TABLE public.store_payment_numbers
  ADD COLUMN IF NOT EXISTS qr_image_url text;

COMMENT ON COLUMN public.store_payment_numbers.is_preferred IS
  'Preferred payout number shown first at checkout (one per store enforced in app)';
COMMENT ON COLUMN public.store_payment_numbers.qr_image_url IS
  'Optional QR image URL for off-platform payment display';

-- Unique preferred per store (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS store_payment_numbers_one_preferred_idx
  ON public.store_payment_numbers (store_id)
  WHERE is_preferred = true;

-- B3: vendor can update only payment mode flags on own store overrides
CREATE OR REPLACE FUNCTION public.vendor_update_payment_modes(
  p_store_id uuid,
  p_mobile_money boolean,
  p_card boolean,
  p_off_platform boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF NOT (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = p_store_id AND s.owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.store_collaborators sc
      WHERE sc.store_id = p_store_id AND sc.user_id = auth.uid() AND sc.status = 'active'
    )
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF NOT (COALESCE(p_mobile_money, false) OR COALESCE(p_card, false) OR COALESCE(p_off_platform, false)) THEN
    RAISE EXCEPTION 'at least one payment mode required';
  END IF;

  INSERT INTO public.vendor_pricing_overrides (
    store_id,
    vendor_mobile_money_enabled,
    vendor_card_enabled,
    vendor_off_platform_enabled,
    updated_at
  )
  VALUES (
    p_store_id,
    COALESCE(p_mobile_money, false),
    COALESCE(p_card, false),
    COALESCE(p_off_platform, false),
    now()
  )
  ON CONFLICT (store_id) DO UPDATE SET
    vendor_mobile_money_enabled = EXCLUDED.vendor_mobile_money_enabled,
    vendor_card_enabled = EXCLUDED.vendor_card_enabled,
    vendor_off_platform_enabled = EXCLUDED.vendor_off_platform_enabled,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_update_payment_modes(uuid, boolean, boolean, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_update_payment_modes(uuid, boolean, boolean, boolean) TO authenticated;

-- C0 / C1 / C3: seed settings (non-destructive merge via DO block)
DO $$
DECLARE
  v jsonb;
BEGIN
  -- vendor_monetization.off_platform_trial_days
  SELECT value INTO v FROM public.platform_settings WHERE key = 'vendor_monetization';
  IF v IS NULL THEN
    INSERT INTO public.platform_settings (key, value, updated_at)
    VALUES (
      'vendor_monetization',
      '{"mm_numbers_monthly_price_usd": 9.99, "off_platform_trial_days": 30}'::jsonb,
      now()
    )
    ON CONFLICT (key) DO NOTHING;
  ELSIF NOT (v ? 'off_platform_trial_days') THEN
    UPDATE public.platform_settings
    SET value = v || '{"off_platform_trial_days": 30}'::jsonb, updated_at = now()
    WHERE key = 'vendor_monetization';
  END IF;

  -- gateway_fees.card_fee_pct
  SELECT value INTO v FROM public.platform_settings WHERE key = 'gateway_fees';
  IF v IS NULL THEN
    INSERT INTO public.platform_settings (key, value, updated_at)
    VALUES (
      'gateway_fees',
      '{"mobile_money_fee_pct": 2.5, "card_fee_pct": 3.5}'::jsonb,
      now()
    )
    ON CONFLICT (key) DO NOTHING;
  ELSIF NOT (v ? 'card_fee_pct') THEN
    UPDATE public.platform_settings
    SET value = v || '{"card_fee_pct": 3.5}'::jsonb, updated_at = now()
    WHERE key = 'gateway_fees';
  END IF;

  -- C3: manual payout channels stubs (all disabled)
  INSERT INTO public.platform_settings (key, value, updated_at)
  VALUES (
    'manual_payout_channels',
    '{
      "western_union": {"enabled": false, "label": "Western Union"},
      "moneygram": {"enabled": false, "label": "MoneyGram"},
      "bank_transfer": {"enabled": false, "label": "Virement bancaire"},
      "visa_direct": {"enabled": false, "label": "Visa Direct"}
    }'::jsonb,
    now()
  )
  ON CONFLICT (key) DO NOTHING;
END $$;
