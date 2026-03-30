-- Add province to saved_addresses
ALTER TABLE public.saved_addresses ADD COLUMN IF NOT EXISTS province text;

-- Add shipping_province to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_province text;