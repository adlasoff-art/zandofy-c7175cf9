-- Purpose: Admin-gated cash payout for vendor wallet (default OFF).
-- Tables: platform_settings
-- Rollback: DELETE FROM platform_settings WHERE key = 'vendor_cash_payout_enabled';

INSERT INTO public.platform_settings (key, value, updated_at)
VALUES (
  'vendor_cash_payout_enabled',
  'false'::jsonb,
  now()
)
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE public.platform_settings IS
  'Platform JSON settings. vendor_cash_payout_enabled: when true, vendors may request cash payout.';
