
CREATE OR REPLACE FUNCTION public.force_review_moderation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Force is_approved = false when images are present
  IF NEW.images IS NOT NULL AND array_length(NEW.images, 1) > 0 THEN
    NEW.is_approved := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_force_review_moderation ON public.reviews;
CREATE TRIGGER trg_force_review_moderation
  BEFORE INSERT ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.force_review_moderation();
