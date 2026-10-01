-- Purpose: HOTFIX — restore stores/products visibility after RLS recursion outage.
--
-- AUDIT (2026-10-01) — root cause
-- -------------------------------
-- Symptom after 163000/164000/165000:
--   Admin: Tarification / Comptabilité / Abonnements / Modération → 0 boutiques
--   Vendor: catalogue vide / toast erreur / parfois 0 boutique
-- Data still present (COUNT(*) via service_role / SQL Editor OK).
--
-- Cause:
--   Policies on public.stores used INLINE:
--     EXISTS (SELECT 1 FROM store_collaborators sc WHERE ...)
--   But store_collaborators RLS does:
--     EXISTS (SELECT 1 FROM stores WHERE owner_id = auth.uid())
--   → infinite recursion when evaluating SELECT on stores (or products→stores).
--
--   Migration 165000 made products SELECT also inline-join stores + collaborators,
--   amplifying failures on catalogue / moderation.
--
-- Historical correct pattern (20260424012442 + can_access_store_orders):
--   SECURITY DEFINER helper bypasses RLS → no recursion.
--
-- Fix:
--   1) Re-assert can_access_store_orders as SECURITY DEFINER
--   2) stores SELECT = can_access_store_orders OR admin/manager
--   3) products SELECT (team) = can_access_store_orders(store_id)
--   Keep 165000 get_store_entitlements platform quota exemption as-is.
--
-- Risk: low — restores prior proven policy shape; no data mutation.
-- Staging → production: apply immediately; smoke admin pricing + /vendor catalogue.
-- Rollback: not recommended (would reintroduce recursion).

-- ---------------------------------------------------------------------------
-- 0) Diagnostic helper (JWT session — not SQL Editor anon)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.debug_rls_visibility()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_roles text[] := ARRAY[]::text[];
  v_stores_definer int := 0;
  v_stores_invoker int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT COALESCE(array_agg(ur.role::text), ARRAY[]::text[])
  INTO v_roles
  FROM public.user_roles ur
  WHERE ur.user_id = v_uid;

  SELECT COUNT(*)::int INTO v_stores_definer FROM public.stores;

  -- Invoker count via policy (may be 0 if still broken)
  BEGIN
    SELECT COUNT(*)::int INTO v_stores_invoker
    FROM public.stores s
    WHERE public.can_access_store_orders(v_uid, s.id)
       OR public.has_role(v_uid, 'admin'::app_role)
       OR public.has_role(v_uid, 'manager'::app_role);
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', false,
      'auth_uid', v_uid,
      'roles', to_jsonb(v_roles),
      'error', SQLERRM,
      'hint', 'RLS recursion or policy error'
    );
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'auth_uid', v_uid,
    'roles', to_jsonb(v_roles),
    'stores_total_definer', v_stores_definer,
    'stores_visible_via_helper', v_stores_invoker,
    'is_staff', (
      public.has_role(v_uid, 'admin'::app_role)
      OR public.has_role(v_uid, 'manager'::app_role)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.debug_rls_visibility() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.debug_rls_visibility() TO authenticated;

-- ---------------------------------------------------------------------------
-- 1) Re-assert SECURITY DEFINER helper (bypasses RLS — breaks recursion)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_access_store_orders(_user_id uuid, _store_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    _user_id IS NOT NULL
    AND _store_id IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM public.stores s
        WHERE s.id = _store_id AND s.owner_id = _user_id
      )
      OR EXISTS (
        SELECT 1 FROM public.store_collaborators sc
        WHERE sc.store_id = _store_id
          AND sc.user_id = _user_id
          AND sc.status = 'active'
      )
    );
$$;

COMMENT ON FUNCTION public.can_access_store_orders(uuid, uuid) IS
  'Owner or active collaborator. SECURITY DEFINER — safe inside RLS policies (no recursion).';

REVOKE ALL ON FUNCTION public.can_access_store_orders(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_store_orders(uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2) stores SELECT — proven pattern (no inline EXISTS on store_collaborators)
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
    public.can_access_store_orders(auth.uid(), id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  );

COMMENT ON POLICY "Store team and staff read full store" ON public.stores IS
  'Owner/collab via can_access_store_orders (SECURITY DEFINER) + admin/manager. Avoids RLS recursion.';

-- ---------------------------------------------------------------------------
-- 3) products SELECT — team path via same helper (keeps admin/manager policies)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Store owners read own products" ON public.products;
DROP POLICY IF EXISTS "Store team read own products" ON public.products;

CREATE POLICY "Store team read own products"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (public.can_access_store_orders(auth.uid(), store_id));

COMMENT ON POLICY "Store team read own products" ON public.products IS
  'Owner + active collab via can_access_store_orders. Staff use separate admin/manager policies.';
