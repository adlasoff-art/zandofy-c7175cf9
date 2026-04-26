-- Bucket privé pour les documents transitaires
INSERT INTO storage.buckets (id, name, public)
VALUES ('forwarder-documents', 'forwarder-documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS : owner uploade dans son propre dossier
CREATE POLICY "forwarder_docs_owner_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'forwarder-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

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

CREATE POLICY "forwarder_docs_owner_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'forwarder-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Champs nécessaires sur forwarders pour le flow public (status workflow)
ALTER TABLE public.forwarders
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'approved'
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

-- Owner peut lire son propre dossier transitaire (en plus des admins)
DROP POLICY IF EXISTS "forwarders_owner_read" ON public.forwarders;
CREATE POLICY "forwarders_owner_read"
ON public.forwarders FOR SELECT
TO authenticated
USING (owner_user_id = auth.uid() OR linked_transporter_user_id = auth.uid());

-- Owner peut updater son propre dossier (champs limités via app)
DROP POLICY IF EXISTS "forwarders_owner_update" ON public.forwarders;
CREATE POLICY "forwarders_owner_update"
ON public.forwarders FOR UPDATE
TO authenticated
USING (owner_user_id = auth.uid())
WITH CHECK (owner_user_id = auth.uid());