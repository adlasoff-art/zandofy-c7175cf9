-- Fix RLS for operator riders & invites (idempotent, safe to replay on prod)

CREATE OR REPLACE FUNCTION public.is_operator_owner(_uid uuid, _operator_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.delivery_operators
    WHERE id=_operator_id AND owner_user_id=_uid
  );
$$;

ALTER TABLE public.delivery_operator_riders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "op_riders_select_owner" ON public.delivery_operator_riders;
DROP POLICY IF EXISTS "op_riders_select_self"  ON public.delivery_operator_riders;
DROP POLICY IF EXISTS "op_riders_select_staff" ON public.delivery_operator_riders;
DROP POLICY IF EXISTS "op_riders_update_owner" ON public.delivery_operator_riders;
DROP POLICY IF EXISTS "op_riders_update_staff" ON public.delivery_operator_riders;

CREATE POLICY "op_riders_select_owner" ON public.delivery_operator_riders
  FOR SELECT TO authenticated USING (public.is_operator_owner(auth.uid(),operator_id));
CREATE POLICY "op_riders_select_self" ON public.delivery_operator_riders
  FOR SELECT TO authenticated USING (rider_user_id=auth.uid());
CREATE POLICY "op_riders_select_staff" ON public.delivery_operator_riders
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "op_riders_update_owner" ON public.delivery_operator_riders
  FOR UPDATE TO authenticated USING (public.is_operator_owner(auth.uid(),operator_id));
CREATE POLICY "op_riders_update_staff" ON public.delivery_operator_riders
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

ALTER TABLE public.delivery_operator_rider_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rider_invites_select_owner" ON public.delivery_operator_rider_invites;
DROP POLICY IF EXISTS "rider_invites_select_staff" ON public.delivery_operator_rider_invites;
DROP POLICY IF EXISTS "rider_invites_update_owner" ON public.delivery_operator_rider_invites;
DROP POLICY IF EXISTS "rider_invites_update_staff" ON public.delivery_operator_rider_invites;

CREATE POLICY "rider_invites_select_owner" ON public.delivery_operator_rider_invites
  FOR SELECT TO authenticated USING (public.is_operator_owner(auth.uid(),operator_id));
CREATE POLICY "rider_invites_select_staff" ON public.delivery_operator_rider_invites
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "rider_invites_update_owner" ON public.delivery_operator_rider_invites
  FOR UPDATE TO authenticated USING (public.is_operator_owner(auth.uid(),operator_id));
CREATE POLICY "rider_invites_update_staff" ON public.delivery_operator_rider_invites
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));