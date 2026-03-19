
-- Add supplier order number (e.g. Alibaba, 1688, Pinduoduo order ref)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS supplier_order_number text;
