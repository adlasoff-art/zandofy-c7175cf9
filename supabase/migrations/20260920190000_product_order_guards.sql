-- Purpose: Prevent hard-delete of products with order history; lock price while active orders exist.
-- Tables: public.products, public.order_items, public.orders
-- Risk (~4000+ users): Additive RPCs + triggers only. Admin/service_role can still update/delete.
-- Rollback: DROP TRIGGER ...; DROP FUNCTION product_has_active_orders / product_has_any_orders /
--           prevent_product_delete_with_orders / prevent_product_price_change_with_active_orders.
-- Staging → production: run same file in SQL Editor after smoke (edit price / delete product).

CREATE OR REPLACE FUNCTION public.product_has_any_orders(p_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.order_items oi
    WHERE oi.product_id = p_product_id
  );
$$;

CREATE OR REPLACE FUNCTION public.product_has_active_orders(p_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.order_items oi
    JOIN public.orders o ON o.id = oi.order_id
    WHERE oi.product_id = p_product_id
      AND o.status IN (
        'pending',
        'confirmed',
        'preparing',
        'in_shipping',
        'shipped',
        'assigning_rider',
        'rider_assigned',
        'out_for_delivery',
        'ready_for_pickup'
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.product_has_any_orders(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.product_has_active_orders(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.prevent_product_delete_with_orders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role / SQL editor (no JWT): allow
  IF auth.uid() IS NULL THEN
    RETURN OLD;
  END IF;
  IF public.has_role(auth.uid(), 'admin'::public.app_role)
     OR public.has_role(auth.uid(), 'manager'::public.app_role) THEN
    RETURN OLD;
  END IF;

  IF public.product_has_any_orders(OLD.id) THEN
    RAISE EXCEPTION 'PRODUCT_HAS_ORDERS: Impossible de supprimer un produit déjà commandé. Dépubliez-le à la place.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_product_delete_with_orders ON public.products;
CREATE TRIGGER trg_prevent_product_delete_with_orders
  BEFORE DELETE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_product_delete_with_orders();

CREATE OR REPLACE FUNCTION public.prevent_product_price_change_with_active_orders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF public.has_role(auth.uid(), 'admin'::public.app_role)
     OR public.has_role(auth.uid(), 'manager'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF NEW.price IS DISTINCT FROM OLD.price
     OR NEW.original_price IS DISTINCT FROM OLD.original_price THEN
    IF public.product_has_active_orders(NEW.id) THEN
      RAISE EXCEPTION 'PRODUCT_PRICE_LOCKED: Prix verrouillé tant qu''une commande est en cours pour ce produit.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_product_price_change_with_active_orders ON public.products;
CREATE TRIGGER trg_prevent_product_price_change_with_active_orders
  BEFORE UPDATE OF price, original_price ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_product_price_change_with_active_orders();
