
-- 1. Add presence & collaborator columns to stores
ALTER TABLE public.stores 
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS max_collaborators integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS max_collaborators_override integer;

-- 2. Create store_collaborators table
CREATE TABLE public.store_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  invited_email text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(store_id, user_id)
);

ALTER TABLE public.store_collaborators ENABLE ROW LEVEL SECURITY;

-- RLS: Store owner can manage collaborators
CREATE POLICY "Store owner can manage collaborators"
ON public.store_collaborators
FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.stores WHERE id = store_id AND owner_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.stores WHERE id = store_id AND owner_id = auth.uid())
);

-- RLS: Collaborators can view their own records
CREATE POLICY "Collaborators can view own record"
ON public.store_collaborators
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- RLS: Admins full access
CREATE POLICY "Admins full access to collaborators"
ON public.store_collaborators
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. RPC: update store presence (heartbeat)
CREATE OR REPLACE FUNCTION public.update_store_presence(p_store_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.stores
  SET is_online = true, last_seen_at = now()
  WHERE id = p_store_id
    AND (owner_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.store_collaborators
      WHERE store_id = p_store_id AND user_id = auth.uid() AND status = 'active'
    ));
END;
$$;

-- 4. RPC: set store offline
CREATE OR REPLACE FUNCTION public.set_store_offline(p_store_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.stores
  SET is_online = false
  WHERE id = p_store_id
    AND (owner_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.store_collaborators
      WHERE store_id = p_store_id AND user_id = auth.uid() AND status = 'active'
    ));
END;
$$;

-- 5. Trigger for updated_at on store_collaborators
CREATE TRIGGER update_store_collaborators_updated_at
BEFORE UPDATE ON public.store_collaborators
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
