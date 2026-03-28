
-- Add sales_count to products (real count, updated by trigger)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sales_count integer NOT NULL DEFAULT 0;

-- Add care_instructions and season columns
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS care_instructions text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS season text;

-- Trigger to update product sales_count when an order is delivered
CREATE OR REPLACE FUNCTION public.update_product_sales_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  
  IF NEW.status = 'delivered' AND OLD.status != 'delivered' THEN
    UPDATE public.products p
    SET sales_count = sales_count + oi.qty
    FROM (
      SELECT product_id, SUM(quantity)::int AS qty
      FROM public.order_items
      WHERE order_id = NEW.id AND product_id IS NOT NULL
      GROUP BY product_id
    ) oi
    WHERE p.id = oi.product_id;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_product_sales_count ON public.orders;
CREATE TRIGGER trg_update_product_sales_count
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_product_sales_count();

-- Backfill existing delivered orders
UPDATE public.products p
SET sales_count = COALESCE(sub.total_sold, 0)
FROM (
  SELECT oi.product_id, SUM(oi.quantity)::int AS total_sold
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE o.status = 'delivered' AND oi.product_id IS NOT NULL
  GROUP BY oi.product_id
) sub
WHERE p.id = sub.product_id;
