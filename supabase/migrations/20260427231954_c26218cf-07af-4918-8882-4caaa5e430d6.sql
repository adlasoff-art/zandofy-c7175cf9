-- LOT 15 : KYB/KYC v2 (final)

-- Enums
DO $$ BEGIN
  CREATE TYPE public.kyb_status AS ENUM ('draft', 'submitted', 'in_review', 'approved', 'rejected', 'needs_changes');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.kyc_status_v2 AS ENUM ('draft', 'submitted', 'in_review', 'approved', 'rejected', 'needs_changes');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.kyb_doc_type AS ENUM ('rccm', 'id_director', 'proof_address', 'tax_nif', 'bank_rib', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.kyb_doc_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Tables
CREATE TABLE IF NOT EXISTS public.kyb_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL,
  status public.kyb_status NOT NULL DEFAULT 'draft',
  legal_name TEXT, business_type TEXT, rccm_number TEXT, tax_nif TEXT,
  director_full_name TEXT, director_id_number TEXT,
  business_address TEXT, business_country TEXT, business_city TEXT,
  bank_name TEXT, bank_account_holder TEXT, bank_account_number TEXT,
  completeness_score INT DEFAULT 0, admin_score INT,
  admin_notes TEXT, rejection_reason TEXT,
  submitted_at TIMESTAMPTZ, reviewed_at TIMESTAMPTZ, reviewed_by UUID, approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kyb_submissions_store ON public.kyb_submissions(store_id);
CREATE INDEX IF NOT EXISTS idx_kyb_submissions_status ON public.kyb_submissions(status);
CREATE INDEX IF NOT EXISTS idx_kyb_submissions_submitted_by ON public.kyb_submissions(submitted_by);

CREATE TABLE IF NOT EXISTS public.kyb_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.kyb_submissions(id) ON DELETE CASCADE,
  doc_type public.kyb_doc_type NOT NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT, file_size INT, mime_type TEXT,
  status public.kyb_doc_status NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ, reviewed_by UUID
);
CREATE INDEX IF NOT EXISTS idx_kyb_documents_submission ON public.kyb_documents(submission_id);
CREATE INDEX IF NOT EXISTS idx_kyb_documents_type ON public.kyb_documents(doc_type);

CREATE TABLE IF NOT EXISTS public.kyc_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  status public.kyc_status_v2 NOT NULL DEFAULT 'draft',
  full_name TEXT, date_of_birth DATE, nationality TEXT,
  id_type TEXT, id_number TEXT,
  id_document_path TEXT, selfie_path TEXT,
  completeness_score INT DEFAULT 0, admin_score INT,
  admin_notes TEXT, rejection_reason TEXT,
  submitted_at TIMESTAMPTZ, reviewed_at TIMESTAMPTZ, reviewed_by UUID, approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kyc_submissions_user ON public.kyc_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_submissions_status ON public.kyc_submissions(status);

CREATE TABLE IF NOT EXISTS public.kyb_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_type TEXT NOT NULL CHECK (submission_type IN ('kyb', 'kyc')),
  submission_id UUID NOT NULL,
  action TEXT NOT NULL,
  actor_id UUID NOT NULL,
  old_value JSONB, new_value JSONB, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kyb_audit_submission ON public.kyb_audit_log(submission_type, submission_id);
CREATE INDEX IF NOT EXISTS idx_kyb_audit_actor ON public.kyb_audit_log(actor_id);

-- Triggers
DROP TRIGGER IF EXISTS trg_kyb_submissions_updated ON public.kyb_submissions;
CREATE TRIGGER trg_kyb_submissions_updated BEFORE UPDATE ON public.kyb_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_kyc_submissions_updated ON public.kyc_submissions;
CREATE TRIGGER trg_kyc_submissions_updated BEFORE UPDATE ON public.kyc_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Functions scoring
CREATE OR REPLACE FUNCTION public.compute_kyb_completeness(_submission_id UUID)
RETURNS INT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s RECORD; doc_count INT; score INT := 0;
BEGIN
  SELECT * INTO s FROM public.kyb_submissions WHERE id = _submission_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF s.legal_name IS NOT NULL AND length(s.legal_name) > 0 THEN score := score + 5; END IF;
  IF s.business_type IS NOT NULL THEN score := score + 5; END IF;
  IF s.rccm_number IS NOT NULL THEN score := score + 10; END IF;
  IF s.tax_nif IS NOT NULL THEN score := score + 10; END IF;
  IF s.director_full_name IS NOT NULL THEN score := score + 5; END IF;
  IF s.director_id_number IS NOT NULL THEN score := score + 5; END IF;
  IF s.business_address IS NOT NULL THEN score := score + 5; END IF;
  IF s.bank_account_number IS NOT NULL THEN score := score + 5; END IF;
  SELECT COUNT(DISTINCT doc_type) INTO doc_count FROM public.kyb_documents
    WHERE submission_id = _submission_id
    AND doc_type IN ('rccm','id_director','proof_address','tax_nif','bank_rib');
  score := score + LEAST(doc_count * 10, 50);
  RETURN LEAST(score, 100);
END; $$;

CREATE OR REPLACE FUNCTION public.compute_kyc_completeness(_submission_id UUID)
RETURNS INT LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE s RECORD; score INT := 0;
BEGIN
  SELECT * INTO s FROM public.kyc_submissions WHERE id = _submission_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF s.full_name IS NOT NULL THEN score := score + 15; END IF;
  IF s.date_of_birth IS NOT NULL THEN score := score + 10; END IF;
  IF s.nationality IS NOT NULL THEN score := score + 10; END IF;
  IF s.id_type IS NOT NULL THEN score := score + 10; END IF;
  IF s.id_number IS NOT NULL THEN score := score + 15; END IF;
  IF s.id_document_path IS NOT NULL THEN score := score + 25; END IF;
  IF s.selfie_path IS NOT NULL THEN score := score + 15; END IF;
  RETURN LEAST(score, 100);
END; $$;

CREATE OR REPLACE FUNCTION public.refresh_kyb_completeness()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.completeness_score := public.compute_kyb_completeness(NEW.id); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_kyb_completeness ON public.kyb_submissions;
CREATE TRIGGER trg_kyb_completeness BEFORE UPDATE ON public.kyb_submissions
  FOR EACH ROW EXECUTE FUNCTION public.refresh_kyb_completeness();

CREATE OR REPLACE FUNCTION public.refresh_kyc_completeness()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN NEW.completeness_score := public.compute_kyc_completeness(NEW.id); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_kyc_completeness ON public.kyc_submissions;
CREATE TRIGGER trg_kyc_completeness BEFORE UPDATE ON public.kyc_submissions
  FOR EACH ROW EXECUTE FUNCTION public.refresh_kyc_completeness();

-- RLS
ALTER TABLE public.kyb_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyb_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyb_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners view own kyb" ON public.kyb_submissions;
CREATE POLICY "Owners view own kyb" ON public.kyb_submissions FOR SELECT USING (
  submitted_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
);

DROP POLICY IF EXISTS "Owners insert own kyb" ON public.kyb_submissions;
CREATE POLICY "Owners insert own kyb" ON public.kyb_submissions FOR INSERT WITH CHECK (
  submitted_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid())
);

DROP POLICY IF EXISTS "Owners update draft kyb" ON public.kyb_submissions;
CREATE POLICY "Owners update draft kyb" ON public.kyb_submissions FOR UPDATE USING (
  (submitted_by = auth.uid() AND status IN ('draft','rejected','needs_changes'))
  OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "View kyb docs via submission" ON public.kyb_documents;
CREATE POLICY "View kyb docs via submission" ON public.kyb_documents FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.kyb_submissions sub WHERE sub.id = submission_id
    AND (sub.submitted_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')))
);

DROP POLICY IF EXISTS "Insert kyb docs own submission" ON public.kyb_documents;
CREATE POLICY "Insert kyb docs own submission" ON public.kyb_documents FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.kyb_submissions sub WHERE sub.id = submission_id
    AND sub.submitted_by = auth.uid() AND sub.status IN ('draft','rejected','needs_changes'))
);

DROP POLICY IF EXISTS "Delete kyb docs draft" ON public.kyb_documents;
CREATE POLICY "Delete kyb docs draft" ON public.kyb_documents FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.kyb_submissions sub WHERE sub.id = submission_id
    AND sub.submitted_by = auth.uid() AND sub.status IN ('draft','rejected','needs_changes'))
);

DROP POLICY IF EXISTS "Admins update kyb docs" ON public.kyb_documents;
CREATE POLICY "Admins update kyb docs" ON public.kyb_documents FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "View own kyc" ON public.kyc_submissions;
CREATE POLICY "View own kyc" ON public.kyc_submissions FOR SELECT USING (
  user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')
);

DROP POLICY IF EXISTS "Insert own kyc" ON public.kyc_submissions;
CREATE POLICY "Insert own kyc" ON public.kyc_submissions FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Update own draft kyc" ON public.kyc_submissions;
CREATE POLICY "Update own draft kyc" ON public.kyc_submissions FOR UPDATE USING (
  (user_id = auth.uid() AND status IN ('draft','rejected','needs_changes'))
  OR public.has_role(auth.uid(),'admin')
);

DROP POLICY IF EXISTS "Admins view kyb audit" ON public.kyb_audit_log;
CREATE POLICY "Admins view kyb audit" ON public.kyb_audit_log FOR SELECT
  USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Admins insert kyb audit" ON public.kyb_audit_log;
CREATE POLICY "Admins insert kyb audit" ON public.kyb_audit_log FOR INSERT
  WITH CHECK (public.has_role(auth.uid(),'admin') AND actor_id = auth.uid());

-- Storage bucket privé
INSERT INTO storage.buckets (id, name, public) VALUES ('kyb-documents','kyb-documents',false)
  ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users upload own kyb docs" ON storage.objects;
CREATE POLICY "Users upload own kyb docs" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'kyb-documents' AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users read own kyb docs" ON storage.objects;
CREATE POLICY "Users read own kyb docs" ON storage.objects FOR SELECT USING (
  bucket_id = 'kyb-documents' AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'manager')
  )
);

DROP POLICY IF EXISTS "Users update own kyb docs" ON storage.objects;
CREATE POLICY "Users update own kyb docs" ON storage.objects FOR UPDATE USING (
  bucket_id = 'kyb-documents' AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users delete own kyb docs" ON storage.objects;
CREATE POLICY "Users delete own kyb docs" ON storage.objects FOR DELETE USING (
  bucket_id = 'kyb-documents' AND auth.uid()::text = (storage.foldername(name))[1]
);