CREATE POLICY "Admins update seo assets"
ON storage.objects FOR UPDATE
USING (bucket_id = 'seo-assets' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'seo-assets' AND public.has_role(auth.uid(), 'admin'));