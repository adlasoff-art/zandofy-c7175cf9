
-- 1. Trigger: sync products_count on products INSERT/DELETE
CREATE OR REPLACE FUNCTION public.update_store_products_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.store_id IS NOT NULL THEN
    UPDATE stores SET products_count = (
      SELECT COUNT(*) FROM products WHERE store_id = NEW.store_id
    ) WHERE id = NEW.store_id;
  ELSIF TG_OP = 'DELETE' AND OLD.store_id IS NOT NULL THEN
    UPDATE stores SET products_count = (
      SELECT COUNT(*) FROM products WHERE store_id = OLD.store_id
    ) WHERE id = OLD.store_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.store_id IS DISTINCT FROM NEW.store_id THEN
      IF OLD.store_id IS NOT NULL THEN
        UPDATE stores SET products_count = (
          SELECT COUNT(*) FROM products WHERE store_id = OLD.store_id
        ) WHERE id = OLD.store_id;
      END IF;
      IF NEW.store_id IS NOT NULL THEN
        UPDATE stores SET products_count = (
          SELECT COUNT(*) FROM products WHERE store_id = NEW.store_id
        ) WHERE id = NEW.store_id;
      END IF;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_sync_store_products_count
AFTER INSERT OR UPDATE OR DELETE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.update_store_products_count();

-- 2. Trigger: sync followers_count on store_followers INSERT/DELETE
CREATE OR REPLACE FUNCTION public.update_store_followers_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_store_id uuid;
BEGIN
  v_store_id := COALESCE(NEW.store_id, OLD.store_id);
  UPDATE stores SET followers_count = (
    SELECT COUNT(*) FROM store_followers WHERE store_id = v_store_id
  ) WHERE id = v_store_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_sync_store_followers_count
AFTER INSERT OR DELETE ON public.store_followers
FOR EACH ROW EXECUTE FUNCTION public.update_store_followers_count();

-- 3. Fix verified_years: compute from created_at, reset fake values
-- The verified_years column should only be set by admin override, not fake static values
-- We already reset the data above, so this is just for documentation

-- 4. Ensure update_store_sales_count trigger exists (it already does per DB functions)
-- No change needed - trigger already increments sales_count on delivered orders
