
-- Add admin override columns to products for review count and sales
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS review_count_override integer DEFAULT NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sales_count_override integer DEFAULT NULL;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS verified_years_override integer DEFAULT NULL;

-- Function to get real product review stats
CREATE OR REPLACE FUNCTION public.get_product_real_stats(p_product_id uuid)
RETURNS TABLE(real_review_count bigint, real_avg_rating numeric, real_sales_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    (SELECT COUNT(*) FROM public.reviews WHERE product_id = p_product_id) as real_review_count,
    (SELECT COALESCE(ROUND(AVG(rating)::numeric, 1), 0) FROM public.reviews WHERE product_id = p_product_id) as real_avg_rating,
    (SELECT COUNT(*) FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id WHERE oi.product_id = p_product_id AND o.status = 'delivered') as real_sales_count
  ;
$$;

-- Trigger to update product review_count and rating when a review is added
CREATE OR REPLACE FUNCTION public.update_product_review_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
  v_avg numeric;
BEGIN
  SELECT COUNT(*)::integer, COALESCE(ROUND(AVG(rating)::numeric, 1), 0)
  INTO v_count, v_avg
  FROM public.reviews
  WHERE product_id = COALESCE(NEW.product_id, OLD.product_id);

  UPDATE public.products
  SET review_count = v_count, rating = v_avg
  WHERE id = COALESCE(NEW.product_id, OLD.product_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_update_product_review_stats ON public.reviews;
CREATE TRIGGER trg_update_product_review_stats
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.update_product_review_stats();

-- Reset all products to real review counts (0 since no real reviews exist yet)
UPDATE public.products SET review_count = 0, rating = 0 WHERE review_count > 0;

-- Also add verified_years_override to stores for admin to override store age
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS verified_years_override integer DEFAULT NULL;

-- Also add reviews_override to stores
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS review_count_override integer DEFAULT NULL;
