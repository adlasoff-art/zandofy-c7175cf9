
INSERT INTO storage.buckets (id, name, public) VALUES ('supplier-images', 'supplier-images', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated users can upload supplier images" ON storage.objects;
CREATE POLICY "Authenticated users can upload supplier images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'supplier-images');

DROP POLICY IF EXISTS "Anyone can view supplier images" ON storage.objects;
CREATE POLICY "Anyone can view supplier images" ON storage.objects FOR SELECT TO public USING (bucket_id = 'supplier-images');

DROP POLICY IF EXISTS "Authenticated users can update supplier images" ON storage.objects;
CREATE POLICY "Authenticated users can update supplier images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'supplier-images');

DROP POLICY IF EXISTS "Authenticated users can delete supplier images" ON storage.objects;
CREATE POLICY "Authenticated users can delete supplier images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'supplier-images');
