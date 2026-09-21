-- Purpose: WhatsApp as checkout payment method — additive vendor flag + RPC eligibility.
-- Tables: vendor_pricing_overrides (ADD COLUMN), RPCs get_checkout_vendor_payment_flags,
--         store_whatsapp_checkout_allowed (new).
-- Rollback: set vendor_whatsapp_enabled=false + CMS payment_methods.whatsapp=false
--           (do not DROP COLUMN without explicit human request).
-- Risk (~4000+ users): low — default false; mode invisible until admin enables.

-- ---------------------------------------------------------------------------
-- 1) Per-store opt-in for WhatsApp checkout (default OFF)
-- ---------------------------------------------------------------------------
ALTER TABLE public.vendor_pricing_overrides
  ADD COLUMN IF NOT EXISTS vendor_whatsapp_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.vendor_pricing_overrides.vendor_whatsapp_enabled IS
  'When true, store may offer WhatsApp as checkout payment_method (requires whatsapp_number + sub).';

-- ---------------------------------------------------------------------------
-- 2) Extend checkout payment flags RPC
-- PostgreSQL cannot change RETURNS TABLE OUT columns via CREATE OR REPLACE.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_checkout_vendor_payment_flags(uuid[]);

CREATE FUNCTION public.get_checkout_vendor_payment_flags(p_store_ids uuid[])
RETURNS TABLE (
  store_id uuid,
  vendor_cod_enabled boolean,
  vendor_off_platform_enabled boolean,
  vendor_mobile_money_enabled boolean,
  vendor_card_enabled boolean,
  vendor_whatsapp_enabled boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sid.id AS store_id,
    COALESCE(o.vendor_cod_enabled, false) AS vendor_cod_enabled,
    COALESCE(o.vendor_off_platform_enabled, false) AS vendor_off_platform_enabled,
    COALESCE(o.vendor_mobile_money_enabled, true) AS vendor_mobile_money_enabled,
    COALESCE(o.vendor_card_enabled, true) AS vendor_card_enabled,
    COALESCE(o.vendor_whatsapp_enabled, false) AS vendor_whatsapp_enabled
  FROM unnest(COALESCE(p_store_ids, ARRAY[]::uuid[])) AS sid(id)
  LEFT JOIN public.vendor_pricing_overrides o ON o.store_id = sid.id;
$$;

COMMENT ON FUNCTION public.get_checkout_vendor_payment_flags(uuid[]) IS
  'Checkout-safe payment mode flags per store. Defaults: MoMo/card on; COD/off-platform/whatsapp off.';

REVOKE ALL ON FUNCTION public.get_checkout_vendor_payment_flags(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_checkout_vendor_payment_flags(uuid[]) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Eligibility: override + normalized number + subscription not disabled
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.store_whatsapp_checkout_allowed(p_store_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled boolean := false;
  v_digits text;
  v_sub_enabled boolean;
BEGIN
  IF p_store_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT COALESCE(o.vendor_whatsapp_enabled, false)
  INTO v_enabled
  FROM public.vendor_pricing_overrides o
  WHERE o.store_id = p_store_id;

  IF NOT COALESCE(v_enabled, false) THEN
    RETURN false;
  END IF;

  -- Subscription kill-switch (same semantics as get-store-whatsapp EF)
  SELECT s.is_whatsapp_enabled
  INTO v_sub_enabled
  FROM public.vendor_subscriptions s
  WHERE s.store_id = p_store_id
  LIMIT 1;

  IF v_sub_enabled IS NOT NULL AND v_sub_enabled = false THEN
    RETURN false;
  END IF;

  SELECT regexp_replace(COALESCE(st.whatsapp_number, ''), '\D', '', 'g')
  INTO v_digits
  FROM public.stores st
  WHERE st.id = p_store_id;

  IF v_digits IS NULL OR length(v_digits) < 8 THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.store_whatsapp_checkout_allowed(uuid) IS
  'True when store may accept WhatsApp checkout: override on, sub not disabled, whatsapp_number valid.';

REVOKE ALL ON FUNCTION public.store_whatsapp_checkout_allowed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.store_whatsapp_checkout_allowed(uuid) TO anon, authenticated;

-- Batch helper for checkout (all stores must pass)
CREATE OR REPLACE FUNCTION public.get_checkout_whatsapp_allowed(p_store_ids uuid[])
RETURNS TABLE (
  store_id uuid,
  allowed boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    sid.id AS store_id,
    public.store_whatsapp_checkout_allowed(sid.id) AS allowed
  FROM unnest(COALESCE(p_store_ids, ARRAY[]::uuid[])) AS sid(id);
$$;

COMMENT ON FUNCTION public.get_checkout_whatsapp_allowed(uuid[]) IS
  'Per-store WhatsApp checkout eligibility for checkout intersection.';

REVOKE ALL ON FUNCTION public.get_checkout_whatsapp_allowed(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_checkout_whatsapp_allowed(uuid[]) TO anon, authenticated;

-- Ensure CMS key exists with whatsapp default false (do not wipe other keys)
UPDATE public.platform_settings
SET
  value = COALESCE(value, '{}'::jsonb) || jsonb_build_object('whatsapp', false),
  updated_at = now()
WHERE key = 'payment_methods'
  AND (value IS NULL OR NOT (value ? 'whatsapp'));

INSERT INTO public.platform_settings (key, value, updated_at)
SELECT
  'payment_methods',
  '{"mobile_money": true, "stripe": true, "cod": true, "off_platform": true, "paypal": true, "whatsapp": false}'::jsonb,
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.platform_settings WHERE key = 'payment_methods'
);
