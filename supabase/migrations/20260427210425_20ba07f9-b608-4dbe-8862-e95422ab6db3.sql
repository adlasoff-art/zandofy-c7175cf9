
CREATE TABLE IF NOT EXISTS public.forwarder_coverage_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  origin_country text NOT NULL,
  destination_country text NOT NULL,
  destination_city text,
  destination_city_id uuid,
  mode text NOT NULL CHECK (mode IN ('air','sea','road','rail','express')),
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','notified','resolved','dismissed')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_fwd_cov_req_route
  ON public.forwarder_coverage_requests (origin_country, destination_country, mode);
CREATE INDEX IF NOT EXISTS idx_fwd_cov_req_user
  ON public.forwarder_coverage_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_fwd_cov_req_status
  ON public.forwarder_coverage_requests (status);

ALTER TABLE public.forwarder_coverage_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fcr_user_insert" ON public.forwarder_coverage_requests;
CREATE POLICY "fcr_user_insert" ON public.forwarder_coverage_requests
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "fcr_user_select_own" ON public.forwarder_coverage_requests;
CREATE POLICY "fcr_user_select_own" ON public.forwarder_coverage_requests
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "fcr_admin_update" ON public.forwarder_coverage_requests;
CREATE POLICY "fcr_admin_update" ON public.forwarder_coverage_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "fcr_admin_delete" ON public.forwarder_coverage_requests;
CREATE POLICY "fcr_admin_delete" ON public.forwarder_coverage_requests
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
