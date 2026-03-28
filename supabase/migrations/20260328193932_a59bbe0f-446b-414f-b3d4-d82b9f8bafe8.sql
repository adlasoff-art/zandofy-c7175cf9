
-- Add returns_enabled column to stores table
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS returns_enabled boolean NOT NULL DEFAULT false;

-- Comment
COMMENT ON COLUMN public.stores.returns_enabled IS 'Admin toggle: allows customers of this store to request returns';
