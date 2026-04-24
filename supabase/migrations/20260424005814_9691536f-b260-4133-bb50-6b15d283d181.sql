-- Lot 4A: Freight quotes persistence

CREATE TABLE IF NOT EXISTS public.freight_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  profile_id uuid NOT NULL REFERENCES public.forwarder_pricing_profiles(id) ON DELETE RESTRICT,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,

  cbm numeric(12,4) NOT NULL DEFAULT 0,
  weight_kg numeric(12,3) NOT NULL DEFAULT 0,
  pieces_count integer NOT NULL DEFAULT 0,

  quoted_price numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'USD',
  deposit_amount numeric(12,2) NOT NULL DEFAULT 0,
  deposit_pct numeric(5,2) NOT NULL DEFAULT 0,
  requires_deposit boolean NOT NULL DEFAULT false,

  transit_min_days integer,
  transit_max_days integer,

  restrictions_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,

  valid_until timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','locked','consumed','expired')),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_freight_quotes_user ON public.freight_quotes(user_id);
CREATE INDEX IF NOT EXISTS idx_freight_quotes_order ON public.freight_quotes(order_id);
CREATE INDEX IF NOT EXISTS idx_freight_quotes_profile ON public.freight_quotes(profile_id);
CREATE INDEX IF NOT EXISTS idx_freight_quotes_status ON public.freight_quotes(status);

-- Add column to orders to link consumed quote
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS freight_quote_id uuid REFERENCES public.freight_quotes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_freight_quote ON public.orders(freight_quote_id);

-- Updated_at trigger
DROP TRIGGER IF EXISTS trg_freight_quotes_updated_at ON public.freight_quotes;
CREATE TRIGGER trg_freight_quotes_updated_at
  BEFORE UPDATE ON public.freight_quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.freight_quotes ENABLE ROW LEVEL SECURITY;

-- RLS: client sees own quotes
CREATE POLICY "Users view own freight quotes"
  ON public.freight_quotes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS: client creates own quotes
CREATE POLICY "Users create own freight quotes"
  ON public.freight_quotes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- RLS: client locks/updates own pending quotes only (not consumed/expired)
CREATE POLICY "Users update own pending freight quotes"
  ON public.freight_quotes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status IN ('pending','locked'))
  WITH CHECK (auth.uid() = user_id);

-- RLS: vendor sees quotes linked to their store orders
CREATE POLICY "Vendors view freight quotes on their orders"
  ON public.freight_quotes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      JOIN public.stores s ON s.id = o.store_id
      WHERE o.id = freight_quotes.order_id
        AND s.owner_id = auth.uid()
    )
  );

-- RLS: admin full access
CREATE POLICY "Admins manage all freight quotes"
  ON public.freight_quotes
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Function to mark expired quotes (called by cron or on-demand)
CREATE OR REPLACE FUNCTION public.expire_old_freight_quotes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.freight_quotes
  SET status = 'expired', updated_at = now()
  WHERE status IN ('pending','locked')
    AND valid_until < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;