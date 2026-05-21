-- 1) get_riders_kyc_overview : court-circuiter missing_steps quand approved
CREATE OR REPLACE FUNCTION public.get_riders_kyc_overview(_operator_id uuid)
RETURNS TABLE (
  rider_user_id uuid,
  kyc_status text,
  has_document_front boolean,
  has_document_back boolean,
  has_selfie boolean,
  missing_steps text[],
  kyc_updated_at timestamptz,
  rejection_reason text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.is_operator_owner(auth.uid(), _operator_id)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH last_kyc AS (
    SELECT DISTINCT ON (k.user_id)
      k.user_id,
      k.status::text AS status,
      k.document_front_url,
      k.document_back_url,
      k.selfie_url,
      k.updated_at,
      k.rejection_reason
    FROM public.kyc_verifications k
    WHERE k.user_id IN (
      SELECT r.rider_user_id FROM public.delivery_operator_riders r
      WHERE r.operator_id = _operator_id
    )
    ORDER BY k.user_id, k.updated_at DESC
  )
  SELECT
    r.rider_user_id,
    COALESCE(lk.status, 'not_started')::text AS kyc_status,
    (lk.document_front_url IS NOT NULL) AS has_document_front,
    (lk.document_back_url IS NOT NULL) AS has_document_back,
    (lk.selfie_url IS NOT NULL) AS has_selfie,
    CASE
      WHEN lk.status = 'approved' THEN ARRAY[]::text[]
      ELSE ARRAY(
        SELECT step FROM (
          VALUES
            ('document_front', lk.document_front_url IS NULL),
            ('document_back',  lk.document_back_url IS NULL),
            ('selfie',         lk.selfie_url IS NULL)
        ) AS s(step, missing)
        WHERE missing
      )
    END AS missing_steps,
    lk.updated_at AS kyc_updated_at,
    lk.rejection_reason
  FROM public.delivery_operator_riders r
  LEFT JOIN last_kyc lk ON lk.user_id = r.rider_user_id
  WHERE r.operator_id = _operator_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_riders_kyc_overview(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_riders_kyc_overview(uuid) TO authenticated, service_role;

-- 2) Trigger d'activation automatique (re-créé pour idempotence prod)
CREATE OR REPLACE FUNCTION public.auto_activate_rider_on_kyc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  active_count int;
BEGIN
  IF NEW.status::text <> 'approved' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status::text = 'approved' THEN RETURN NEW; END IF;

  FOR rec IN
    SELECT r.id, r.operator_id, o.max_riders
    FROM public.delivery_operator_riders r
    JOIN public.delivery_operators o ON o.id = r.operator_id
    WHERE r.rider_user_id = NEW.user_id
      AND r.status IN ('kyc_required', 'pending')
  LOOP
    SELECT COUNT(*) INTO active_count
    FROM public.delivery_operator_riders
    WHERE operator_id = rec.operator_id AND status = 'active';

    IF active_count < rec.max_riders THEN
      UPDATE public.delivery_operator_riders
      SET status = 'active',
          activated_at = COALESCE(activated_at, now())
      WHERE id = rec.id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_activate_rider_on_kyc ON public.kyc_verifications;
CREATE TRIGGER trg_auto_activate_rider_on_kyc
AFTER INSERT OR UPDATE OF status ON public.kyc_verifications
FOR EACH ROW
EXECUTE FUNCTION public.auto_activate_rider_on_kyc();

-- 3) Backfill : aligner les rattachements existants pour les KYC déjà approuvés
DO $$
DECLARE
  rec record;
  active_count int;
BEGIN
  FOR rec IN
    SELECT DISTINCT r.id, r.operator_id, o.max_riders
    FROM public.delivery_operator_riders r
    JOIN public.delivery_operators o ON o.id = r.operator_id
    WHERE r.status IN ('kyc_required','pending')
      AND EXISTS (
        SELECT 1 FROM public.kyc_verifications k
        WHERE k.user_id = r.rider_user_id
          AND k.status::text = 'approved'
      )
  LOOP
    SELECT COUNT(*) INTO active_count
    FROM public.delivery_operator_riders
    WHERE operator_id = rec.operator_id AND status = 'active';

    IF active_count < rec.max_riders THEN
      UPDATE public.delivery_operator_riders
      SET status = 'active', activated_at = COALESCE(activated_at, now())
      WHERE id = rec.id;
    END IF;
  END LOOP;
END $$;

-- 4) admin_search_users (idempotent, au cas où la migration originale n'aurait pas atteint la prod)
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
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_query IS NULL OR length(trim(p_query)) < 2 THEN RETURN; END IF;

  RETURN QUERY
  SELECT p.id, p.email, p.first_name, p.last_name,
    COALESCE(NULLIF(trim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')), ''), p.email) AS display_label
  FROM public.profiles p
  WHERE (p.email ILIKE '%' || p_query || '%')
     OR (p.first_name ILIKE '%' || p_query || '%')
     OR (p.last_name  ILIKE '%' || p_query || '%')
  ORDER BY p.email NULLS LAST
  LIMIT GREATEST(1, LEAST(p_limit, 25));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_search_users(text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_search_users(text, int) TO authenticated;

-- 5) admin_get_user_label (idempotent)
CREATE OR REPLACE FUNCTION public.admin_get_user_label(p_user_id uuid)
RETURNS TABLE (id uuid, email text, display_label text)
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
  SELECT p.id, p.email,
    COALESCE(NULLIF(trim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')), ''), p.email) AS display_label
  FROM public.profiles p WHERE p.id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_user_label(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_user_label(uuid) TO authenticated;

-- 6) admin_search_forwarder_users : restreint au rôle 'forwarder', liste pré-chargée si vide
CREATE OR REPLACE FUNCTION public.admin_search_forwarder_users(p_query text DEFAULT NULL, p_limit int DEFAULT 20)
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
DECLARE
  q text := COALESCE(trim(p_query), '');
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT DISTINCT
    p.id, p.email, p.first_name, p.last_name,
    COALESCE(NULLIF(trim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')), ''), p.email) AS display_label
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'forwarder'::app_role
  WHERE
    q = ''
    OR p.email ILIKE '%' || q || '%'
    OR p.first_name ILIKE '%' || q || '%'
    OR p.last_name  ILIKE '%' || q || '%'
  ORDER BY display_label NULLS LAST, p.email NULLS LAST
  LIMIT GREATEST(1, LEAST(p_limit, 50));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_search_forwarder_users(text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_search_forwarder_users(text, int) TO authenticated;