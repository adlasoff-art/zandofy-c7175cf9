ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS supplier_link text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS supplier_order_number text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS supplier_platform_id uuid REFERENCES public.supplier_platforms(id);