-- Fix: GRANT EXECUTE on operator helper functions + replay fleet RLS policies (idempotent)

CREATE OR REPLACE FUNCTION public.is_operator_owner(_uid uuid, _operator_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.delivery_operators
    WHERE id=_operator_id AND owner_user_id=_uid
  );
$$;

CREATE OR REPLACE FUNCTION public.is_operator_rider(_uid uuid, _operator_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.delivery_operator_riders
    WHERE rider_user_id=_uid AND operator_id=_operator_id AND status='active'
  );
$$;

CREATE OR REPLACE FUNCTION public.user_owns_any_operator(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.delivery_operators WHERE owner_user_id=_uid);
$$;

REVOKE ALL ON FUNCTION public.is_operator_owner(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_operator_rider(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.user_owns_any_operator(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_operator_owner(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_operator_rider(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_owns_any_operator(uuid) TO authenticated, service_role;

-- Replay riders policies
ALTER TABLE public.delivery_operator_riders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "op_riders_select_owner" ON public.delivery_operator_riders;
DROP POLICY IF EXISTS "op_riders_select_self"  ON public.delivery_operator_riders;
DROP POLICY IF EXISTS "op_riders_select_staff" ON public.delivery_operator_riders;
DROP POLICY IF EXISTS "op_riders_update_owner" ON public.delivery_operator_riders;
DROP POLICY IF EXISTS "op_riders_update_staff" ON public.delivery_operator_riders;

CREATE POLICY "op_riders_select_owner" ON public.delivery_operator_riders
  FOR SELECT TO authenticated USING (public.is_operator_owner(auth.uid(), operator_id));
CREATE POLICY "op_riders_select_self" ON public.delivery_operator_riders
  FOR SELECT TO authenticated USING (rider_user_id = auth.uid());
CREATE POLICY "op_riders_select_staff" ON public.delivery_operator_riders
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "op_riders_update_owner" ON public.delivery_operator_riders
  FOR UPDATE TO authenticated USING (public.is_operator_owner(auth.uid(), operator_id));
CREATE POLICY "op_riders_update_staff" ON public.delivery_operator_riders
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- Replay invites policies
ALTER TABLE public.delivery_operator_rider_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rider_invites_select_owner" ON public.delivery_operator_rider_invites;
DROP POLICY IF EXISTS "rider_invites_select_staff" ON public.delivery_operator_rider_invites;
DROP POLICY IF EXISTS "rider_invites_update_owner" ON public.delivery_operator_rider_invites;
DROP POLICY IF EXISTS "rider_invites_update_staff" ON public.delivery_operator_rider_invites;

CREATE POLICY "rider_invites_select_owner" ON public.delivery_operator_rider_invites
  FOR SELECT TO authenticated USING (public.is_operator_owner(auth.uid(), operator_id));
CREATE POLICY "rider_invites_select_staff" ON public.delivery_operator_rider_invites
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "rider_invites_update_owner" ON public.delivery_operator_rider_invites
  FOR UPDATE TO authenticated USING (public.is_operator_owner(auth.uid(), operator_id));
CREATE POLICY "rider_invites_update_staff" ON public.delivery_operator_rider_invites
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));