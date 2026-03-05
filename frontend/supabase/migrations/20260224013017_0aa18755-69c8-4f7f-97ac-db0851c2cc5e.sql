
-- Add timer configuration columns to stores table
ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS flash_timer_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS flash_timer_duration_hours integer DEFAULT 24;

-- Add timer columns to products table for per-product override
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS flash_timer_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS flash_timer_duration_hours integer DEFAULT 24;
