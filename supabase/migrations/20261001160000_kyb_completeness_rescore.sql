-- Purpose: Fix KYB completeness scoring so submit unlocks after fields + docs.
-- - Score uses NEW row values on submission UPDATE (not stale SELECT)
-- - Rescore when kyb_documents change
-- - Include bank_name + bank_account_holder (+5 each) to align with UI
-- - RPC refresh_kyb_completeness_score(submission_id) for client after upload
-- Risk: low additive. Max score still 100 (field points adjusted).
-- Staging → production: after Phase C migrations; smoke KYB fill+upload → submit enabled.
-- Rollback: restore compute/triggers from 20260427231954_*.

-- ---------------------------------------------------------------------------
-- 1) Scoring: fields (including bank_name/holder) + docs
-- Field points: 5+5+10+10+5+5+5+5+5+5 = 60; docs 5*8 = 40 → max 100
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compute_kyb_completeness(_submission_id uuid)
RETURNS int
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  s record;
  doc_count int;
  score int := 0;
BEGIN
  SELECT * INTO s FROM public.kyb_submissions WHERE id = _submission_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  IF s.legal_name IS NOT NULL AND length(trim(s.legal_name)) > 0 THEN score := score + 5; END IF;
  IF s.business_type IS NOT NULL AND length(trim(s.business_type::text)) > 0 THEN score := score + 5; END IF;
  IF s.rccm_number IS NOT NULL AND length(trim(s.rccm_number)) > 0 THEN score := score + 10; END IF;
  IF s.tax_nif IS NOT NULL AND length(trim(s.tax_nif)) > 0 THEN score := score + 10; END IF;
  IF s.director_full_name IS NOT NULL AND length(trim(s.director_full_name)) > 0 THEN score := score + 5; END IF;
  IF s.director_id_number IS NOT NULL AND length(trim(s.director_id_number)) > 0 THEN score := score + 5; END IF;
  IF s.business_address IS NOT NULL AND length(trim(s.business_address)) > 0 THEN score := score + 5; END IF;
  IF s.bank_account_number IS NOT NULL AND length(trim(s.bank_account_number)) > 0 THEN score := score + 5; END IF;
  IF s.bank_name IS NOT NULL AND length(trim(s.bank_name)) > 0 THEN score := score + 5; END IF;
  IF s.bank_account_holder IS NOT NULL AND length(trim(s.bank_account_holder)) > 0 THEN score := score + 5; END IF;

  SELECT COUNT(DISTINCT doc_type) INTO doc_count
  FROM public.kyb_documents
  WHERE submission_id = _submission_id
    AND doc_type IN ('rccm', 'id_director', 'proof_address', 'tax_nif', 'bank_rib');

  score := score + LEAST(doc_count * 8, 40);
  RETURN LEAST(score, 100);
END;
$$;

-- ---------------------------------------------------------------------------
-- 2) BEFORE UPDATE: score from NEW field values + live docs (not stale SELECT)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_kyb_completeness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  doc_count int;
  score int := 0;
BEGIN
  IF NEW.legal_name IS NOT NULL AND length(trim(NEW.legal_name)) > 0 THEN score := score + 5; END IF;
  IF NEW.business_type IS NOT NULL AND length(trim(NEW.business_type::text)) > 0 THEN score := score + 5; END IF;
  IF NEW.rccm_number IS NOT NULL AND length(trim(NEW.rccm_number)) > 0 THEN score := score + 10; END IF;
  IF NEW.tax_nif IS NOT NULL AND length(trim(NEW.tax_nif)) > 0 THEN score := score + 10; END IF;
  IF NEW.director_full_name IS NOT NULL AND length(trim(NEW.director_full_name)) > 0 THEN score := score + 5; END IF;
  IF NEW.director_id_number IS NOT NULL AND length(trim(NEW.director_id_number)) > 0 THEN score := score + 5; END IF;
  IF NEW.business_address IS NOT NULL AND length(trim(NEW.business_address)) > 0 THEN score := score + 5; END IF;
  IF NEW.bank_account_number IS NOT NULL AND length(trim(NEW.bank_account_number)) > 0 THEN score := score + 5; END IF;
  IF NEW.bank_name IS NOT NULL AND length(trim(NEW.bank_name)) > 0 THEN score := score + 5; END IF;
  IF NEW.bank_account_holder IS NOT NULL AND length(trim(NEW.bank_account_holder)) > 0 THEN score := score + 5; END IF;

  SELECT COUNT(DISTINCT doc_type) INTO doc_count
  FROM public.kyb_documents
  WHERE submission_id = NEW.id
    AND doc_type IN ('rccm', 'id_director', 'proof_address', 'tax_nif', 'bank_rib');

  score := score + LEAST(doc_count * 8, 40);
  NEW.completeness_score := LEAST(score, 100);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kyb_completeness ON public.kyb_submissions;
CREATE TRIGGER trg_kyb_completeness
  BEFORE UPDATE ON public.kyb_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_kyb_completeness();

-- ---------------------------------------------------------------------------
-- 3) Docs change → rescore parent submission
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rescore_kyb_submission_from_docs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_score int;
BEGIN
  v_id := COALESCE(NEW.submission_id, OLD.submission_id);
  IF v_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_score := public.compute_kyb_completeness(v_id);

  UPDATE public.kyb_submissions
  SET completeness_score = v_score,
      updated_at = now()
  WHERE id = v_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_kyb_docs_rescore ON public.kyb_documents;
CREATE TRIGGER trg_kyb_docs_rescore
  AFTER INSERT OR UPDATE OR DELETE ON public.kyb_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.rescore_kyb_submission_from_docs();

-- ---------------------------------------------------------------------------
-- 4) Client RPC after upload / blur
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_kyb_completeness_score(p_submission_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_score int;
  v_uid uuid := auth.uid();
BEGIN
  IF p_submission_id IS NULL THEN
    RETURN 0;
  END IF;

  IF v_uid IS NOT NULL AND NOT (
    EXISTS (
      SELECT 1 FROM public.kyb_submissions ks
      JOIN public.stores s ON s.id = ks.store_id
      WHERE ks.id = p_submission_id
        AND (
          s.owner_id = v_uid
          OR ks.submitted_by = v_uid
          OR EXISTS (
            SELECT 1 FROM public.store_collaborators sc
            WHERE sc.store_id = s.id AND sc.user_id = v_uid AND sc.status = 'active'
          )
          OR public.has_role(v_uid, 'admin'::app_role)
          OR public.has_role(v_uid, 'manager'::app_role)
        )
    )
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_score := public.compute_kyb_completeness(p_submission_id);

  UPDATE public.kyb_submissions
  SET completeness_score = v_score,
      updated_at = now()
  WHERE id = p_submission_id;

  RETURN v_score;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_kyb_completeness_score(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_kyb_completeness_score(uuid) TO authenticated, service_role;

-- Backfill existing drafts
UPDATE public.kyb_submissions ks
SET completeness_score = public.compute_kyb_completeness(ks.id),
    updated_at = now()
WHERE ks.status IN ('draft', 'needs_changes', 'rejected');
