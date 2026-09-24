-- Purpose: Harden checkout_sessions — clients must not UPDATE status/amounts
--          (only service_role Edge/RPCs). Prevents forging session paid without payment.
-- Risk: low — frontend only needed INSERT+SELECT; Edge uses service role.
-- Rollback: recreate UPDATE policy for authenticated (not recommended).

DROP POLICY IF EXISTS "Users update own checkout_sessions" ON public.checkout_sessions;

COMMENT ON TABLE public.checkout_sessions IS
  '1 payment → N orders. Clients INSERT+SELECT only; status transitions via Edge/RPC (service_role).';
