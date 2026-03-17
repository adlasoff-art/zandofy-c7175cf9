ALTER TABLE public.featured_placements 
ADD COLUMN IF NOT EXISTS show_timer BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS timer_color TEXT DEFAULT '#ffffff';