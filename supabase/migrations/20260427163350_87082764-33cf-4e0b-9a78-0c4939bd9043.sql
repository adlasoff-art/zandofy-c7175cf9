-- ============================================================
-- Lot 1.3 — Consolidation DB multi-opérateurs
-- ============================================================

-- ───────────────────────────────────────────────────────────
-- A. Renommage des colonnes legacy (tarification désormais par opérateur)
-- ───────────────────────────────────────────────────────────
ALTER TABLE public.communes
  RENAME COLUMN delivery_fee TO delivery_fee_legacy_deprecated;

ALTER TABLE public.quartiers
  RENAME COLUMN delivery_surcharge TO delivery_surcharge_legacy_deprecated;

COMMENT ON COLUMN public.communes.delivery_fee_legacy_deprecated IS
  'DEPRECATED 2026-04. Replaced by delivery_operator_rates. Will be dropped after 30 days.';
COMMENT ON COLUMN public.quartiers.delivery_surcharge_legacy_deprecated IS
  'DEPRECATED 2026-04. Replaced by delivery_operator_rates. Will be dropped after 30 days.';

-- ───────────────────────────────────────────────────────────
-- B. coverage_requests — demandes de couverture par les clients
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coverage_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  country_code text NOT NULL DEFAULT 'CD',
  city text NOT NULL,
  commune text,
  quartier text,
  commune_id uuid REFERENCES public.communes(id) ON DELETE SET NULL,
  quartier_id uuid REFERENCES public.quartiers(id) ON DELETE SET NULL,
  notes text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  fulfilled_at timestamptz,
  fulfilled_by uuid,
  fulfilled_operator_id uuid REFERENCES public.delivery_operators(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coverage_requests_user ON public.coverage_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_coverage_requests_pending ON public.coverage_requests(fulfilled_at) WHERE fulfilled_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_coverage_requests_geo ON public.coverage_requests(country_code, city, commune);

ALTER TABLE public.coverage_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see their own coverage requests"
  ON public.coverage_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users create their own coverage requests"
  ON public.coverage_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins/managers see all coverage requests"
  ON public.coverage_requests FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admins fulfill coverage requests"
  ON public.coverage_requests FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

-- ───────────────────────────────────────────────────────────
-- C. operator_kyb_documents — documents légaux opérateurs
-- ───────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.operator_kyb_doc_type AS ENUM (
    'rccm', 'nif', 'id_card', 'business_license', 'insurance', 'tax_clearance', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.operator_kyb_doc_status AS ENUM (
    'pending', 'approved', 'rejected'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.operator_kyb_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.delivery_operators(id) ON DELETE CASCADE,
  doc_type public.operator_kyb_doc_type NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  uploaded_by uuid NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  status public.operator_kyb_doc_status NOT NULL DEFAULT 'pending',
  reviewed_at timestamptz,
  reviewed_by uuid,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kyb_docs_operator ON public.operator_kyb_documents(operator_id);
CREATE INDEX IF NOT EXISTS idx_kyb_docs_status ON public.operator_kyb_documents(status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_kyb_docs_operator_type_path
  ON public.operator_kyb_documents(operator_id, doc_type, file_path);

ALTER TABLE public.operator_kyb_documents ENABLE ROW LEVEL SECURITY;

-- Owner of operator can SELECT/INSERT/DELETE its own docs (delete only if pending)
CREATE POLICY "Operator owner sees own KYB docs"
  ON public.operator_kyb_documents FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.delivery_operators o
      WHERE o.id = operator_kyb_documents.operator_id
        AND o.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Operator owner uploads own KYB docs"
  ON public.operator_kyb_documents FOR INSERT
  WITH CHECK (
    auth.uid() = uploaded_by
    AND EXISTS (
      SELECT 1 FROM public.delivery_operators o
      WHERE o.id = operator_kyb_documents.operator_id
        AND o.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Operator owner deletes own pending KYB docs"
  ON public.operator_kyb_documents FOR DELETE
  USING (
    status = 'pending'
    AND EXISTS (
      SELECT 1 FROM public.delivery_operators o
      WHERE o.id = operator_kyb_documents.operator_id
        AND o.owner_user_id = auth.uid()
    )
  );

-- Admin/manager : full visibility + review
CREATE POLICY "Staff sees all KYB docs"
  ON public.operator_kyb_documents FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Staff updates KYB docs (review)"
  ON public.operator_kyb_documents FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Staff deletes KYB docs"
  ON public.operator_kyb_documents FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Trigger updated_at
CREATE TRIGGER trg_operator_kyb_docs_updated_at
  BEFORE UPDATE ON public.operator_kyb_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ───────────────────────────────────────────────────────────
-- D. Storage bucket KYB (privé)
-- ───────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('operator-kyb-documents', 'operator-kyb-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Convention de chemin : <operator_id>/<doc_type>/<filename>
CREATE POLICY "Operator owner reads its KYB files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'operator-kyb-documents'
    AND EXISTS (
      SELECT 1 FROM public.delivery_operators o
      WHERE o.id::text = (storage.foldername(name))[1]
        AND o.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Operator owner uploads its KYB files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'operator-kyb-documents'
    AND EXISTS (
      SELECT 1 FROM public.delivery_operators o
      WHERE o.id::text = (storage.foldername(name))[1]
        AND o.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Operator owner deletes its KYB files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'operator-kyb-documents'
    AND EXISTS (
      SELECT 1 FROM public.delivery_operators o
      WHERE o.id::text = (storage.foldername(name))[1]
        AND o.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Staff reads all KYB files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'operator-kyb-documents'
    AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  );

CREATE POLICY "Staff deletes any KYB file"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'operator-kyb-documents'
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

-- ───────────────────────────────────────────────────────────
-- E. Archivage du doublon Very Speed Delivery
--    Conserve : abbbc968-1180-4b07-86d7-4ceaaf274a8e (15% / 10 / 3)
--    Archive  : e4209222-3773-4f7b-8916-e97e788fc1ea (25% / 30 / 2)
-- ───────────────────────────────────────────────────────────
DO $$
DECLARE
  v_dup uuid := 'e4209222-3773-4f7b-8916-e97e788fc1ea';
  v_active_assignments int := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.delivery_operators WHERE id = v_dup) THEN
    RAISE NOTICE 'Duplicate operator % not found in this env — skipping archive', v_dup;
    RETURN;
  END IF;

  -- Sécurité : si assignations actives, on log un warning mais on archive quand même
  -- (l'utilisateur a confirmé que ce doublon n'a pas servi opérationnellement).
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='delivery_assignments') THEN
    EXECUTE format(
      'SELECT COUNT(*) FROM public.delivery_assignments WHERE operator_id = %L AND status NOT IN (%L,%L,%L)',
      v_dup, 'delivered', 'cancelled', 'failed'
    ) INTO v_active_assignments;
    IF v_active_assignments > 0 THEN
      RAISE WARNING 'Archiving operator % with % active assignments — manual review recommended', v_dup, v_active_assignments;
    END IF;
  END IF;

  UPDATE public.delivery_operators
  SET archived_at = now(),
      archive_reason = 'doublon Very Speed Delivery — opérateur de remplacement abbbc968 conservé',
      is_active = false,
      status = 'archived',
      updated_at = now()
  WHERE id = v_dup
    AND archived_at IS NULL;

  -- Désactive automatiquement ses tarifs
  UPDATE public.delivery_operator_rates
  SET is_active = false,
      status = 'archived',
      updated_at = now()
  WHERE operator_id = v_dup
    AND status <> 'archived';

  RAISE NOTICE 'Archived duplicate operator %', v_dup;
END $$;