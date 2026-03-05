
-- Create storage bucket for delivery proofs (signatures + photos)
INSERT INTO storage.buckets (id, name, public) VALUES ('delivery-proofs', 'delivery-proofs', true);

-- Riders can upload their own delivery proofs
CREATE POLICY "Riders upload delivery proofs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'delivery-proofs' AND auth.uid() IS NOT NULL);

-- Public read for delivery proofs
CREATE POLICY "Public read delivery proofs"
ON storage.objects FOR SELECT
USING (bucket_id = 'delivery-proofs');

-- Riders can delete own proofs
CREATE POLICY "Riders delete own delivery proofs"
ON storage.objects FOR DELETE
USING (bucket_id = 'delivery-proofs' AND auth.uid() IS NOT NULL);

-- Add signature_url column to deliveries table
ALTER TABLE public.deliveries ADD COLUMN IF NOT EXISTS signature_url text;
