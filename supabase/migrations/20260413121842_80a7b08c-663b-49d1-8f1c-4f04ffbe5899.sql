-- Ensure public read for published products
DROP POLICY IF EXISTS "Public read published products" ON public.products;
CREATE POLICY "Public read published products" ON public.products
  FOR SELECT TO anon, authenticated USING (publish_status = 'published');

-- Ensure public read for stores
DROP POLICY IF EXISTS "Anon read stores" ON public.stores;
CREATE POLICY "Anon read stores" ON public.stores FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Authenticated read stores" ON public.stores;
CREATE POLICY "Authenticated read stores" ON public.stores FOR SELECT TO authenticated USING (true);