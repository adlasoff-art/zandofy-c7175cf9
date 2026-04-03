
-- Add product_image_url and platform_id to suppliers
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS product_image_url text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS platform_id uuid REFERENCES public.supplier_platforms(id) ON DELETE SET NULL;

-- Create supplier-images bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('supplier-images', 'supplier-images', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for supplier-images bucket
CREATE POLICY "Authenticated users can upload supplier images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'supplier-images');

CREATE POLICY "Anyone can view supplier images"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'supplier-images');

CREATE POLICY "Authenticated users can update their supplier images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'supplier-images');

CREATE POLICY "Authenticated users can delete their supplier images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'supplier-images');
