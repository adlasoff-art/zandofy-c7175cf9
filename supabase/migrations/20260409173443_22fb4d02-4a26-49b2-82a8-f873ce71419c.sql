
INSERT INTO storage.buckets (id, name, public) VALUES ('seo-assets', 'seo-assets', true);

CREATE POLICY "Public read seo assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'seo-assets');

CREATE POLICY "Admins upload seo assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'seo-assets' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete seo assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'seo-assets' AND public.has_role(auth.uid(), 'admin'));
