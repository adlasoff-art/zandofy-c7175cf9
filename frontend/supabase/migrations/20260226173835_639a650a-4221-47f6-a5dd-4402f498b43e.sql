
-- Add columns for store name change approval workflow
ALTER TABLE public.stores
ADD COLUMN pending_name text DEFAULT NULL,
ADD COLUMN name_change_status text DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.stores.pending_name IS 'Store name submitted for approval, not yet public';
COMMENT ON COLUMN public.stores.name_change_status IS 'Status of name change: pending_review, approved, rejected';
