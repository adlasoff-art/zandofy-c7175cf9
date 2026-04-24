-- product-media --------------------------------------------------------------
DROP POLICY IF EXISTS "Public read product media files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read product media" ON storage.objects;

CREATE POLICY "Owners list product media"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'product-media'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR (storage.foldername(name))[1] IN (
      SELECT s.id::text FROM stores s WHERE s.owner_id = auth.uid()
    )
  )
);

-- review-images --------------------------------------------------------------
DROP POLICY IF EXISTS "Public read review images files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read review images" ON storage.objects;

CREATE POLICY "Owners list review images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'review-images'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

-- cms-assets -----------------------------------------------------------------
DROP POLICY IF EXISTS "Public read cms assets files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read cms assets" ON storage.objects;

CREATE POLICY "Staff list cms assets"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'cms-assets'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  )
);

-- seo-assets -----------------------------------------------------------------
DROP POLICY IF EXISTS "Public read seo assets files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read seo assets" ON storage.objects;

CREATE POLICY "Staff list seo assets"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'seo-assets'
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- supplier-images ------------------------------------------------------------
DROP POLICY IF EXISTS "Public read supplier images files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read supplier images" ON storage.objects;

CREATE POLICY "Owners list supplier images"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'supplier-images'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR (storage.foldername(name))[1] IN (
      SELECT sup.id::text FROM suppliers sup WHERE sup.vendor_id = auth.uid()
    )
  )
);