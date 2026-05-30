-- Payment & hub proof uploads: RLS for client paths payment-proofs/{order_id}/...
-- and vendor paths hub-proofs/{order_id}/... (legacy hub-proofs/{order_id}_{ts}.ext still supported).
-- Additive only — does not alter "Riders upload delivery proofs" (rider uid folder).

-- ─── Helpers (inline in policies) ───────────────────────────────────────────
-- payment-proofs: folder[1] = 'payment-proofs', folder[2] = order uuid
-- hub-proofs new:    folder[1] = 'hub-proofs', folder[2] = order uuid
-- hub-proofs legacy: folder[1] = 'hub-proofs', filename = '{order_uuid}_{ts}.ext'

-- ─── Customers: payment proofs ────────────────────────────────────────────────

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
