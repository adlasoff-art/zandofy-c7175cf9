
-- Add columns for payment proof uploads and deferred payment tracking
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_payment_proof_url text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS last_mile_payment_proof_url text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS hub_pickup_proof_url text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS deferred_payment_phone text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS deferred_payment_provider text;
