-- Lot 1.1 — RPC admin de recherche utilisateur (PII-safe)
CREATE OR REPLACE FUNCTION public.search_users_admin(term text)
RETURNS TABLE (
  user_id uuid,
  first_name text,
  last_name text,
  email text,
  city text,
  is_kyc_verified boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden: admin role required' USING ERRCODE = '42501';
  END IF;

  IF term IS NULL OR length(trim(term)) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.user_id,
    p.first_name,
    p.last_name,
    u.email::text,
    p.city,
    COALESCE(p.is_kyc_verified, false) AS is_kyc_verified,
    p.created_at
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.user_id
  WHERE
    p.first_name ILIKE '%' || term || '%'
    OR p.last_name ILIKE '%' || term || '%'
    OR u.email ILIKE '%' || term || '%'
  ORDER BY p.created_at DESC
  LIMIT 8;
END;
$$;

REVOKE ALL ON FUNCTION public.search_users_admin(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.search_users_admin(text) TO authenticated;