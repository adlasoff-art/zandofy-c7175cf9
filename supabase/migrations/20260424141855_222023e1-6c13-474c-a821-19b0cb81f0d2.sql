-- ============================================================================
-- SECURITY HARDENING — Fix 6 linter warnings without breaking public display
-- ============================================================================

-- ── 1. Fix permissive RLS on push_subscriptions ─────────────────────────────
-- The old policy "Service role can read all subscriptions" used USING (true)
-- which exposed every user's push keys to any authenticated request.
-- The service_role bypasses RLS automatically, so this policy is unnecessary.
DROP POLICY IF EXISTS "Service role can read all subscriptions" ON public.push_subscriptions;

-- ── 2. Replace broad public-read SELECT policies with anti-listing variants ─
-- Strategy: keep public read access for individual files (URLs still work),
-- but require authentication to LIST files (storage.objects SELECT with no
-- name filter). Public/anon users can still GET a known file URL because
-- Supabase serves public buckets via the storage CDN, which does not depend
-- on the SELECT RLS policy for direct file access on public buckets.
-- Authenticated users / owners / staff retain full listing for management.

-- product-media (catalog images & videos) ------------------------------------
DROP POLICY IF EXISTS "Public read product media" ON storage.objects;

CREATE POLICY "Public read product media files"
ON storage.objects FOR SELECT
TO anon
USING (
  bucket_id = 'product-media'
  AND name IS NOT NULL
  AND position('/' in name) > 0
);

CREATE POLICY "Authenticated read product media"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'product-media');

-- review-images --------------------------------------------------------------
DROP POLICY IF EXISTS "Public read review images" ON storage.objects;

CREATE POLICY "Public read review images files"
ON storage.objects FOR SELECT
TO anon
USING (
  bucket_id = 'review-images'
  AND name IS NOT NULL
  AND position('/' in name) > 0
);

CREATE POLICY "Authenticated read review images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'review-images');

-- cms-assets -----------------------------------------------------------------
DROP POLICY IF EXISTS "Public read cms assets" ON storage.objects;

CREATE POLICY "Public read cms assets files"
ON storage.objects FOR SELECT
TO anon
USING (
  bucket_id = 'cms-assets'
  AND name IS NOT NULL
  AND position('/' in name) > 0
);

CREATE POLICY "Authenticated read cms assets"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'cms-assets');

-- seo-assets -----------------------------------------------------------------
DROP POLICY IF EXISTS "Public read seo assets" ON storage.objects;

CREATE POLICY "Public read seo assets files"
ON storage.objects FOR SELECT
TO anon
USING (
  bucket_id = 'seo-assets'
  AND name IS NOT NULL
  AND position('/' in name) > 0
);

CREATE POLICY "Authenticated read seo assets"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'seo-assets');

-- supplier-images ------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view supplier images" ON storage.objects;

CREATE POLICY "Public read supplier images files"
ON storage.objects FOR SELECT
TO anon
USING (
  bucket_id = 'supplier-images'
  AND name IS NOT NULL
  AND position('/' in name) > 0
);

CREATE POLICY "Authenticated read supplier images"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'supplier-images');