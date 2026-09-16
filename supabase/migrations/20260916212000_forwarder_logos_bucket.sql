-- Purpose: Vague 3 — forwarder logos bucket (public read) for settings upload.
-- Risk: Additive storage only.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'forwarder-logos',
  'forwarder-logos',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "forwarder_logos_public_read" ON storage.objects;
CREATE POLICY "forwarder_logos_public_read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'forwarder-logos');

DROP POLICY IF EXISTS "forwarder_logos_owner_write" ON storage.objects;
CREATE POLICY "forwarder_logos_owner_write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'forwarder-logos'
    AND EXISTS (
      SELECT 1 FROM public.forwarders f
      WHERE f.id::text = (storage.foldername(name))[1]
        AND public.user_owns_forwarder(f.id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "forwarder_logos_owner_update" ON storage.objects;
CREATE POLICY "forwarder_logos_owner_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'forwarder-logos'
    AND EXISTS (
      SELECT 1 FROM public.forwarders f
      WHERE f.id::text = (storage.foldername(name))[1]
        AND public.user_owns_forwarder(f.id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "forwarder_logos_owner_delete" ON storage.objects;
CREATE POLICY "forwarder_logos_owner_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'forwarder-logos'
    AND EXISTS (
      SELECT 1 FROM public.forwarders f
      WHERE f.id::text = (storage.foldername(name))[1]
        AND public.user_owns_forwarder(f.id, auth.uid())
    )
  );
