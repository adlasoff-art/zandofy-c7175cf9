
-- =====================================================================
-- LOT 3F — Hardening sécurité non-cassant
-- =====================================================================

-- ---------------------------------------------------------------------
-- 3F.1 — stores : vue publique + lecture anonyme désactivée
-- ---------------------------------------------------------------------

DROP VIEW IF EXISTS public.stores_public CASCADE;

CREATE VIEW public.stores_public WITH (security_invoker=on) AS
SELECT
  id, name, slug, logo_url, banner_url, description,
  country, city, address,
  is_verified, is_certified,
  verified_years, verified_years_override,
  is_online, last_seen_at, presence_visible,
  sales_count, sales_override,
  followers_count, followers_override,
  products_count, repurchase_rate, sales_trend,
  rating, response_rate, response_time,
  review_count_override,
  shop_type, fulfillment_type, is_platform_owned,
  is_banned, is_suspended, suspended_activities,
  flash_timer_enabled, flash_timer_duration_hours,
  chat_media_enabled, chat_links_allowed, chat_phone_allowed,
  meta_title, meta_description, seo_keywords,
  default_transit_days_min, default_transit_days_max,
  returns_enabled,
  created_at
FROM public.stores;

GRANT SELECT ON public.stores_public TO anon, authenticated;

-- Remplacer les policies SELECT publiques par une policy authentifiée scoped
DROP POLICY IF EXISTS "Anon read stores" ON public.stores;
DROP POLICY IF EXISTS "Authenticated read stores" ON public.stores;
DROP POLICY IF EXISTS "Public read stores" ON public.stores;

-- Owner / collaborateur actif / staff : accès complet à stores
CREATE POLICY "Owner staff read full store"
ON public.stores FOR SELECT
TO authenticated
USING (
  owner_id = auth.uid()
  OR public.can_access_store_orders(auth.uid(), id)
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
);

-- ---------------------------------------------------------------------
-- 3F.2 — forwarders : vue publique sans contacts
-- ---------------------------------------------------------------------

DROP VIEW IF EXISTS public.forwarders_public CASCADE;

CREATE VIEW public.forwarders_public WITH (security_invoker=on) AS
SELECT
  id, name, slug, logo_url, description,
  website_url, is_active, sort_order,
  created_at, updated_at
FROM public.forwarders
WHERE is_active = true;

GRANT SELECT ON public.forwarders_public TO anon, authenticated;

-- Retirer la lecture publique directe de forwarders
DROP POLICY IF EXISTS "forwarders_public_read_active" ON public.forwarders;

-- ---------------------------------------------------------------------
-- 3F.3 — error_reports : forcer user_email côté serveur
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_error_report_user_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.user_id := auth.uid();
    SELECT email INTO NEW.user_email FROM public.profiles WHERE id = auth.uid();
  ELSE
    NEW.user_id := NULL;
    NEW.user_email := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_error_report_user_email ON public.error_reports;
CREATE TRIGGER trg_enforce_error_report_user_email
BEFORE INSERT ON public.error_reports
FOR EACH ROW
EXECUTE FUNCTION public.enforce_error_report_user_email();

-- ---------------------------------------------------------------------
-- 3F.4 — vendor_customer_reviews : le client peut relire ses avis
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Customers read own vendor reviews" ON public.vendor_customer_reviews;
CREATE POLICY "Customers read own vendor reviews"
ON public.vendor_customer_reviews FOR SELECT
TO authenticated
USING (customer_id = auth.uid());

-- ---------------------------------------------------------------------
-- 3F.5 — automation_user_progress : bloquer énumération anonyme
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Anon can read own progress" ON public.automation_user_progress;
DROP POLICY IF EXISTS "Users read own progress" ON public.automation_user_progress;
DROP POLICY IF EXISTS "Users update own progress" ON public.automation_user_progress;
DROP POLICY IF EXISTS "Users insert own progress" ON public.automation_user_progress;

-- Recréer policies authentifiées strictes (garde existantes "Users can ..." et "Anon can insert progress")
-- Les anciennes policies "Users read/update/insert own progress" autorisaient anon_id en SELECT — supprimées ci-dessus.
-- Les policies "Users can view/insert/update own progress" (user_id = auth.uid()) restent en place.

-- ---------------------------------------------------------------------
-- 3F.6 — Always-True policy : restreindre uploads supplier-images
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "Supplier owners upload own images" ON storage.objects;
CREATE POLICY "Supplier owners upload own images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'supplier-images'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT sup.id::text
      FROM public.suppliers sup
      JOIN public.stores s ON s.id = sup.vendor_id
      WHERE s.owner_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  )
);

-- Idem chat-media, review-images, vendor-documents, KYC : restreindre les INSERT au folder = auth.uid()
DROP POLICY IF EXISTS "Authenticated users can upload chat media" ON storage.objects;
CREATE POLICY "Authenticated users can upload chat media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users upload review images" ON storage.objects;
CREATE POLICY "Users upload review images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'review-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users upload own vendor docs" ON storage.objects;
CREATE POLICY "Users upload own vendor docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'vendor-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users upload own KYC docs" ON storage.objects;
CREATE POLICY "Users upload own KYC docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'kyc-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Riders upload delivery proofs" ON storage.objects;
CREATE POLICY "Riders upload delivery proofs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'delivery-proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Staff upload cms assets" ON storage.objects;
CREATE POLICY "Staff upload cms assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'cms-assets'
  AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
);

DROP POLICY IF EXISTS "Admins upload seo assets" ON storage.objects;
CREATE POLICY "Admins upload seo assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'seo-assets'
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

DROP POLICY IF EXISTS "Store owners upload product media" ON storage.objects;
CREATE POLICY "Store owners upload product media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-media'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT s.id::text FROM public.stores s WHERE s.owner_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  )
);
