
-- ============================================================
-- 1. IMPERSONATION TOKENS — Admin-only RLS policies
-- ============================================================
DO $$ BEGIN
  -- Ensure RLS is enabled
  ALTER TABLE public.impersonation_tokens ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DROP POLICY IF EXISTS "Admins select impersonation_tokens" ON public.impersonation_tokens;
CREATE POLICY "Admins select impersonation_tokens"
  ON public.impersonation_tokens FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins insert impersonation_tokens" ON public.impersonation_tokens;
CREATE POLICY "Admins insert impersonation_tokens"
  ON public.impersonation_tokens FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins update impersonation_tokens" ON public.impersonation_tokens;
CREATE POLICY "Admins update impersonation_tokens"
  ON public.impersonation_tokens FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins delete impersonation_tokens" ON public.impersonation_tokens;
CREATE POLICY "Admins delete impersonation_tokens"
  ON public.impersonation_tokens FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- 2. PROFILES — Replace permissive user UPDATE policies
--    with a secure RPC for safe fields only
-- ============================================================

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users update own certification" ON public.profiles;

-- Create a secure function for user self-update (safe fields only)
CREATE OR REPLACE FUNCTION public.update_own_profile(
  p_first_name text DEFAULT NULL,
  p_last_name text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_gender text DEFAULT NULL,
  p_date_of_birth date DEFAULT NULL,
  p_nationality text DEFAULT NULL,
  p_residence_address text DEFAULT NULL,
  p_residence_city text DEFAULT NULL,
  p_preferred_language text DEFAULT NULL,
  p_preferred_contact_channel text DEFAULT NULL,
  p_notifications_enabled boolean DEFAULT NULL,
  p_allowed_channels text[] DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET
    first_name = COALESCE(p_first_name, first_name),
    last_name = COALESCE(p_last_name, last_name),
    avatar_url = COALESCE(p_avatar_url, avatar_url),
    phone = COALESCE(p_phone, phone),
    gender = COALESCE(p_gender, gender),
    date_of_birth = COALESCE(p_date_of_birth, date_of_birth),
    nationality = COALESCE(p_nationality, nationality),
    residence_address = COALESCE(p_residence_address, residence_address),
    residence_city = COALESCE(p_residence_city, residence_city),
    preferred_language = COALESCE(p_preferred_language, preferred_language),
    preferred_contact_channel = COALESCE(p_preferred_contact_channel, preferred_contact_channel),
    notifications_enabled = COALESCE(p_notifications_enabled, notifications_enabled),
    allowed_channels = COALESCE(p_allowed_channels, allowed_channels),
    updated_at = now()
  WHERE id = auth.uid();
END;
$$;

-- ============================================================
-- 3. STORAGE — Restrict product-media UPDATE/DELETE
-- ============================================================

-- Drop overly permissive policies
DROP POLICY IF EXISTS "Store owners update product media" ON storage.objects;
DROP POLICY IF EXISTS "Store owners delete product media" ON storage.objects;

-- Store owners can only update their own product media (path: store_id/...)
CREATE POLICY "Store owners update own product media"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'product-media'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT s.id::text FROM public.stores s WHERE s.owner_id = auth.uid()
      )
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'manager'::app_role)
    )
  );

CREATE POLICY "Store owners delete own product media"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'product-media'
    AND (
      (storage.foldername(name))[1] IN (
        SELECT s.id::text FROM public.stores s WHERE s.owner_id = auth.uid()
      )
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'manager'::app_role)
    )
  );

-- Fix delivery-proofs DELETE — admin/manager only
DROP POLICY IF EXISTS "Riders delete own delivery proofs" ON storage.objects;
CREATE POLICY "Staff delete delivery proofs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'delivery-proofs'
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'manager'::app_role)
    )
  );

-- ============================================================
-- 4. STORE FOLLOWERS — Restrict SELECT to own follows + staff
-- ============================================================
DROP POLICY IF EXISTS "Authenticated view followers" ON public.store_followers;

CREATE POLICY "Users view own follows"
  ON public.store_followers FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  );
