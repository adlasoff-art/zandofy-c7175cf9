
-- 1. REMOVE SENSITIVE TABLES FROM REALTIME
ALTER PUBLICATION supabase_realtime DROP TABLE public.payment_transactions;
ALTER PUBLICATION supabase_realtime DROP TABLE public.customer_locations;
ALTER PUBLICATION supabase_realtime DROP TABLE public.rider_locations;
ALTER PUBLICATION supabase_realtime DROP TABLE public.withdrawal_requests;

-- 2. HARDEN product-media INSERT
DROP POLICY IF EXISTS "Store owners upload product media" ON storage.objects;
CREATE POLICY "Store owners upload product media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-media'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT s.id::text FROM public.stores s WHERE s.owner_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  )
);

-- 3. FIX supplier-images (vendor_id references stores.id, owned by store owner)
DROP POLICY IF EXISTS "Authenticated users can delete supplier images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their supplier images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update supplier images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their supplier images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload supplier images" ON storage.objects;

CREATE POLICY "Supplier owners delete own images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'supplier-images'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT sup.id::text FROM public.suppliers sup
      JOIN public.stores s ON s.id = sup.vendor_id
      WHERE s.owner_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  )
);

CREATE POLICY "Supplier owners update own images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'supplier-images'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT sup.id::text FROM public.suppliers sup
      JOIN public.stores s ON s.id = sup.vendor_id
      WHERE s.owner_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  )
);

CREATE POLICY "Supplier owners upload own images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'supplier-images'
  AND (
    (storage.foldername(name))[1] IN (
      SELECT sup.id::text FROM public.suppliers sup
      JOIN public.stores s ON s.id = sup.vendor_id
      WHERE s.owner_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  )
);

-- 4. MAKE delivery-proofs AND chat-media PRIVATE
UPDATE storage.buckets SET public = false WHERE id = 'delivery-proofs';
UPDATE storage.buckets SET public = false WHERE id = 'chat-media';

DROP POLICY IF EXISTS "Public read delivery proofs" ON storage.objects;
CREATE POLICY "Scoped read delivery proofs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'delivery-proofs'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.deliveries d
      JOIN public.orders o ON o.id = d.order_id
      WHERE d.id::text = (storage.foldername(name))[2]
      AND o.user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Public read chat media" ON storage.objects;
CREATE POLICY "Participants read chat media"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-media'
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id::text = (storage.foldername(name))[1]
      AND (c.user_id = auth.uid() OR c.store_id IN (
        SELECT s.id FROM public.stores s WHERE s.owner_id = auth.uid()
      ))
    )
  )
);

DROP POLICY IF EXISTS "Riders delete own delivery proofs" ON storage.objects;
