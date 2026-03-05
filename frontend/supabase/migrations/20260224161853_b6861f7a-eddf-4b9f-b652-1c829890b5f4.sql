
-- ═══ REVIEWS TABLE ═══
CREATE TABLE public.reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rating integer NOT NULL,
  comment text NOT NULL DEFAULT '',
  images text[] DEFAULT '{}',
  is_verified_purchase boolean NOT NULL DEFAULT false,
  helpful_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Validation trigger for rating 1-5
CREATE OR REPLACE FUNCTION public.validate_review_rating()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.rating < 1 OR NEW.rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER check_review_rating
  BEFORE INSERT OR UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_review_rating();

-- Unique constraint: one review per user per product
ALTER TABLE public.reviews ADD CONSTRAINT reviews_user_product_unique UNIQUE (user_id, product_id);

-- Index for fast lookups
CREATE INDEX idx_reviews_product_id ON public.reviews(product_id);

-- Enable RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "Public read reviews"
  ON public.reviews FOR SELECT
  USING (true);

-- Authenticated users insert own reviews
CREATE POLICY "Users insert own reviews"
  ON public.reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users update own reviews
CREATE POLICY "Users update own reviews"
  ON public.reviews FOR UPDATE
  USING (auth.uid() = user_id);

-- Users delete own reviews
CREATE POLICY "Users delete own reviews"
  ON public.reviews FOR DELETE
  USING (auth.uid() = user_id);

-- ═══ RPC: Get rating summary for a product ═══
CREATE OR REPLACE FUNCTION public.get_product_rating_summary(p_product_id uuid)
RETURNS TABLE(
  avg_rating numeric,
  total_reviews bigint,
  star_1 bigint,
  star_2 bigint,
  star_3 bigint,
  star_4 bigint,
  star_5 bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    COALESCE(ROUND(AVG(rating)::numeric, 1), 0) AS avg_rating,
    COUNT(*) AS total_reviews,
    COUNT(*) FILTER (WHERE rating = 1) AS star_1,
    COUNT(*) FILTER (WHERE rating = 2) AS star_2,
    COUNT(*) FILTER (WHERE rating = 3) AS star_3,
    COUNT(*) FILTER (WHERE rating = 4) AS star_4,
    COUNT(*) FILTER (WHERE rating = 5) AS star_5
  FROM public.reviews
  WHERE product_id = p_product_id;
$$;

-- ═══ REVIEW-IMAGES STORAGE BUCKET ═══
INSERT INTO storage.buckets (id, name, public)
VALUES ('review-images', 'review-images', true);

-- Public read for review images
CREATE POLICY "Public read review images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'review-images');

-- Authenticated users upload review images
CREATE POLICY "Users upload review images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'review-images' AND auth.role() = 'authenticated');

-- Users delete own review images
CREATE POLICY "Users delete own review images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'review-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ═══ RPC: Increment helpful count ═══
CREATE OR REPLACE FUNCTION public.increment_helpful(review_id uuid)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  UPDATE public.reviews
  SET helpful_count = helpful_count + 1
  WHERE id = review_id;
$$;
