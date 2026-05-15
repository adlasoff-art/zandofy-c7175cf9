-- =====================================================================
-- Zandofy — Fix RLS flotte opérateur
-- Erreur ciblée : permission denied for function is_operator_owner
-- Operator ID de vérification : abbbc968-1180-4b07-86d7-4ceaaf274a8e
-- Idempotent : peut être rejoué en staging puis production.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1) Fonctions helper RLS en SECURITY DEFINER
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_operator_owner(_uid uuid, _operator_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.delivery_operators
    WHERE id = _operator_id
      AND owner_user_id = _uid
  );
$$;

CREATE OR REPLACE FUNCTION public.is_operator_rider(_uid uuid, _operator_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.delivery_operator_riders
    WHERE rider_user_id = _uid
      AND operator_id = _operator_id
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.user_owns_any_operator(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.delivery_operators
    WHERE owner_user_id = _uid
  );
$$;

-- Retirer l'accès public implicite puis accorder explicitement aux rôles utiles.
REVOKE ALL ON FUNCTION public.is_operator_owner(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_operator_rider(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_owns_any_operator(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_operator_owner(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_operator_rider(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_owns_any_operator(uuid) TO authenticated, service_role;

-- Préventif : les policies utilisent aussi has_role().
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- ---------------------------------------------------------------------
-- 2) RLS delivery_operator_riders
-- ---------------------------------------------------------------------
ALTER TABLE public.delivery_operator_riders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "op_riders_select_owner" ON public.delivery_operator_riders;
DROP POLICY IF EXISTS "op_riders_select_self" ON public.delivery_operator_riders;
DROP POLICY IF EXISTS "op_riders_select_staff" ON public.delivery_operator_riders;
DROP POLICY IF EXISTS "op_riders_update_owner" ON public.delivery_operator_riders;
DROP POLICY IF EXISTS "op_riders_update_staff" ON public.delivery_operator_riders;

CREATE POLICY "op_riders_select_owner"
  ON public.delivery_operator_riders
  FOR SELECT
  TO authenticated
  USING (public.is_operator_owner(auth.uid(), operator_id));

CREATE POLICY "op_riders_select_self"
  ON public.delivery_operator_riders
  FOR SELECT
  TO authenticated
  USING (rider_user_id = auth.uid());

CREATE POLICY "op_riders_select_staff"
  ON public.delivery_operator_riders
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "op_riders_update_owner"
  ON public.delivery_operator_riders
  FOR UPDATE
  TO authenticated
  USING (public.is_operator_owner(auth.uid(), operator_id))
  WITH CHECK (public.is_operator_owner(auth.uid(), operator_id));

CREATE POLICY "op_riders_update_staff"
  ON public.delivery_operator_riders
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- ---------------------------------------------------------------------
-- 3) RLS delivery_operator_rider_invites
-- ---------------------------------------------------------------------
ALTER TABLE public.delivery_operator_rider_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rider_invites_select_owner" ON public.delivery_operator_rider_invites;
DROP POLICY IF EXISTS "rider_invites_select_staff" ON public.delivery_operator_rider_invites;
DROP POLICY IF EXISTS "rider_invites_update_owner" ON public.delivery_operator_rider_invites;
DROP POLICY IF EXISTS "rider_invites_update_staff" ON public.delivery_operator_rider_invites;

CREATE POLICY "rider_invites_select_owner"
  ON public.delivery_operator_rider_invites
  FOR SELECT
  TO authenticated
  USING (public.is_operator_owner(auth.uid(), operator_id));

CREATE POLICY "rider_invites_select_staff"
  ON public.delivery_operator_rider_invites
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "rider_invites_update_owner"
  ON public.delivery_operator_rider_invites
  FOR UPDATE
  TO authenticated
  USING (public.is_operator_owner(auth.uid(), operator_id))
  WITH CHECK (public.is_operator_owner(auth.uid(), operator_id));

CREATE POLICY "rider_invites_update_staff"
  ON public.delivery_operator_rider_invites
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

COMMIT;

-- =====================================================================
-- VÉRIFICATIONS À EXÉCUTER APRÈS LE COMMIT
-- =====================================================================

-- 1) Vérifier que authenticated peut exécuter les helpers RLS.
SELECT
  p.proname,
  r.rolname,
  has_function_privilege(r.rolname, p.oid, 'EXECUTE') AS can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
CROSS JOIN (VALUES ('authenticated'), ('service_role'), ('anon')) AS r(rolname)
WHERE n.nspname = 'public'
  AND p.proname IN ('is_operator_owner', 'is_operator_rider', 'user_owns_any_operator', 'has_role')
ORDER BY p.proname, r.rolname;

-- 2) Vérifier les policies actives.
SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('delivery_operator_riders', 'delivery_operator_rider_invites')
ORDER BY tablename, policyname;

-- 3) Vérifier l'opérateur ciblé.
SELECT id, owner_user_id, company_name, status, is_active, max_riders
FROM public.delivery_operators
WHERE id = 'abbbc968-1180-4b07-86d7-4ceaaf274a8e';

-- 4) Vérifier les livreurs rattachés à cet opérateur.
SELECT id, rider_user_id, vehicle_type, vehicle_plate, status, invited_at, activated_at
FROM public.delivery_operator_riders
WHERE operator_id = 'abbbc968-1180-4b07-86d7-4ceaaf274a8e'
ORDER BY invited_at DESC;

-- 5) Vérifier les invitations de cet opérateur.
SELECT id, email, vehicle_type, vehicle_plate, status, invited_at, accepted_at, accepted_user_id, expires_at
FROM public.delivery_operator_rider_invites
WHERE operator_id = 'abbbc968-1180-4b07-86d7-4ceaaf274a8e'
ORDER BY invited_at DESC;
