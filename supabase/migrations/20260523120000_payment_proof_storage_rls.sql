-- Payment & hub proof uploads: RLS for client paths payment-proofs/{order_id}/...
-- and vendor paths hub-proofs/{order_id}/... (legacy hub-proofs/{order_id}_{ts}.ext still supported).
-- Additive only — does not alter "Riders upload delivery proofs" (rider uid folder).
-- Idempotent: DROP POLICY IF EXISTS before CREATE (safe re-run after partial apply).

-- ─── Customers: payment proofs ────────────────────────────────────────────────

DROP POLICY IF EXISTS "Customers upload payment proofs" ON storage.objects;
CREATE POLICY "Customers upload payment proofs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'delivery-proofs'
  AND (storage.foldername(name))[1] = 'payment-proofs'
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id::text = (storage.foldername(name))[2]
      AND o.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Customers read own payment proofs" ON storage.objects;
CREATE POLICY "Customers read own payment proofs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'delivery-proofs'
  AND (storage.foldername(name))[1] = 'payment-proofs'
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id::text = (storage.foldername(name))[2]
      AND o.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Customers update own payment proofs" ON storage.objects;
CREATE POLICY "Customers update own payment proofs"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'delivery-proofs'
  AND (storage.foldername(name))[1] = 'payment-proofs'
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id::text = (storage.foldername(name))[2]
      AND o.user_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'delivery-proofs'
  AND (storage.foldername(name))[1] = 'payment-proofs'
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id::text = (storage.foldername(name))[2]
      AND o.user_id = auth.uid()
  )
);

-- ─── Store team: read client payment proofs (validation hors plateforme) ─────

DROP POLICY IF EXISTS "Store team read payment proofs on store orders" ON storage.objects;
CREATE POLICY "Store team read payment proofs on store orders"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'delivery-proofs'
  AND (storage.foldername(name))[1] = 'payment-proofs'
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id::text = (storage.foldername(name))[2]
      AND public.can_access_store_orders(auth.uid(), o.store_id)
  )
);

-- ─── Store team: hub pickup proofs ──────────────────────────────────────────

DROP POLICY IF EXISTS "Store team upload hub proofs" ON storage.objects;
CREATE POLICY "Store team upload hub proofs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'delivery-proofs'
  AND (storage.foldername(name))[1] = 'hub-proofs'
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE public.can_access_store_orders(auth.uid(), o.store_id)
      AND (
        (array_length(storage.foldername(name), 1) >= 2 AND o.id::text = (storage.foldername(name))[2])
        OR split_part(storage.filename(name), '_', 1) = o.id::text
      )
  )
);

DROP POLICY IF EXISTS "Store team read hub proofs on store orders" ON storage.objects;
CREATE POLICY "Store team read hub proofs on store orders"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'delivery-proofs'
  AND (storage.foldername(name))[1] = 'hub-proofs'
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE public.can_access_store_orders(auth.uid(), o.store_id)
      AND (
        (array_length(storage.foldername(name), 1) >= 2 AND o.id::text = (storage.foldername(name))[2])
        OR split_part(storage.filename(name), '_', 1) = o.id::text
      )
  )
);

DROP POLICY IF EXISTS "Store team update hub proofs on store orders" ON storage.objects;
CREATE POLICY "Store team update hub proofs on store orders"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'delivery-proofs'
  AND (storage.foldername(name))[1] = 'hub-proofs'
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE public.can_access_store_orders(auth.uid(), o.store_id)
      AND (
        (array_length(storage.foldername(name), 1) >= 2 AND o.id::text = (storage.foldername(name))[2])
        OR split_part(storage.filename(name), '_', 1) = o.id::text
      )
  )
)
WITH CHECK (
  bucket_id = 'delivery-proofs'
  AND (storage.foldername(name))[1] = 'hub-proofs'
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE public.can_access_store_orders(auth.uid(), o.store_id)
      AND (
        (array_length(storage.foldername(name), 1) >= 2 AND o.id::text = (storage.foldername(name))[2])
        OR split_part(storage.filename(name), '_', 1) = o.id::text
      )
  )
);

-- ─── Customers: read hub proof on own order (dashboard) ─────────────────────

DROP POLICY IF EXISTS "Customers read own hub proofs" ON storage.objects;
CREATE POLICY "Customers read own hub proofs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'delivery-proofs'
  AND (storage.foldername(name))[1] = 'hub-proofs'
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.user_id = auth.uid()
      AND (
        (array_length(storage.foldername(name), 1) >= 2 AND o.id::text = (storage.foldername(name))[2])
        OR split_part(storage.filename(name), '_', 1) = o.id::text
      )
  )
);
