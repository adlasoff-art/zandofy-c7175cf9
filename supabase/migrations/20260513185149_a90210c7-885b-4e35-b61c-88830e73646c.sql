-- Lot 11B fix : invitations livreurs persistées (avant création de compte)

CREATE TABLE IF NOT EXISTS public.delivery_operator_rider_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.delivery_operators(id) ON DELETE CASCADE,
  email text NOT NULL,
  vehicle_type text NOT NULL DEFAULT 'moto',
  vehicle_plate text,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','revoked','expired')),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  accepted_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  revoked_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rider_invites_open_unique
  ON public.delivery_operator_rider_invites(operator_id, lower(email))
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_rider_invites_email_status
  ON public.delivery_operator_rider_invites(lower(email), status);

CREATE INDEX IF NOT EXISTS idx_rider_invites_operator_status
  ON public.delivery_operator_rider_invites(operator_id, status);

ALTER TABLE public.delivery_operator_rider_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rider_invites_select_owner" ON public.delivery_operator_rider_invites;
DROP POLICY IF EXISTS "rider_invites_select_staff" ON public.delivery_operator_rider_invites;

CREATE POLICY "rider_invites_select_owner"
  ON public.delivery_operator_rider_invites FOR SELECT TO authenticated
  USING (public.is_operator_owner(auth.uid(), operator_id));

CREATE POLICY "rider_invites_select_staff"
  ON public.delivery_operator_rider_invites FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- INSERT/UPDATE/DELETE strictement via edge functions (service role).
