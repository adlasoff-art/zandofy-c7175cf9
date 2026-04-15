ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS country text;