
-- Add moderation fields to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS moderation_reason TEXT,
ADD COLUMN IF NOT EXISTS moderation_reason_link TEXT,
ADD COLUMN IF NOT EXISTS moderated_by UUID,
ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ;
