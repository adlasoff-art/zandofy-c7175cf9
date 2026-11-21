-- Purpose: Allow store team (when permitted) and staff to INSERT/UPDATE
--          payment proofs under payment-proofs/{order_id}/...
-- Depends on: 20261121120000_vendor_may_upload_payment_proof.sql
--             (public.store_may_upload_payment_proof)
-- Bucket: delivery-proofs (private)
-- Additive only — does not alter customer upload/read/update policies.
-- Risk: medium — expands who can write payment-proof paths; gated by
--       can_access_store_orders + store_may_upload_payment_proof for vendors;
--       admin/manager always allowed (rescue) if path maps to an existing order.
-- Rollback:
--   DROP POLICY IF EXISTS "Store team upload payment proofs" ON storage.objects;
--   DROP POLICY IF EXISTS "Store team update payment proofs" ON storage.objects;
--   DROP POLICY IF EXISTS "Staff upload payment proofs" ON storage.objects;
--   DROP POLICY IF EXISTS "Staff update payment proofs" ON storage.objects;
-- Staging → production: apply after I1 migration; smoke-test vendor upload on
--   a platform-owned store (default may_upload=true) then an independent with
--   flag false (must still fail for vendor, succeed for admin).

-- ─── Store team: upload / upsert when store permission is effective ON ───────

DROP POLICY IF EXISTS "Store team upload payment proofs" ON storage.objects;
CREATE POLICY "Store team upload payment proofs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'delivery-proofs'
  AND (storage.foldername(name))[1] = 'payment-proofs'
  AND EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id::text = (storage.foldername(name))[2]
      AND public.can_access_store_orders(auth.uid(), o.store_id)
      AND public.store_may_upload_payment_proof(o.store_id)
  )
);

DROP POLICY IF EXISTS "Store team update payment proofs" ON storage.objects;
CREATE POLICY "Store team update payment proofs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'delivery-proofs'
  AND (storage.foldername(name))[1] = 'payment-proofs'
  AND EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id::text = (storage.foldername(name))[2]
      AND public.can_access_store_orders(auth.uid(), o.store_id)
      AND public.store_may_upload_payment_proof(o.store_id)
  )
)
WITH CHECK (
  bucket_id = 'delivery-proofs'
  AND (storage.foldername(name))[1] = 'payment-proofs'
  AND EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id::text = (storage.foldername(name))[2]
      AND public.can_access_store_orders(auth.uid(), o.store_id)
      AND public.store_may_upload_payment_proof(o.store_id)
  )
);

-- ─── Staff: always allowed (secours), path must map to a real order ──────────

DROP POLICY IF EXISTS "Staff upload payment proofs" ON storage.objects;
CREATE POLICY "Staff upload payment proofs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'delivery-proofs'
  AND (storage.foldername(name))[1] = 'payment-proofs'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  )
  AND EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id::text = (storage.foldername(name))[2]
  )
);

DROP POLICY IF EXISTS "Staff update payment proofs" ON storage.objects;
CREATE POLICY "Staff update payment proofs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'delivery-proofs'
  AND (storage.foldername(name))[1] = 'payment-proofs'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  )
  AND EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id::text = (storage.foldername(name))[2]
  )
)
WITH CHECK (
  bucket_id = 'delivery-proofs'
  AND (storage.foldername(name))[1] = 'payment-proofs'
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  )
  AND EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id::text = (storage.foldername(name))[2]
  )
);
