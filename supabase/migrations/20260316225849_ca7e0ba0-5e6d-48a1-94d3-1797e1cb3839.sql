
-- Add collaborators_enabled flag to stores (admin must approve before vendor can use team tab)
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS collaborators_enabled boolean NOT NULL DEFAULT false;
