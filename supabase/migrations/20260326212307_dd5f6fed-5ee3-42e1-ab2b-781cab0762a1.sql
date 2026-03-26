-- Add sort_order to categories for manual ordering
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

-- Add model_size to products (e.g., "M", "XL", "42" for shoe size)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS model_size text;