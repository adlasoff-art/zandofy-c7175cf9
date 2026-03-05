
-- 1. Add stock_quantity column to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock_quantity integer DEFAULT NULL;

-- 2. Notification trigger for return_requests
CREATE OR REPLACE FUNCTION public.notify_return_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_ref text;
  v_store_owner_id uuid;
BEGIN
  -- Get order ref
  SELECT order_ref INTO v_order_ref FROM public.orders WHERE id = NEW.order_id;

  IF TG_OP = 'INSERT' THEN
    -- Notify user
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (NEW.user_id, 'return', 'Demande de retour créée', 'Votre demande de retour pour la commande ' || COALESCE(v_order_ref, '') || ' a été soumise.', '/dashboard');

    -- Notify store owner if store_id exists
    IF NEW.store_id IS NOT NULL THEN
      SELECT owner_id INTO v_store_owner_id FROM public.stores WHERE id = NEW.store_id;
      IF v_store_owner_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, title, message, link)
        VALUES (v_store_owner_id, 'return', 'Nouvelle demande de retour', 'Un client a demandé un retour pour la commande ' || COALESCE(v_order_ref, '') || '.', '/vendor');
      END IF;
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    -- Notify user of status change
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (NEW.user_id, 'return', 'Retour mis à jour', 'Votre demande de retour pour la commande ' || COALESCE(v_order_ref, '') || ' est maintenant : ' || NEW.status, '/dashboard');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_return_insert
AFTER INSERT ON public.return_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_return_request();

CREATE TRIGGER trg_notify_return_update
AFTER UPDATE ON public.return_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_return_request();

-- 3. Notification trigger for disputes
CREATE OR REPLACE FUNCTION public.notify_dispute()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_ref text;
  v_store_owner_id uuid;
BEGIN
  SELECT order_ref INTO v_order_ref FROM public.orders WHERE id = NEW.order_id;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (NEW.user_id, 'dispute', 'Litige ouvert', 'Votre litige pour la commande ' || COALESCE(v_order_ref, '') || ' a été créé.', '/dashboard');

    IF NEW.store_id IS NOT NULL THEN
      SELECT owner_id INTO v_store_owner_id FROM public.stores WHERE id = NEW.store_id;
      IF v_store_owner_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, title, message, link)
        VALUES (v_store_owner_id, 'dispute', 'Nouveau litige', 'Un client a ouvert un litige pour la commande ' || COALESCE(v_order_ref, '') || '.', '/vendor');
      END IF;
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (NEW.user_id, 'dispute', 'Litige mis à jour', 'Votre litige pour la commande ' || COALESCE(v_order_ref, '') || ' est maintenant : ' || NEW.status, '/dashboard');

    IF NEW.store_id IS NOT NULL THEN
      SELECT owner_id INTO v_store_owner_id FROM public.stores WHERE id = NEW.store_id;
      IF v_store_owner_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, title, message, link)
        VALUES (v_store_owner_id, 'dispute', 'Litige mis à jour', 'Le litige pour la commande ' || COALESCE(v_order_ref, '') || ' est maintenant : ' || NEW.status, '/vendor');
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_dispute_insert
AFTER INSERT ON public.disputes
FOR EACH ROW EXECUTE FUNCTION public.notify_dispute();

CREATE TRIGGER trg_notify_dispute_update
AFTER UPDATE ON public.disputes
FOR EACH ROW EXECUTE FUNCTION public.notify_dispute();

-- 4. Decrement stock on order creation
CREATE OR REPLACE FUNCTION public.decrement_stock_on_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.products
  SET stock_quantity = stock_quantity - NEW.quantity
  WHERE id = NEW.product_id
    AND stock_quantity IS NOT NULL;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_decrement_stock
AFTER INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.decrement_stock_on_order();
