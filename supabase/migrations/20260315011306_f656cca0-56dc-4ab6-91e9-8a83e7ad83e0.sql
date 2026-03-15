-- Support center upgrade: guest tickets + requester typing + safer updates

ALTER TABLE public.support_tickets
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS requester_type TEXT NOT NULL DEFAULT 'client',
  ADD COLUMN IF NOT EXISTS requester_email TEXT,
  ADD COLUMN IF NOT EXISTS requester_name TEXT;

ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS sender_email TEXT;

CREATE INDEX IF NOT EXISTS ix_support_tickets_requester_type
  ON public.support_tickets (requester_type);

CREATE INDEX IF NOT EXISTS ix_support_tickets_requester_email
  ON public.support_tickets (lower(requester_email));

CREATE OR REPLACE FUNCTION public.enrich_support_ticket_requester()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.requester_type := 'guest';
  ELSE
    IF EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = NEW.user_id
        AND ur.role = 'vendor'::app_role
    ) THEN
      NEW.requester_type := 'vendor';
    ELSE
      NEW.requester_type := 'client';
    END IF;

    IF NEW.requester_email IS NULL THEN
      SELECT p.email
      INTO NEW.requester_email
      FROM public.profiles p
      WHERE p.id = NEW.user_id;
    END IF;
  END IF;

  IF NEW.requester_email IS NOT NULL THEN
    NEW.requester_email := lower(trim(NEW.requester_email));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_tickets_enrich_requester ON public.support_tickets;
CREATE TRIGGER support_tickets_enrich_requester
BEFORE INSERT OR UPDATE ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.enrich_support_ticket_requester();

UPDATE public.support_tickets st
SET requester_type = CASE
      WHEN st.user_id IS NULL THEN 'guest'
      WHEN EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = st.user_id
          AND ur.role = 'vendor'::app_role
      ) THEN 'vendor'
      ELSE 'client'
    END,
    requester_email = COALESCE(st.requester_email, lower(p.email))
FROM public.profiles p
WHERE st.user_id = p.id;

UPDATE public.support_tickets st
SET requester_type = 'guest'
WHERE st.user_id IS NULL;

DROP POLICY IF EXISTS "Users can update their own tickets" ON public.support_tickets;
CREATE POLICY "Users can update their own tickets"
ON public.support_tickets
FOR UPDATE
TO authenticated
USING (
  (user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
)
WITH CHECK (
  (user_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
);

CREATE OR REPLACE FUNCTION public.create_guest_support_ticket(
  p_subject TEXT,
  p_category TEXT,
  p_priority TEXT,
  p_message TEXT,
  p_requester_email TEXT,
  p_requester_name TEXT DEFAULT NULL
)
RETURNS TABLE(ticket_id UUID, ticket_reference TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket_id UUID;
  v_email TEXT;
  v_priority TEXT;
  v_category TEXT;
BEGIN
  v_email := lower(trim(COALESCE(p_requester_email, '')));
  IF v_email = '' THEN
    RAISE EXCEPTION 'Email requis';
  END IF;

  IF p_subject IS NULL OR length(trim(p_subject)) < 5 THEN
    RAISE EXCEPTION 'Sujet invalide';
  END IF;

  IF p_message IS NULL OR length(trim(p_message)) < 10 THEN
    RAISE EXCEPTION 'Message invalide';
  END IF;

  v_priority := CASE
    WHEN p_priority IN ('low', 'medium', 'high', 'urgent') THEN p_priority
    ELSE 'medium'
  END;

  v_category := CASE
    WHEN p_category IN ('order', 'delivery', 'payment', 'account', 'product', 'other') THEN p_category
    ELSE 'other'
  END;

  INSERT INTO public.support_tickets (
    user_id,
    subject,
    status,
    priority,
    category,
    requester_type,
    requester_email,
    requester_name
  ) VALUES (
    NULL,
    trim(p_subject),
    'open',
    v_priority,
    v_category,
    'guest',
    v_email,
    NULLIF(trim(COALESCE(p_requester_name, '')), '')
  )
  RETURNING id INTO v_ticket_id;

  INSERT INTO public.support_messages (
    ticket_id,
    sender_id,
    content,
    is_staff,
    sender_email
  ) VALUES (
    v_ticket_id,
    gen_random_uuid(),
    trim(p_message),
    FALSE,
    v_email
  );

  RETURN QUERY
  SELECT
    v_ticket_id,
    'ZD-' || upper(replace(v_ticket_id::text, '-', ''));
END;
$$;

CREATE OR REPLACE FUNCTION public.get_guest_support_ticket(
  p_ticket_id UUID,
  p_requester_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_ticket JSONB;
  v_messages JSONB;
BEGIN
  v_email := lower(trim(COALESCE(p_requester_email, '')));
  IF v_email = '' THEN
    RAISE EXCEPTION 'Email requis';
  END IF;

  SELECT jsonb_build_object(
    'id', st.id,
    'subject', st.subject,
    'status', st.status,
    'priority', st.priority,
    'category', st.category,
    'created_at', st.created_at,
    'updated_at', st.updated_at,
    'requester_type', st.requester_type,
    'requester_email', st.requester_email
  )
  INTO v_ticket
  FROM public.support_tickets st
  WHERE st.id = p_ticket_id
    AND st.requester_type = 'guest'
    AND st.requester_email = v_email;

  IF v_ticket IS NULL THEN
    RAISE EXCEPTION 'Ticket introuvable';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', sm.id,
        'ticket_id', sm.ticket_id,
        'content', sm.content,
        'is_staff', sm.is_staff,
        'created_at', sm.created_at
      )
      ORDER BY sm.created_at ASC
    ),
    '[]'::jsonb
  )
  INTO v_messages
  FROM public.support_messages sm
  WHERE sm.ticket_id = p_ticket_id;

  RETURN jsonb_build_object(
    'ticket', v_ticket,
    'messages', v_messages
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.add_guest_support_message(
  p_ticket_id UUID,
  p_requester_email TEXT,
  p_content TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_msg public.support_messages%ROWTYPE;
BEGIN
  v_email := lower(trim(COALESCE(p_requester_email, '')));
  IF v_email = '' THEN
    RAISE EXCEPTION 'Email requis';
  END IF;

  IF p_content IS NULL OR length(trim(p_content)) = 0 THEN
    RAISE EXCEPTION 'Message vide';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.support_tickets st
    WHERE st.id = p_ticket_id
      AND st.requester_type = 'guest'
      AND st.requester_email = v_email
  ) THEN
    RAISE EXCEPTION 'Ticket introuvable';
  END IF;

  INSERT INTO public.support_messages (
    ticket_id,
    sender_id,
    content,
    is_staff,
    sender_email
  ) VALUES (
    p_ticket_id,
    gen_random_uuid(),
    trim(p_content),
    FALSE,
    v_email
  )
  RETURNING * INTO v_msg;

  UPDATE public.support_tickets
  SET
    updated_at = now(),
    status = CASE WHEN status = 'resolved' THEN 'in_progress' ELSE status END
  WHERE id = p_ticket_id;

  RETURN jsonb_build_object(
    'id', v_msg.id,
    'ticket_id', v_msg.ticket_id,
    'content', v_msg.content,
    'is_staff', v_msg.is_staff,
    'created_at', v_msg.created_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_guest_support_ticket(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_guest_support_ticket(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_guest_support_message(UUID, TEXT, TEXT) TO anon, authenticated;