
-- Add is_starred to conversations for favorites filter
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS is_starred boolean NOT NULL DEFAULT false;

-- Add read_at timestamp to messages for read receipts
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read_at timestamp with time zone DEFAULT NULL;

-- Add chat_links_allowed and chat_phone_allowed to stores (admin-controlled)
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS chat_links_allowed boolean NOT NULL DEFAULT false;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS chat_phone_allowed boolean NOT NULL DEFAULT false;

-- Allow store owners to update is_starred on conversations
CREATE POLICY "Store owners update conversations"
ON public.conversations
FOR UPDATE
USING (store_id IN (SELECT id FROM stores WHERE owner_id = auth.uid()));

-- Allow admins to delete messages
CREATE POLICY "Admins delete messages"
ON public.messages
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to read all conversations
CREATE POLICY "Admins read all conversations"
ON public.conversations
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to read all messages  
CREATE POLICY "Admins read all messages"
ON public.messages
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));
