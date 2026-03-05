
-- Create notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  message text NOT NULL,
  link text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only read their own notifications
CREATE POLICY "Users read own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users delete own notifications"
  ON public.notifications FOR DELETE
  USING (auth.uid() = user_id);

-- System/triggers can insert notifications
CREATE POLICY "System insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Auto-create notification on new order
CREATE OR REPLACE FUNCTION public.notify_order_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (
    NEW.user_id,
    'order',
    'Commande confirmée',
    'Votre commande ' || NEW.order_ref || ' a été reçue. Montant : $' || NEW.total::text,
    '/dashboard'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_order_created
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_order_created();

-- Auto-create notification on order status change
CREATE OR REPLACE FUNCTION public.notify_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      NEW.user_id,
      'order',
      'Mise à jour commande',
      'Votre commande ' || NEW.order_ref || ' est maintenant : ' || NEW.status,
      '/dashboard'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_order_status
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_order_status();

-- Auto-create notification on new message received
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conv_user_id uuid;
  conv_store_owner_id uuid;
BEGIN
  -- Get conversation user and store owner
  SELECT c.user_id, s.owner_id
  INTO conv_user_id, conv_store_owner_id
  FROM public.conversations c
  JOIN public.stores s ON s.id = c.store_id
  WHERE c.id = NEW.conversation_id;

  -- Notify the other party
  IF NEW.sender_id = conv_user_id AND conv_store_owner_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (conv_store_owner_id, 'message', 'Nouveau message', LEFT(NEW.content, 80), '/messages');
  ELSIF NEW.sender_id != conv_user_id THEN
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (conv_user_id, 'message', 'Nouveau message', LEFT(NEW.content, 80), '/messages');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_message();
