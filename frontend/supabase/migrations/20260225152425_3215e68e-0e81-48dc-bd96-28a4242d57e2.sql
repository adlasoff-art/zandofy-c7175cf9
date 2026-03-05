
-- Add banner_url and rating to stores
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS banner_url text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS rating numeric DEFAULT 0;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS response_rate text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS response_time text;
