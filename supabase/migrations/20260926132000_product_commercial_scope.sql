-- Purpose: Product commercial_scope + optional CUSTOM destinations; helper for effective scope.
-- Tables: products, product_shipping_destinations, product_shipping_destination_cities
-- Risk: additive; default inherit — no behavior change until eligibility enforced

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS commercial_scope text;

UPDATE public.products
SET commercial_scope = 'inherit'
WHERE commercial_scope IS NULL;

ALTER TABLE public.products
  ALTER COLUMN commercial_scope SET DEFAULT 'inherit';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_commercial_scope_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_commercial_scope_check
      CHECK (commercial_scope IN ('inherit', 'city', 'country', 'international', 'custom'));
  END IF;
END $$;

ALTER TABLE public.products
  ALTER COLUMN commercial_scope SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_commercial_scope
  ON public.products (commercial_scope);

COMMENT ON COLUMN public.products.commercial_scope IS
  'inherit = store.default_commercial_scope; custom uses product_shipping_destinations.';

CREATE TABLE IF NOT EXISTS public.product_shipping_destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  mode text NOT NULL DEFAULT 'whole_country',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_shipping_destinations_country_check
    CHECK (country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT product_shipping_destinations_mode_check
    CHECK (mode IN ('whole_country', 'selected_cities')),
  CONSTRAINT product_shipping_destinations_product_country_unique
    UNIQUE (product_id, country_code)
);

CREATE TABLE IF NOT EXISTS public.product_shipping_destination_cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destination_id uuid NOT NULL REFERENCES public.product_shipping_destinations(id) ON DELETE CASCADE,
  city_id uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_shipping_destination_cities_unique
    UNIQUE (destination_id, city_id)
);

CREATE INDEX IF NOT EXISTS idx_product_shipping_destinations_product
  ON public.product_shipping_destinations (product_id)
  WHERE active = true;

ALTER TABLE public.product_shipping_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_shipping_destination_cities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owners_manage_product_shipping_destinations" ON public.product_shipping_destinations;
CREATE POLICY "owners_manage_product_shipping_destinations"
ON public.product_shipping_destinations
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.stores s ON s.id = p.store_id
    WHERE p.id = product_id
      AND (s.owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.stores s ON s.id = p.store_id
    WHERE p.id = product_id
      AND (s.owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
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
      AND (s.owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.product_shipping_destinations d
    JOIN public.products p ON p.id = d.product_id
    JOIN public.stores s ON s.id = p.store_id
    WHERE d.id = destination_id
      AND (s.owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  )
);

DROP POLICY IF EXISTS "public_read_product_shipping_destinations" ON public.product_shipping_destinations;
CREATE POLICY "public_read_product_shipping_destinations"
ON public.product_shipping_destinations
FOR SELECT TO anon, authenticated
USING (active = true);

DROP POLICY IF EXISTS "public_read_product_shipping_destination_cities" ON public.product_shipping_destination_cities;
CREATE POLICY "public_read_product_shipping_destination_cities"
ON public.product_shipping_destination_cities
FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.product_shipping_destinations d
    WHERE d.id = destination_id AND d.active = true
  )
);

CREATE OR REPLACE FUNCTION public.product_effective_commercial_scope(p_product_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN COALESCE(p.commercial_scope, 'inherit') = 'inherit'
      THEN COALESCE(s.default_commercial_scope, 'country')
    ELSE p.commercial_scope
  END
  FROM public.products p
  JOIN public.stores s ON s.id = p.store_id
  WHERE p.id = p_product_id;
$$;

REVOKE ALL ON FUNCTION public.product_effective_commercial_scope(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.product_effective_commercial_scope(uuid) TO anon, authenticated, service_role;
