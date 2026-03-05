
-- 1. Store followers table
CREATE TABLE public.store_followers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(store_id, user_id)
);
ALTER TABLE public.store_followers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view followers" ON public.store_followers FOR SELECT USING (true);
CREATE POLICY "Users can follow stores" ON public.store_followers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unfollow stores" ON public.store_followers FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 2. Add max_products_limit and sales_count to stores
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS max_products_limit integer DEFAULT 10;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS sales_count integer DEFAULT 0;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS followers_override integer DEFAULT NULL;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS sales_override integer DEFAULT NULL;

-- 3. CMS popup announcements table
CREATE TABLE public.cms_popups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  image_url text,
  link text,
  link_label text DEFAULT 'En savoir plus',
  is_active boolean NOT NULL DEFAULT false,
  display_frequency text NOT NULL DEFAULT 'once',
  start_date timestamptz,
  end_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cms_popups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active popups" ON public.cms_popups FOR SELECT USING (true);
CREATE POLICY "Admins manage popups" ON public.cms_popups FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 4. Cookie consent settings (stored in platform_settings, no new table needed)

-- 5. Function to get real follower count for a store
CREATE OR REPLACE FUNCTION public.get_store_followers_count(p_store_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer FROM public.store_followers WHERE store_id = p_store_id;
$$;

-- 6. Function to get real sales count for a store  
CREATE OR REPLACE FUNCTION public.get_store_sales_count(p_store_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer FROM public.orders WHERE store_id = p_store_id AND status = 'delivered';
$$;

-- 7. Trigger to update store sales_count on order delivery
CREATE OR REPLACE FUNCTION public.update_store_sales_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NEW; END IF;
  IF NEW.status = 'delivered' AND NEW.store_id IS NOT NULL THEN
    UPDATE public.stores SET sales_count = sales_count + 1 WHERE id = NEW.store_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_store_sales_count
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_store_sales_count();

-- 8. Top seller ranking view per category
CREATE OR REPLACE FUNCTION public.get_category_top_sellers(p_category_id uuid, p_limit integer DEFAULT 10)
RETURNS TABLE(store_id uuid, store_name text, total_sales bigint, rank bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    s.id as store_id,
    s.name as store_name,
    COUNT(oi.id)::bigint as total_sales,
    ROW_NUMBER() OVER (ORDER BY COUNT(oi.id) DESC)::bigint as rank
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id AND o.status = 'delivered'
  JOIN public.products p ON p.id = oi.product_id AND p.category_id = p_category_id
  JOIN public.stores s ON s.id = p.store_id
  GROUP BY s.id, s.name
  ORDER BY total_sales DESC
  LIMIT p_limit;
$$;

-- 9. Update store review count/rating from reviews
CREATE OR REPLACE FUNCTION public.update_store_rating_from_reviews()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id uuid;
  v_avg numeric;
BEGIN
  -- Get store_id from product
  SELECT p.store_id INTO v_store_id FROM public.products p WHERE p.id = NEW.product_id;
  IF v_store_id IS NULL THEN RETURN NEW; END IF;
  
  -- Calculate avg rating across all store products
  SELECT ROUND(AVG(r.rating)::numeric, 1) INTO v_avg
  FROM public.reviews r
  JOIN public.products p ON p.id = r.product_id
  WHERE p.store_id = v_store_id;
  
  UPDATE public.stores SET rating = v_avg WHERE id = v_store_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_store_rating
AFTER INSERT OR UPDATE ON public.reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_store_rating_from_reviews();
