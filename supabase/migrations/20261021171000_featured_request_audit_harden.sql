-- Purpose: harden featured relaunch/extend after senior audit.
-- Fixes: store ownership on INSERT, extend target spoofing, manager RLS,
--        atomic admin review (no orphan placement / double-extend),
--        duration bounds, product_ids must belong to store.
-- Tables: featured_placement_requests, featured_placements
-- Depends on: 20261021160000_featured_request_relaunch_extend.sql
-- Risk: additive policies/trigger/RPC; ~4000+ users unaffected unless they
--       abuse cross-store IDs (those inserts will now fail — intended).

-- ─── Integrity constraints ─────────────────────────────────────
-- Normalize legacy outliers before CHECK (idempotent, non-destructive clamp)
UPDATE public.featured_placement_requests
SET desired_duration_days = LEAST(GREATEST(COALESCE(desired_duration_days, 7), 1), 90)
WHERE desired_duration_days IS NULL
   OR desired_duration_days < 1
   OR desired_duration_days > 90;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'featured_placement_requests_duration_check'
  ) THEN
    ALTER TABLE public.featured_placement_requests
      ADD CONSTRAINT featured_placement_requests_duration_check
      CHECK (
        desired_duration_days IS NULL
        OR (desired_duration_days >= 1 AND desired_duration_days <= 90)
      );
  END IF;
END $$;

-- Extend must point at a placement; relaunch should reference a parent
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'featured_placement_requests_action_shape_check'
  ) THEN
    ALTER TABLE public.featured_placement_requests
      ADD CONSTRAINT featured_placement_requests_action_shape_check
      CHECK (
        (action_type = 'extend' AND target_placement_id IS NOT NULL)
        OR (action_type = 'relaunch' AND parent_request_id IS NOT NULL)
        OR (action_type = 'new' AND target_placement_id IS NULL)
        OR (action_type IS NULL)
      );
  END IF;
END $$;

-- ─── Validate vendor inserts (anti-spoof) ──────────────────────
CREATE OR REPLACE FUNCTION public.validate_featured_placement_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_placement_store uuid;
  v_parent_store uuid;
  v_bad_products int;
BEGIN
  IF NEW.desired_duration_days IS NOT NULL
     AND (NEW.desired_duration_days < 1 OR NEW.desired_duration_days > 90) THEN
    RAISE EXCEPTION 'desired_duration_days must be between 1 and 90';
  END IF;

  IF NEW.action_type = 'extend' THEN
    IF NEW.target_placement_id IS NULL THEN
      RAISE EXCEPTION 'extend requires target_placement_id';
    END IF;
    SELECT store_id INTO v_placement_store
    FROM public.featured_placements
    WHERE id = NEW.target_placement_id;
    IF v_placement_store IS NULL THEN
      RAISE EXCEPTION 'target placement missing or not linked to a store';
    END IF;
    IF v_placement_store <> NEW.store_id THEN
      RAISE EXCEPTION 'cannot extend a placement that does not belong to this store';
    END IF;
  END IF;

  IF NEW.action_type = 'relaunch' THEN
    IF NEW.parent_request_id IS NULL THEN
      RAISE EXCEPTION 'relaunch requires parent_request_id';
    END IF;
    SELECT store_id INTO v_parent_store
    FROM public.featured_placement_requests
    WHERE id = NEW.parent_request_id;
    IF v_parent_store IS NULL THEN
      RAISE EXCEPTION 'parent request not found';
    END IF;
    IF v_parent_store <> NEW.store_id THEN
      RAISE EXCEPTION 'cannot relaunch a request from another store';
    END IF;
  END IF;

  IF COALESCE(NEW.request_type, 'product') = 'product'
     AND NEW.action_type IS DISTINCT FROM 'extend'
     AND NEW.product_ids IS NOT NULL
     AND cardinality(NEW.product_ids) > 0 THEN
    SELECT COUNT(*)::int INTO v_bad_products
    FROM unnest(NEW.product_ids) AS pid
    WHERE NOT EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = pid AND p.store_id = NEW.store_id
    );
    IF v_bad_products > 0 THEN
      RAISE EXCEPTION 'product_ids must belong to the requesting store';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_featured_placement_request ON public.featured_placement_requests;
CREATE TRIGGER trg_validate_featured_placement_request
  BEFORE INSERT OR UPDATE OF store_id, action_type, target_placement_id, parent_request_id, product_ids, desired_duration_days, request_type
  ON public.featured_placement_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_featured_placement_request();

-- ─── RLS: store team + manager parity with RoleGuard ───────────
DROP POLICY IF EXISTS "Vendors create requests" ON public.featured_placement_requests;
CREATE POLICY "Vendors create requests"
  ON public.featured_placement_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = requested_by
    AND public.can_access_store_orders(auth.uid(), store_id)
  );

DROP POLICY IF EXISTS "Vendors see own requests" ON public.featured_placement_requests;
CREATE POLICY "Vendors see own requests"
  ON public.featured_placement_requests
  FOR SELECT
  TO authenticated
  USING (
    requested_by = auth.uid()
    OR public.can_access_store_orders(auth.uid(), store_id)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  );

DROP POLICY IF EXISTS "Admins manage placement requests" ON public.featured_placement_requests;
CREATE POLICY "Admins manage placement requests"
  ON public.featured_placement_requests
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  );

DROP POLICY IF EXISTS "Admins manage featured placements" ON public.featured_placements;
CREATE POLICY "Admins manage featured placements"
  ON public.featured_placements
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
  );

-- ─── Atomic admin review RPC ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_review_featured_placement_request(
  p_request_id uuid,
  p_status text,
  p_admin_notes text DEFAULT NULL,
  p_price_quoted numeric DEFAULT NULL,
  p_create_placement boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_req public.featured_placement_requests%ROWTYPE;
  v_placement public.featured_placements%ROWTYPE;
  v_days int;
  v_from timestamptz;
  v_new_end timestamptz;
  v_start timestamptz;
  v_end timestamptz;
  v_first_product uuid;
  v_is_custom boolean;
  v_new_placement_id uuid;
BEGIN
  IF v_uid IS NULL
     OR NOT (
       public.has_role(v_uid, 'admin'::public.app_role)
       OR public.has_role(v_uid, 'manager'::public.app_role)
     ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;

  SELECT * INTO v_req
  FROM public.featured_placement_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'request not found';
  END IF;

  IF v_req.status IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'already_reviewed',
      'status', v_req.status
    );
  END IF;

  v_days := COALESCE(NULLIF(v_req.desired_duration_days, 0), 7);
  IF v_days < 1 THEN v_days := 7; END IF;
  IF v_days > 90 THEN v_days := 90; END IF;

  IF p_status = 'approved' AND COALESCE(v_req.action_type, 'new') = 'extend' THEN
    IF v_req.target_placement_id IS NULL THEN
      RAISE EXCEPTION 'extend request missing target_placement_id';
    END IF;

    SELECT * INTO v_placement
    FROM public.featured_placements
    WHERE id = v_req.target_placement_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'target placement not found';
    END IF;

    IF v_placement.store_id IS DISTINCT FROM v_req.store_id THEN
      RAISE EXCEPTION 'placement store mismatch';
    END IF;

    v_from := CASE
      WHEN v_placement.end_date > now() THEN v_placement.end_date
      ELSE now()
    END;
    v_new_end := v_from + make_interval(days => v_days);

    UPDATE public.featured_placements
    SET end_date = v_new_end,
        is_active = true,
        updated_at = now()
    WHERE id = v_placement.id;
  END IF;

  IF p_status = 'approved'
     AND COALESCE(v_req.action_type, 'new') <> 'extend'
     AND COALESCE(p_create_placement, false) THEN
    v_start := now();
    v_end := v_start + make_interval(days => v_days);
    v_is_custom := COALESCE(v_req.request_type, 'product') = 'custom';
    v_first_product := CASE
      WHEN NOT v_is_custom AND v_req.product_ids IS NOT NULL AND cardinality(v_req.product_ids) > 0
        THEN v_req.product_ids[1]
      ELSE NULL
    END;

    INSERT INTO public.featured_placements (
      placement_type,
      product_id,
      store_id,
      title,
      image_url,
      cta_text,
      cta_link,
      start_date,
      end_date,
      is_active,
      price_charged,
      created_by,
      source_request_id,
      sort_order
    ) VALUES (
      CASE WHEN v_is_custom THEN 'ad' ELSE 'product' END,
      v_first_product,
      v_req.store_id,
      CASE
        WHEN v_is_custom THEN left(COALESCE(NULLIF(v_req.message, ''), 'Annonce sponsorisée'), 80)
        ELSE (COALESCE(cardinality(v_req.product_ids), 1)::text || ' produit(s) — boutique')
      END,
      v_req.image_url,
      'Voir',
      CASE
        WHEN v_is_custom THEN v_req.internal_link
        WHEN v_first_product IS NOT NULL THEN '/product/' || v_first_product::text
        ELSE NULL
      END,
      v_start,
      v_end,
      true,
      COALESCE(p_price_quoted, 0),
      v_uid,
      v_req.id,
      0
    )
    RETURNING id INTO v_new_placement_id;
  END IF;

  UPDATE public.featured_placement_requests
  SET status = p_status,
      admin_notes = p_admin_notes,
      price_quoted = p_price_quoted,
      reviewed_by = v_uid,
      reviewed_at = now(),
      updated_at = now()
  WHERE id = v_req.id;

  RETURN jsonb_build_object(
    'ok', true,
    'status', p_status,
    'placement_id', v_new_placement_id,
    'extended_end', v_new_end
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_review_featured_placement_request(uuid, text, text, numeric, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_review_featured_placement_request(uuid, text, text, numeric, boolean) TO authenticated;

COMMENT ON FUNCTION public.admin_review_featured_placement_request IS
  'Admin/manager atomic review: approve/reject, optional placement create, extend end_date';
