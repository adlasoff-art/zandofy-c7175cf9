-- Purpose: Restore vendor/admin ability to SELECT own stores (dashboard blank / "pas de boutique").
-- Likely cause: fragmented/missing stores SELECT policies after security hardenings +
--               impersonation SPA cache (hasLoadedRef) showing empty state.
-- Tables: stores (SELECT policies only)
-- Risk: low additive restore — no data mutation.
-- Staging → production: apply ASAP; smoke /vendor as owner + impersonation + admin store.
-- Rollback: DROP policies created below (prefer keep).

-- Ensure table grants (RLS still applies)
GRANT SELECT ON public.stores TO authenticated;
GRANT SELECT ON public.stores TO service_role;

-- Drop known legacy / partial SELECT policies so we rebuild one clear set
DROP POLICY IF EXISTS "Owner staff read full store" ON public.stores;
DROP POLICY IF EXISTS "Owner and admins read full store" ON public.stores;
DROP POLICY IF EXISTS "Collaborators read assigned stores" ON public.stores;
DROP POLICY IF EXISTS "Authenticated read stores" ON public.stores;
DROP POLICY IF EXISTS "Anon read stores" ON public.stores;
DROP POLICY IF EXISTS "Public read stores" ON public.stores;
DROP POLICY IF EXISTS "Store team read full store" ON public.stores;

-- Single permissive SELECT: owner OR active collab OR admin OR manager
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

COMMENT ON POLICY "Store team and staff read full store" ON public.stores IS
  'Vendor dashboard + impersonation + admin/manager ops. Public catalog stays on stores_public.';

-- Diagnostic helper (owner/staff): returns whether current JWT can see a store row
CREATE OR REPLACE FUNCTION public.debug_store_select_access(p_store_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owned int := 0;
  v_visible int := 0;
  v_roles text[] := ARRAY[]::text[];
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT COALESCE(array_agg(ur.role::text), ARRAY[]::text[])
  INTO v_roles
  FROM public.user_roles ur
  WHERE ur.user_id = v_uid;

  SELECT COUNT(*)::int INTO v_owned
  FROM public.stores s
  WHERE s.owner_id = v_uid;

  -- Count via invoker would need non-definer; here we report ownership truth
  SELECT COUNT(*)::int INTO v_visible
  FROM public.stores s
  WHERE s.owner_id = v_uid
     OR EXISTS (
       SELECT 1 FROM public.store_collaborators sc
       WHERE sc.store_id = s.id AND sc.user_id = v_uid AND sc.status = 'active'
     )
     OR public.has_role(v_uid, 'admin'::app_role)
     OR public.has_role(v_uid, 'manager'::app_role);

  RETURN jsonb_build_object(
    'ok', true,
    'auth_uid', v_uid,
    'roles', to_jsonb(v_roles),
    'owned_store_count', v_owned,
    'accessible_store_count', v_visible,
    'sample_store_id', p_store_id,
    'can_access_sample', CASE
      WHEN p_store_id IS NULL THEN NULL
      ELSE EXISTS (
        SELECT 1 FROM public.stores s
        WHERE s.id = p_store_id
          AND (
            s.owner_id = v_uid
            OR EXISTS (
              SELECT 1 FROM public.store_collaborators sc
              WHERE sc.store_id = s.id AND sc.user_id = v_uid AND sc.status = 'active'
            )
            OR public.has_role(v_uid, 'admin'::app_role)
            OR public.has_role(v_uid, 'manager'::app_role)
          )
      )
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.debug_store_select_access(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.debug_store_select_access(uuid) TO authenticated;
