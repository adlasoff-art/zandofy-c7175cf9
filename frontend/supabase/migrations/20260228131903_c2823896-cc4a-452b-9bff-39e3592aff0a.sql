
-- 1. Vendor policies for product_colors
CREATE POLICY "Store owners insert product_colors"
ON public.product_colors FOR INSERT
TO authenticated
WITH CHECK (
  product_id IN (
    SELECT p.id FROM products p
    JOIN stores s ON s.id = p.store_id
    WHERE s.owner_id = auth.uid()
  )
);

CREATE POLICY "Store owners update product_colors"
ON public.product_colors FOR UPDATE
TO authenticated
USING (
  product_id IN (
    SELECT p.id FROM products p
    JOIN stores s ON s.id = p.store_id
    WHERE s.owner_id = auth.uid()
  )
);

CREATE POLICY "Store owners delete product_colors"
ON public.product_colors FOR DELETE
TO authenticated
USING (
  product_id IN (
    SELECT p.id FROM products p
    JOIN stores s ON s.id = p.store_id
    WHERE s.owner_id = auth.uid()
  )
);

-- 2. Vendor policies for product_sizes
CREATE POLICY "Store owners insert product_sizes"
ON public.product_sizes FOR INSERT
TO authenticated
WITH CHECK (
  product_id IN (
    SELECT p.id FROM products p
    JOIN stores s ON s.id = p.store_id
    WHERE s.owner_id = auth.uid()
  )
);

CREATE POLICY "Store owners update product_sizes"
ON public.product_sizes FOR UPDATE
TO authenticated
USING (
  product_id IN (
    SELECT p.id FROM products p
    JOIN stores s ON s.id = p.store_id
    WHERE s.owner_id = auth.uid()
  )
);

CREATE POLICY "Store owners delete product_sizes"
ON public.product_sizes FOR DELETE
TO authenticated
USING (
  product_id IN (
    SELECT p.id FROM products p
    JOIN stores s ON s.id = p.store_id
    WHERE s.owner_id = auth.uid()
  )
);

-- 3. Vendor policies for product_pricing_tiers
CREATE POLICY "Store owners insert product_pricing_tiers"
ON public.product_pricing_tiers FOR INSERT
TO authenticated
WITH CHECK (
  product_id IN (
    SELECT p.id FROM products p
    JOIN stores s ON s.id = p.store_id
    WHERE s.owner_id = auth.uid()
  )
);

CREATE POLICY "Store owners update product_pricing_tiers"
ON public.product_pricing_tiers FOR UPDATE
TO authenticated
USING (
  product_id IN (
    SELECT p.id FROM products p
    JOIN stores s ON s.id = p.store_id
    WHERE s.owner_id = auth.uid()
  )
);

CREATE POLICY "Store owners delete product_pricing_tiers"
ON public.product_pricing_tiers FOR DELETE
TO authenticated
USING (
  product_id IN (
    SELECT p.id FROM products p
    JOIN stores s ON s.id = p.store_id
    WHERE s.owner_id = auth.uid()
  )
);

-- 4. Prevent self-upvote on store_reviews: add a constraint function
CREATE OR REPLACE FUNCTION public.prevent_self_helpful_store_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Block if the reviewer is trying to increment their own helpful_count
  IF OLD.user_id = auth.uid() AND NEW.helpful_count > OLD.helpful_count THEN
    RAISE EXCEPTION 'You cannot upvote your own review';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_self_upvote_store_review
BEFORE UPDATE ON public.store_reviews
FOR EACH ROW
EXECUTE FUNCTION public.prevent_self_helpful_store_review();

-- 5. Unique constraint on store_reviews to prevent duplicate reviews per user per store
ALTER TABLE public.store_reviews
ADD CONSTRAINT unique_user_store_review UNIQUE (user_id, store_id);
