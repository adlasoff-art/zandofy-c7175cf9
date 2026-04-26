-- ============================================================
-- Phase 10.1 — Forwarder KYB (relocalisation depuis root + fix default status)
-- ============================================================

-- Bucket privé pour les documents transitaires
INSERT INTO storage.buckets (id, name, public)
VALUES ('forwarder-documents', 'forwarder-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS Storage : owner uploade dans son propre dossier
DROP POLICY IF EXISTS "forwarder_docs_owner_insert" ON storage.objects;
CREATE POLICY "forwarder_docs_owner_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'forwarder-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "forwarder_docs_owner_read" ON storage.objects;
CREATE POLICY "forwarder_docs_owner_read"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'forwarder-documents'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  )
);

DROP POLICY IF EXISTS "forwarder_docs_owner_delete" ON storage.objects;
CREATE POLICY "forwarder_docs_owner_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'forwarder-documents'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

DROP POLICY IF EXISTS "forwarder_docs_owner_update" ON storage.objects;
CREATE POLICY "forwarder_docs_owner_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'forwarder-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Champs KYB sur forwarders : DEFAULT 'pending' pour sécuriser la modération
ALTER TABLE public.forwarders
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','suspended')),
  ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS registration_number text,
  ADD COLUMN IF NOT EXISTS tax_id text,
  ADD COLUMN IF NOT EXISTS headquarters_country text,
  ADD COLUMN IF NOT EXISTS headquarters_city text,
  ADD COLUMN IF NOT EXISTS headquarters_address text,
  ADD COLUMN IF NOT EXISTS supported_modes text[] NOT NULL DEFAULT ARRAY['air']::text[],
  ADD COLUMN IF NOT EXISTS coverage_routes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS estimated_monthly_volume_kg numeric,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS documents jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Au cas où la colonne existe déjà avec DEFAULT 'approved' (env staging),
-- on force le DEFAULT à 'pending' sans toucher aux lignes existantes.
ALTER TABLE public.forwarders ALTER COLUMN status SET DEFAULT 'pending';

-- Owner peut lire son propre dossier transitaire
DROP POLICY IF EXISTS "forwarders_owner_read" ON public.forwarders;
CREATE POLICY "forwarders_owner_read"
ON public.forwarders FOR SELECT
TO authenticated
USING (owner_user_id = auth.uid() OR linked_transporter_user_id = auth.uid());

-- Owner peut updater son propre dossier
DROP POLICY IF EXISTS "forwarders_owner_update" ON public.forwarders;
CREATE POLICY "forwarders_owner_update"
ON public.forwarders FOR UPDATE
TO authenticated
USING (owner_user_id = auth.uid())
WITH CHECK (owner_user_id = auth.uid());

-- Index pour requêtes admin (pending queue)
CREATE INDEX IF NOT EXISTS idx_forwarders_status ON public.forwarders(status);
CREATE INDEX IF NOT EXISTS idx_forwarders_owner ON public.forwarders(owner_user_id);