-- 1) Colonne anti-spam pour les rappels KYC
ALTER TABLE public.delivery_operator_riders
  ADD COLUMN IF NOT EXISTS last_kyc_reminder_at timestamptz;

-- 2) RPC : vue agrégée du KYC par livreur, pour un opérateur donné
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
  -- Auth : owner de l'opérateur, staff de l'opérateur, ou admin global
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
    ARRAY(
      SELECT step FROM (
        VALUES
          ('document_front', lk.document_front_url IS NULL),
          ('document_back',  lk.document_back_url IS NULL),
          ('selfie',         lk.selfie_url IS NULL)
      ) AS s(step, missing)
      WHERE missing
    ) AS missing_steps,
    lk.updated_at AS kyc_updated_at,
    lk.rejection_reason
  FROM public.delivery_operator_riders r
  LEFT JOIN last_kyc lk ON lk.user_id = r.rider_user_id
  WHERE r.operator_id = _operator_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_riders_kyc_overview(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_riders_kyc_overview(uuid) TO authenticated, service_role;

-- 3) Trigger d'activation automatique : KYC approved => rider active (si quota OK)
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
  -- On déclenche uniquement quand le KYC vient d'être validé
  IF NEW.status::text <> 'approved' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status::text = 'approved' THEN
    RETURN NEW;
  END IF;

  -- Pour chaque rattachement en attente d'activation lié à ce user
  FOR rec IN
    SELECT r.id, r.operator_id, o.max_riders
    FROM public.delivery_operator_riders r
    JOIN public.delivery_operators o ON o.id = r.operator_id
    WHERE r.rider_user_id = NEW.user_id
      AND r.status IN ('kyc_required', 'pending')
  LOOP
    SELECT COUNT(*) INTO active_count
    FROM public.delivery_operator_riders
    WHERE operator_id = rec.operator_id
      AND status = 'active';

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