-- LOT 2 — RPC admin_search_users (admin-only, used to link a user account to a forwarder)
CREATE OR REPLACE FUNCTION public.admin_search_users(p_query text, p_limit int DEFAULT 10)
RETURNS TABLE (
  id uuid,
  email text,
  first_name text,
  last_name text,
  display_label text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Hard gate: only platform admins can use this lookup
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_query IS NULL OR length(trim(p_query)) < 2 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.email,
    p.first_name,
    p.last_name,
    COALESCE(NULLIF(trim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')), ''), p.email) AS display_label
  FROM public.profiles p
  WHERE
    (p.email     ILIKE '%' || p_query || '%')
 OR (p.first_name ILIKE '%' || p_query || '%')
 OR (p.last_name  ILIKE '%' || p_query || '%')
  ORDER BY p.email NULLS LAST
  LIMIT GREATEST(1, LEAST(p_limit, 25));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_search_users(text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_search_users(text, int) TO authenticated;

-- Companion: resolve a single profile label by id (used to display the currently linked transporter)
CREATE OR REPLACE FUNCTION public.admin_get_user_label(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  email text,
  display_label text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.email,
    COALESCE(NULLIF(trim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')), ''), p.email) AS display_label
  FROM public.profiles p
  WHERE p.id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_user_label(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_user_label(uuid) TO authenticated;