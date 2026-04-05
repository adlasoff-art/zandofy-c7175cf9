
-- Add suspension/ban fields to stores table
ALTER TABLE public.stores
ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS suspension_reason text,
ADD COLUMN IF NOT EXISTS ban_reason text,
ADD COLUMN IF NOT EXISTS suspended_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS banned_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS suspended_by uuid,
ADD COLUMN IF NOT EXISTS banned_by uuid,
ADD COLUMN IF NOT EXISTS suspended_activities text[] DEFAULT '{}';

-- suspended_activities can contain: 'sales', 'messaging', 'product_listing', 'withdrawals', 'promotions'
-- If empty and is_suspended=true, ALL activities are suspended
