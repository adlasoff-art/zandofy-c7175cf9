-- Purpose: Deferred KYB by delivered GMV + free vendor catalog defaults (Mois du CA W1).
-- Tables: platform_settings (kyb_settings, vendor_monetization), withdrawal_requests gate.
-- Functions: store_delivered_gmv, store_kyb_gate.
-- Risk (~4000+ users): Additive; withdrawals blocked only when GMV >= threshold and KYB not approved.
-- Staging → production: run in SQL Editor after review; then deploy frontend W1–W2.

-- ---------------------------------------------------------------------------
-- 1) Settings seeds
-- ---------------------------------------------------------------------------
INSERT INTO public.platform_settings (key, value, updated_at)
VALUES (
  'kyb_settings',
  jsonb_build_object(
    'threshold_local_usd', 200,
    'threshold_international_usd', 500,
    'soft_warn_ratio', 0.8
  ),
  now()
)
ON CONFLICT (key) DO UPDATE
SET value = COALESCE(public.platform_settings.value, '{}'::jsonb) || EXCLUDED.value,
    updated_at = now();

INSERT INTO public.platform_settings (key, value, updated_at)
VALUES (
  'vendor_monetization',
  jsonb_build_object(
    'free_max_products', 100,
    'free_max_promos', 10,
    'mm_numbers_monthly_price_usd', 9.99,
    'default_commission_pct', 10
  ),
  now()
)
ON CONFLICT (key) DO UPDATE
SET value = COALESCE(public.platform_settings.value, '{}'::jsonb) || EXCLUDED.value,
    updated_at = now();

-- Allow authenticated read of these keys if public allowlist pattern exists — best-effort
DO $$
BEGIN
  -- No-op if project uses open SELECT on platform_settings via RLS already.
  NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 2) Raise default free catalog cap for existing beginner rows still at 10
-- ---------------------------------------------------------------------------
UPDATE public.vendor_subscriptions
SET max_products = 100
WHERE COALESCE(tier, 'beginner') = 'beginner'
  AND COALESCE(max_products, 10) <= 10;

-- ---------------------------------------------------------------------------
-- 3) GMV helper (delivered orders only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.store_delivered_gmv(p_store_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(o.total), 0)::numeric
  FROM public.orders o
  WHERE o.store_id = p_store_id
    AND o.status = 'delivered';
$$;

COMMENT ON FUNCTION public.store_delivered_gmv(uuid) IS
  'Sum of delivered order totals for KYB threshold checks (USD-equivalent as stored).';

GRANT EXECUTE ON FUNCTION public.store_delivered_gmv(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4) KYB gate state for a store
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.store_kyb_gate(p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_type text;
  v_platform boolean;
  v_gmv numeric;
  v_settings jsonb;
  v_threshold numeric;
  v_ratio numeric;
  v_kyb_status text;
  v_required boolean;
  v_blocked boolean;
  v_soft boolean;
BEGIN
  IF p_store_id IS NULL THEN
    RETURN jsonb_build_object('exempt', true, 'required', false, 'blocked', false, 'soft_warn', false);
  END IF;

  SELECT COALESCE(s.shop_type, 'international'), COALESCE(s.is_platform_owned, false)
    INTO v_shop_type, v_platform
  FROM public.stores s
  WHERE s.id = p_store_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('exempt', true, 'required', false, 'blocked', false, 'soft_warn', false);
  END IF;

  IF v_platform THEN
    RETURN jsonb_build_object(
      'exempt', true,
      'required', false,
      'blocked', false,
      'soft_warn', false,
      'shop_type', v_shop_type,
      'gmv', 0,
      'threshold', 0,
      'kyb_status', null
    );
  END IF;

  SELECT value INTO v_settings
  FROM public.platform_settings
  WHERE key = 'kyb_settings';

  v_settings := COALESCE(v_settings, '{}'::jsonb);
  v_ratio := COALESCE((v_settings->>'soft_warn_ratio')::numeric, 0.8);
  IF v_shop_type = 'local' THEN
    v_threshold := COALESCE((v_settings->>'threshold_local_usd')::numeric, 200);
  ELSE
    v_threshold := COALESCE((v_settings->>'threshold_international_usd')::numeric, 500);
  END IF;

  v_gmv := public.store_delivered_gmv(p_store_id);

  SELECT ks.status INTO v_kyb_status
  FROM public.kyb_submissions ks
  WHERE ks.store_id = p_store_id
  ORDER BY ks.updated_at DESC NULLS LAST, ks.created_at DESC
  LIMIT 1;

  v_required := v_gmv >= v_threshold;
  v_blocked := v_required AND COALESCE(v_kyb_status, '') IS DISTINCT FROM 'approved';
  v_soft := (NOT v_blocked) AND v_gmv >= (v_threshold * v_ratio) AND COALESCE(v_kyb_status, '') IS DISTINCT FROM 'approved';

  RETURN jsonb_build_object(
    'exempt', false,
    'required', v_required,
    'blocked', v_blocked,
    'soft_warn', v_soft,
    'shop_type', v_shop_type,
    'gmv', v_gmv,
    'threshold', v_threshold,
    'kyb_status', v_kyb_status
  );
END;
$$;

COMMENT ON FUNCTION public.store_kyb_gate(uuid) IS
  'KYB requirement state: blocked when delivered GMV >= shop_type threshold and KYB not approved.';

GRANT EXECUTE ON FUNCTION public.store_kyb_gate(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5) Block new withdrawals when KYB gate blocked
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_kyb_before_withdrawal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gate jsonb;
BEGIN
  IF NEW.store_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_gate := public.store_kyb_gate(NEW.store_id);
  IF COALESCE((v_gate->>'blocked')::boolean, false) THEN
    RAISE EXCEPTION 'kyb_required_before_withdrawal'
      USING ERRCODE = '42501',
            HINT = 'Complete and get KYB approved after reaching the sales threshold before withdrawing.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_kyb_before_withdrawal ON public.withdrawal_requests;
CREATE TRIGGER trg_enforce_kyb_before_withdrawal
  BEFORE INSERT ON public.withdrawal_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_kyb_before_withdrawal();
