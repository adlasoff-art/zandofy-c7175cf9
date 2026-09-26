-- Purpose: Allow active store collaborators to manage commercial destinations (parity with other store RLS).
-- Tables: store_shipping_destinations*, product_shipping_destinations*
-- Risk: low — expands write access to existing collaborator model only

DROP POLICY IF EXISTS "store_owners_manage_shipping_destinations" ON public.store_shipping_destinations;
CREATE POLICY "store_owners_manage_shipping_destinations"
ON public.store_shipping_destinations
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = store_id AND s.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.store_collaborators sc
    WHERE sc.store_id = store_shipping_destinations.store_id
      AND sc.user_id = auth.uid()
      AND sc.status = 'active'
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = store_id AND s.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.store_collaborators sc
    WHERE sc.store_id = store_shipping_destinations.store_id
      AND sc.user_id = auth.uid()
      AND sc.status = 'active'
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
);

DROP POLICY IF EXISTS "store_owners_manage_shipping_destination_cities" ON public.store_shipping_destination_cities;
CREATE POLICY "store_owners_manage_shipping_destination_cities"
ON public.store_shipping_destination_cities
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.store_shipping_destinations d
    JOIN public.stores s ON s.id = d.store_id
    WHERE d.id = destination_id
      AND (
        s.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.store_collaborators sc
          WHERE sc.store_id = s.id AND sc.user_id = auth.uid() AND sc.status = 'active'
        )
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'manager'::app_role)
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.store_shipping_destinations d
    JOIN public.stores s ON s.id = d.store_id
    WHERE d.id = destination_id
      AND (
        s.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.store_collaborators sc
          WHERE sc.store_id = s.id AND sc.user_id = auth.uid() AND sc.status = 'active'
        )
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'manager'::app_role)
      )
  )
);

DROP POLICY IF EXISTS "owners_manage_product_shipping_destinations" ON public.product_shipping_destinations;
CREATE POLICY "owners_manage_product_shipping_destinations"
ON public.product_shipping_destinations
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.stores s ON s.id = p.store_id
    WHERE p.id = product_id
      AND (
        s.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.store_collaborators sc
          WHERE sc.store_id = s.id AND sc.user_id = auth.uid() AND sc.status = 'active'
        )
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'manager'::app_role)
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.stores s ON s.id = p.store_id
    WHERE p.id = product_id
      AND (
        s.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.store_collaborators sc
          WHERE sc.store_id = s.id AND sc.user_id = auth.uid() AND sc.status = 'active'
        )
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'manager'::app_role)
      )
  )
);

DROP POLICY IF EXISTS "owners_manage_product_shipping_destination_cities" ON public.product_shipping_destination_cities;
CREATE POLICY "owners_manage_product_shipping_destination_cities"
ON public.product_shipping_destination_cities
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.product_shipping_destinations d
    JOIN public.products p ON p.id = d.product_id
    JOIN public.stores s ON s.id = p.store_id
    WHERE d.id = destination_id
      AND (
        s.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.store_collaborators sc
          WHERE sc.store_id = s.id AND sc.user_id = auth.uid() AND sc.status = 'active'
        )
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'manager'::app_role)
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.product_shipping_destinations d
    JOIN public.products p ON p.id = d.product_id
    JOIN public.stores s ON s.id = p.store_id
    WHERE d.id = destination_id
      AND (
        s.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.store_collaborators sc
          WHERE sc.store_id = s.id AND sc.user_id = auth.uid() AND sc.status = 'active'
        )
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'manager'::app_role)
      )
  )
);
