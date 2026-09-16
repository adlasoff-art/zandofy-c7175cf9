-- Purpose: Vague 4 — forwarder_members (staff), forwarder_wallets + withdrawals, access helpers.
-- Risk: Additive tables/RLS; extends user_owns_forwarder to include active members (ops can run TMS).
-- Does NOT credit wallets automatically (handoff settlement stays separate / future job).

-- ---------------------------------------------------------------------------
-- 1) Members
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.forwarder_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forwarder_id uuid NOT NULL REFERENCES public.forwarders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'ops'
    CHECK (role IN ('owner', 'ops', 'finance')),
  is_active boolean NOT NULL DEFAULT true,
  invited_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (forwarder_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_forwarder_members_user
  ON public.forwarder_members (user_id) WHERE is_active;

ALTER TABLE public.forwarder_members ENABLE ROW LEVEL SECURITY;

-- Access helpers (before policies that use them)
CREATE OR REPLACE FUNCTION public.user_is_forwarder_member(_forwarder_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.forwarder_members m
    WHERE m.forwarder_id = _forwarder_id
      AND m.user_id = _user_id
      AND m.is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.user_is_forwarder_finance(_forwarder_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.forwarders f
    WHERE f.id = _forwarder_id
      AND f.status = 'approved'
      AND f.owner_user_id = _user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.forwarder_members m
    JOIN public.forwarders f ON f.id = m.forwarder_id
    WHERE m.forwarder_id = _forwarder_id
      AND m.user_id = _user_id
      AND m.is_active = true
      AND m.role IN ('owner', 'finance')
      AND f.status = 'approved'
  );
$$;

-- Extend ownership check used by TMS RLS to include staff members
CREATE OR REPLACE FUNCTION public.user_owns_forwarder(_forwarder_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.forwarders f
    WHERE f.id = _forwarder_id
      AND f.status = 'approved'
      AND (
        f.owner_user_id = _user_id
        OR f.linked_transporter_user_id = _user_id
        OR public.user_is_forwarder_member(_forwarder_id, _user_id)
      )
  );
$$;

DROP POLICY IF EXISTS "forwarder_members_select" ON public.forwarder_members;
CREATE POLICY "forwarder_members_select"
  ON public.forwarder_members FOR SELECT TO authenticated
  USING (
    public.user_owns_forwarder(forwarder_id, auth.uid())
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "forwarder_members_insert_owner" ON public.forwarder_members;
CREATE POLICY "forwarder_members_insert_owner"
  ON public.forwarder_members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.forwarders f
      WHERE f.id = forwarder_id
        AND f.status = 'approved'
        AND f.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "forwarder_members_update_owner" ON public.forwarder_members;
CREATE POLICY "forwarder_members_update_owner"
  ON public.forwarder_members FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.forwarders f
      WHERE f.id = forwarder_id AND f.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.forwarders f
      WHERE f.id = forwarder_id AND f.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "forwarder_members_delete_owner" ON public.forwarder_members;
CREATE POLICY "forwarder_members_delete_owner"
  ON public.forwarder_members FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.forwarders f
      WHERE f.id = forwarder_id AND f.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "forwarder_members_admin" ON public.forwarder_members;
CREATE POLICY "forwarder_members_admin"
  ON public.forwarder_members FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin'::public.app_role, 'manager'::public.app_role)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin'::public.app_role, 'manager'::public.app_role)
    )
  );

-- ---------------------------------------------------------------------------
-- 2) Wallet (Zandofy freight fees) — schema only; credits via future settlement
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.forwarder_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forwarder_id uuid NOT NULL UNIQUE REFERENCES public.forwarders(id) ON DELETE CASCADE,
  available_balance numeric NOT NULL DEFAULT 0,
  pending_balance numeric NOT NULL DEFAULT 0,
  total_earned numeric NOT NULL DEFAULT 0,
  total_withdrawn numeric NOT NULL DEFAULT 0,
  min_withdrawal numeric NOT NULL DEFAULT 50,
  currency text NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.forwarder_withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forwarder_id uuid NOT NULL REFERENCES public.forwarders(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  method text NOT NULL DEFAULT 'mobile_money',
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
  payout_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

ALTER TABLE public.forwarder_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forwarder_withdrawal_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "forwarder_wallets_select_finance" ON public.forwarder_wallets;
CREATE POLICY "forwarder_wallets_select_finance"
  ON public.forwarder_wallets FOR SELECT TO authenticated
  USING (public.user_is_forwarder_finance(forwarder_id, auth.uid()));

DROP POLICY IF EXISTS "forwarder_wallets_admin" ON public.forwarder_wallets;
CREATE POLICY "forwarder_wallets_admin"
  ON public.forwarder_wallets FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin'::public.app_role, 'manager'::public.app_role)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin'::public.app_role, 'manager'::public.app_role)
    )
  );

DROP POLICY IF EXISTS "forwarder_withdrawals_select_finance" ON public.forwarder_withdrawal_requests;
CREATE POLICY "forwarder_withdrawals_select_finance"
  ON public.forwarder_withdrawal_requests FOR SELECT TO authenticated
  USING (public.user_is_forwarder_finance(forwarder_id, auth.uid()));

DROP POLICY IF EXISTS "forwarder_withdrawals_insert_finance" ON public.forwarder_withdrawal_requests;
CREATE POLICY "forwarder_withdrawals_insert_finance"
  ON public.forwarder_withdrawal_requests FOR INSERT TO authenticated
  WITH CHECK (public.user_is_forwarder_finance(forwarder_id, auth.uid()));

DROP POLICY IF EXISTS "forwarder_withdrawals_admin" ON public.forwarder_withdrawal_requests;
CREATE POLICY "forwarder_withdrawals_admin"
  ON public.forwarder_withdrawal_requests FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin'::public.app_role, 'manager'::public.app_role)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin'::public.app_role, 'manager'::public.app_role)
    )
  );

-- Auto-create wallet when forwarder approved (idempotent seed helper)
CREATE OR REPLACE FUNCTION public.ensure_forwarder_wallet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' THEN
    INSERT INTO public.forwarder_wallets (forwarder_id)
    VALUES (NEW.id)
    ON CONFLICT (forwarder_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_forwarder_wallet ON public.forwarders;
CREATE TRIGGER trg_ensure_forwarder_wallet
  AFTER INSERT OR UPDATE OF status ON public.forwarders
  FOR EACH ROW EXECUTE FUNCTION public.ensure_forwarder_wallet();

-- Backfill wallets for existing approved forwarders
INSERT INTO public.forwarder_wallets (forwarder_id)
SELECT f.id FROM public.forwarders f
WHERE f.status = 'approved'
ON CONFLICT (forwarder_id) DO NOTHING;

COMMENT ON TABLE public.forwarder_wallets IS
  'Forwarder wallet for Zandofy-collected freight fees; TMS external cash is out of scope.';
COMMENT ON TABLE public.forwarder_members IS
  'Staff access: owner/ops/finance. Ops can use TMS; finance+owner see wallet.';
