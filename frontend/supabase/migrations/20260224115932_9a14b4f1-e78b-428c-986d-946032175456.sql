
-- Add promotion date fields to products
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS promo_start_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS promo_end_date timestamp with time zone;

-- Create storage bucket for product media (images + videos)
INSERT INTO storage.buckets (id, name, public) VALUES ('product-media', 'product-media', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access for product media
CREATE POLICY "Public read product media"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-media');

-- Store owners can upload product media
CREATE POLICY "Store owners upload product media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-media' 
  AND auth.uid() IS NOT NULL
);

-- Store owners can update their product media
CREATE POLICY "Store owners update product media"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'product-media' 
  AND auth.uid() IS NOT NULL
);

-- Store owners can delete their product media
CREATE POLICY "Store owners delete product media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'product-media' 
  AND auth.uid() IS NOT NULL
);
