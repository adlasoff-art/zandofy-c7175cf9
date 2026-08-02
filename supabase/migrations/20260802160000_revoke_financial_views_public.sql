-- Purpose: remove public access to SECURITY DEFINER financial aggregate views.
-- Already applied manually on production; safe to re-run (idempotent grants).
-- Tables/views: v_vendor_revenue_by_method, v_vendor_wallet_summary, v_platform_financial_summary.
-- Rollback: GRANT SELECT (and other needed privs) TO anon, authenticated — not recommended.

DO $$
DECLARE
  v text;
BEGIN
  FOREACH v IN ARRAY ARRAY[
    'v_vendor_revenue_by_method',
    'v_vendor_wallet_summary',
    'v_platform_financial_summary'
  ]
  LOOP
    IF to_regclass('public.' || v) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', v);
      EXECUTE format('GRANT SELECT ON TABLE public.%I TO service_role', v);
    END IF;
  END LOOP;
END $$;
