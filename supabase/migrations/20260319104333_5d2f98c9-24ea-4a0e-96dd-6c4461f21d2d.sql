-- Add shipping payment status (paid at checkout vs deferred to arrival)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_payment_status text DEFAULT 'paid';

-- Add last-mile payment status (pending, paid_online, paid_cash)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS last_mile_payment_status text DEFAULT 'pending';

-- Rider confirms cash collected
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS rider_cash_collected boolean DEFAULT false;