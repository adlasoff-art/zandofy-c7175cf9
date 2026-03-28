-- SECURITY FIX 1: Remove user self-UPDATE on zando_points (privilege escalation)
DROP POLICY IF EXISTS "Users update own points" ON public.zando_points;

-- SECURITY FIX 2: Remove user self-INSERT on point_transactions (privilege escalation)
DROP POLICY IF EXISTS "Users insert own transactions" ON public.point_transactions;

-- SECURITY FIX 3: Restrict rider_ratings to authenticated only
DROP POLICY IF EXISTS "Anyone can read rider ratings" ON public.rider_ratings;
CREATE POLICY "Authenticated read rider ratings"
ON public.rider_ratings
FOR SELECT
TO authenticated
USING (true);

-- SECURITY FIX 4: Restrict store_followers to authenticated only
DROP POLICY IF EXISTS "Anyone can view followers" ON public.store_followers;
CREATE POLICY "Authenticated view followers"
ON public.store_followers
FOR SELECT
TO authenticated
USING (true);