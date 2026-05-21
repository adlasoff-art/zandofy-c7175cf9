-- ============================================================================
-- Phase 10.5 — Lot A (operator role backfill + archive) + Lot B (pickup_code)
-- ============================================================================

-- Lot A.3 — Backfill rôle 'operator' pour propriétaires existants
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT do_.owner_user_id, 'operator'::app_role
FROM public.delivery_operators do_
WHERE do_.owner_user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = do_.owner_user_id AND ur.role = 'operator'::app_role
  );

-- Lot A.5 — Archivage des opérateurs
ALTER TABLE public.delivery_operators
  ADD COLUMN IF NOT EXISTS archived_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS archived_by uuid NULL,
  ADD COLUMN IF NOT EXISTS archive_reason text NULL;

CREATE INDEX IF NOT EXISTS idx_delivery_operators_archived
  ON public.delivery_operators (archived_at) WHERE archived_at IS NULL;

-- Recreate v_active_operators_by_city (mêmes colonnes qu'avant + filtre archived_at)
DROP VIEW IF EXISTS public.v_active_operators_by_city CASCADE;

CREATE VIEW public.v_active_operators_by_city
WITH (security_invoker = true)
AS
SELECT
  o.id              AS operator_id,
  o.company_name,
  o.logo_url,
  o.rating_avg,
  o.total_deliveries,
  o.is_platform_owned,
  c.country_code,
  c.city,
  ( SELECT min(r.base_price + COALESCE(r.surcharge, 0::numeric))
      FROM public.delivery_operator_rates r
     WHERE r.operator_id = o.id
       AND r.country_code = c.country_code
       AND r.city = c.city
       AND r.is_active = true
       AND r.status = 'approved'::text ) AS min_fee_preview,
  ( SELECT min(r.estimated_minutes)
      FROM public.delivery_operator_rates r
     WHERE r.operator_id = o.id
       AND r.country_code = c.country_code
       AND r.city = c.city
       AND r.is_active = true
       AND r.status = 'approved'::text ) AS min_eta_minutes
FROM public.delivery_operators o
JOIN public.delivery_operator_cities c ON c.operator_id = o.id
WHERE o.is_active = true
  AND o.archived_at IS NULL
  AND o.status = 'approved'::text
  AND c.is_active = true
  AND EXISTS (
    SELECT 1 FROM public.delivery_operator_rates r
    WHERE r.operator_id = o.id
      AND r.country_code = c.country_code
      AND r.city = c.city
      AND r.is_active = true
      AND r.status = 'approved'::text
  );

GRANT SELECT ON public.v_active_operators_by_city TO authenticated, anon;

-- Lot B.1 — Pickup code colonnes
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS pickup_code              text NULL,
  ADD COLUMN IF NOT EXISTS pickup_code_generated_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS pickup_code_verified_at  timestamptz NULL,
  ADD COLUMN IF NOT EXISTS pickup_verified_by       uuid NULL;

CREATE INDEX IF NOT EXISTS idx_orders_pickup_code
  ON public.orders (pickup_code) WHERE pickup_code IS NOT NULL;

-- Lot B.2 — Trigger generation
CREATE OR REPLACE FUNCTION public.generate_order_pickup_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_attempts int := 0;
BEGIN
  IF NEW.status IN ('ready_for_pickup', 'arrived_at_hub', 'at_hub')
     AND (OLD.status IS DISTINCT FROM NEW.status)
     AND NEW.pickup_code IS NULL THEN
    LOOP
      v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.orders
        WHERE pickup_code = v_code AND pickup_code_verified_at IS NULL
      );
      v_attempts := v_attempts + 1;
      IF v_attempts > 20 THEN EXIT; END IF;
    END LOOP;
    NEW.pickup_code := v_code;
    NEW.pickup_code_generated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_generate_pickup_code ON public.orders;
CREATE TRIGGER trg_generate_pickup_code
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_order_pickup_code();

-- Lot B.4 — RPC fetch pickup_code (autorisation stricte)
CREATE OR REPLACE FUNCTION public.get_pickup_code_for_order(_order_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_operator_id uuid;
  v_rider_id uuid;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT pickup_code, delivery_operator_id, rider_id
    INTO v_code, v_operator_id, v_rider_id
  FROM public.orders WHERE id = _order_id;

  IF v_code IS NULL THEN RETURN NULL; END IF;

  IF public.has_role(v_uid, 'admin'::app_role)
     OR public.has_role(v_uid, 'manager'::app_role)
     OR public.has_role(v_uid, 'shipper'::app_role)
     OR v_rider_id = v_uid
     OR EXISTS (
       SELECT 1 FROM public.delivery_operators
       WHERE id = v_operator_id AND owner_user_id = v_uid
     )
  THEN
    RETURN v_code;
  END IF;

  RAISE EXCEPTION 'Not authorized to view pickup code';
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pickup_code_for_order(uuid) TO authenticated;

-- Lot B.4b — RPC verify pickup_code
CREATE OR REPLACE FUNCTION public.verify_order_pickup_code(_order_id uuid, _code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_stored text;
  v_rider_id uuid;
  v_operator_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT pickup_code, rider_id, delivery_operator_id
    INTO v_stored, v_rider_id, v_operator_id
  FROM public.orders WHERE id = _order_id FOR UPDATE;

  IF v_stored IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_code');
  END IF;

  IF NOT (
    v_rider_id = v_uid
    OR public.has_role(v_uid, 'admin'::app_role)
    OR public.has_role(v_uid, 'manager'::app_role)
    OR public.has_role(v_uid, 'shipper'::app_role)
    OR EXISTS (SELECT 1 FROM public.delivery_operators
               WHERE id = v_operator_id AND owner_user_id = v_uid)
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  IF v_stored <> _code THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  UPDATE public.orders
     SET pickup_code_verified_at = now(),
         pickup_verified_by = v_uid,
         status = CASE
                    WHEN status IN ('ready_for_pickup', 'arrived_at_hub', 'at_hub')
                    THEN 'picked_up_by_operator'
                    ELSE status
                  END
   WHERE id = _order_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_order_pickup_code(uuid, text) TO authenticated;