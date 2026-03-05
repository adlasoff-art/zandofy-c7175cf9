
-- Allow store owners to insert products for their store
CREATE POLICY "Store owners insert products"
ON public.products
FOR INSERT
WITH CHECK (
  store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
);

-- Allow store owners to update their products
CREATE POLICY "Store owners update products"
ON public.products
FOR UPDATE
USING (
  store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
);

-- Allow store owners to delete their products
CREATE POLICY "Store owners delete products"
ON public.products
FOR DELETE
USING (
  store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid())
);

-- Allow store owners to manage product images
CREATE POLICY "Store owners insert product_images"
ON public.product_images
FOR INSERT
WITH CHECK (
  product_id IN (
    SELECT p.id FROM public.products p
    JOIN public.stores s ON s.id = p.store_id
    WHERE s.owner_id = auth.uid()
  )
);

CREATE POLICY "Store owners update product_images"
ON public.product_images
FOR UPDATE
USING (
  product_id IN (
    SELECT p.id FROM public.products p
    JOIN public.stores s ON s.id = p.store_id
    WHERE s.owner_id = auth.uid()
  )
);

CREATE POLICY "Store owners delete product_images"
ON public.product_images
FOR DELETE
USING (
  product_id IN (
    SELECT p.id FROM public.products p
    JOIN public.stores s ON s.id = p.store_id
    WHERE s.owner_id = auth.uid()
  )
);
