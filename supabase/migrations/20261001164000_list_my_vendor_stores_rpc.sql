-- Purpose: Fail-closed vendor store list via SECURITY DEFINER (survives RLS policy drift).
-- Symptom: /vendor shows "Vous n'avez pas encore de boutique" while rows exist in stores.
-- Tables: stores, store_collaborators (read only)
-- Risk: low — RPC limited to auth.uid() owner/active-collab; no writes.
-- Staging → production: apply in SQL Editor; smoke /vendor as store owner.
-- Rollback: DROP FUNCTION public.list_my_vendor_stores();

-- ---------------------------------------------------------------------------
-- 1) Re-assert SELECT policy (idempotent — previous migration CREATE failed on re-run)
-- ---------------------------------------------------------------------------
GRANT SELECT ON public.stores TO authenticated;
GRANT SELECT ON public.stores TO service_role;

DROP POLICY IF EXISTS "Owner staff read full store" ON public.stores;
DROP POLICY IF EXISTS "Owner and admins read full store" ON public.stores;
DROP POLICY IF EXISTS "Collaborators read assigned stores" ON public.stores;
DROP POLICY IF EXISTS "Authenticated read stores" ON public.stores;
DROP POLICY IF EXISTS "Anon read stores" ON public.stores;
DROP POLICY IF EXISTS "Public read stores" ON public.stores;
DROP POLICY IF EXISTS "Store team read full store" ON public.stores;
DROP POLICY IF EXISTS "Store team and staff read full store" ON public.stores;

CREATE POLICY "Store team and staff read full store"
  ON public.stores
  FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.store_collaborators sc
      WHERE sc.store_id = stores.id
        AND sc.user_id = auth.uid()
        AND sc.status = 'active'
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  );

-- ---------------------------------------------------------------------------
-- 2) Primary load path for vendor dashboard (bypasses RLS as definer)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_my_vendor_stores()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_rows jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated', 'stores', '[]'::jsonb);
  END IF;

  SELECT COALESCE(
    jsonb_agg(to_jsonb(t) ORDER BY t.created_at ASC NULLS LAST),
    '[]'::jsonb
  )
  INTO v_rows
  FROM (
    SELECT
      s.id,
      s.name,
      s.logo_url,
      s.banner_url,
      s.country,
      s.country_code,
      s.city_id,
      s.default_commercial_scope,
      s.products_count,
      s.followers_count,
      s.whatsapp_number,
      s.pending_name,
      s.name_change_status,
      s.can_create_coupons,
      s.collaborators_enabled,
      s.is_suspended,
      s.is_banned,
      s.deleted_at,
      s.suspension_reason,
      s.ban_reason,
      s.delete_reason,
      s.suspended_activities,
      s.is_platform_owned,
      s.shop_type,
      s.max_collaborators_override,
      s.owner_id,
      s.created_at,
      (s.owner_id = v_uid) AS is_owner
    FROM public.stores s
    WHERE s.owner_id = v_uid
       OR EXISTS (
         SELECT 1
         FROM public.store_collaborators sc
         WHERE sc.store_id = s.id
           AND sc.user_id = v_uid
           AND sc.status = 'active'
       )
  ) t;

  RETURN jsonb_build_object(
    'ok', true,
    'auth_uid', v_uid,
    'count', jsonb_array_length(v_rows),
    'stores', v_rows
  );
END;
$$;

COMMENT ON FUNCTION public.list_my_vendor_stores() IS
  'Vendor dashboard store list for current JWT (owner or active collaborator). SECURITY DEFINER.';

REVOKE ALL ON FUNCTION public.list_my_vendor_stores() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_my_vendor_stores() TO authenticated;
