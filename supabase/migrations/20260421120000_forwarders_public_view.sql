-- S4 (Lot 4 hardening) — Restrict direct public exposure of sensitive
-- forwarder columns (contact_email, contact_phone, owner_user_id) while
-- keeping brand info (name, slug, logo) available to anonymous visitors.
--
-- The checkout eligibility path is unaffected: `get_eligible_forwarders`
-- is SECURITY DEFINER and already returns only safe fields.

-- 1) Public view exposing only non-sensitive brand fields
CREATE OR REPLACE VIEW public.v_forwarders_public
WITH (security_invoker = on) AS
SELECT
  id,
  name,
  slug,
  logo_url,
  description,
  is_active
FROM public.forwarders
WHERE is_active = true;

-- 2) Grant read access on the view to everyone (anon + authenticated)
GRANT SELECT ON public.v_forwarders_public TO anon, authenticated;

-- 3) Tighten direct table SELECT: drop the broad public policy and replace
--    it with an authenticated-only one. Admin / manager / owner policies
--    already exist and are untouched.
DROP POLICY IF EXISTS forwarders_select_public ON public.forwarders;

CREATE POLICY forwarders_select_authenticated
ON public.forwarders
FOR SELECT
TO authenticated
USING (is_active = true);