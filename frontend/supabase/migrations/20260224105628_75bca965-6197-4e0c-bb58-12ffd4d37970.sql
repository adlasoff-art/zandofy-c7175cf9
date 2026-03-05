
-- Add owner_id to stores to link stores to users
ALTER TABLE public.stores ADD COLUMN owner_id uuid REFERENCES auth.users(id);

-- Create index for owner lookups
CREATE INDEX idx_stores_owner_id ON public.stores(owner_id);

-- Allow store owners to read conversations for their store
CREATE POLICY "Store owners read conversations"
ON public.conversations
FOR SELECT
USING (store_id IN (SELECT id FROM public.stores WHERE owner_id = auth.uid()));

-- Allow store owners to read messages in their store conversations
CREATE POLICY "Store owners read messages"
ON public.messages
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM conversations c
  JOIN stores s ON s.id = c.store_id
  WHERE c.id = messages.conversation_id
  AND s.owner_id = auth.uid()
));

-- Allow store owners to insert messages (reply) in their store conversations
CREATE POLICY "Store owners insert messages"
ON public.messages
FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM conversations c
    JOIN stores s ON s.id = c.store_id
    WHERE c.id = messages.conversation_id
    AND s.owner_id = auth.uid()
  )
);

-- Allow store owners to update messages (mark as read) in their store conversations
CREATE POLICY "Store owners update messages"
ON public.messages
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM conversations c
  JOIN stores s ON s.id = c.store_id
  WHERE c.id = messages.conversation_id
  AND s.owner_id = auth.uid()
));

-- Allow store owners to update their own store
CREATE POLICY "Store owners update own store"
ON public.stores
FOR UPDATE
USING (owner_id = auth.uid());
