ALTER TABLE public.featured_placement_requests ADD COLUMN IF NOT EXISTS request_type text DEFAULT 'product';
ALTER TABLE public.featured_placement_requests ADD COLUMN IF NOT EXISTS internal_link text;