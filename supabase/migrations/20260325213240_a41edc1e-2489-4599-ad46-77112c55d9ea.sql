
-- Custom quick replies per store (max 25)
CREATE TABLE public.store_quick_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (length(trim(content)) >= 2 AND length(content) <= 500),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup
CREATE INDEX idx_store_quick_replies_store ON public.store_quick_replies(store_id);

-- RLS
ALTER TABLE public.store_quick_replies ENABLE ROW LEVEL SECURITY;

-- Vendors can read their own store's quick replies
CREATE POLICY "Store owners can read quick replies"
ON public.store_quick_replies FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = store_quick_replies.store_id
    AND (s.owner_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.store_collaborators sc
      WHERE sc.store_id = s.id AND sc.user_id = auth.uid() AND sc.status = 'active'
    ))
  )
);

-- Vendors can insert quick replies for their store (max 25 enforced via trigger)
CREATE POLICY "Store owners can insert quick replies"
ON public.store_quick_replies FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = store_quick_replies.store_id
    AND (s.owner_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.store_collaborators sc
      WHERE sc.store_id = s.id AND sc.user_id = auth.uid() AND sc.status = 'active'
    ))
  )
);

-- Vendors can update their own store's quick replies
CREATE POLICY "Store owners can update quick replies"
ON public.store_quick_replies FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = store_quick_replies.store_id
    AND (s.owner_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.store_collaborators sc
      WHERE sc.store_id = s.id AND sc.user_id = auth.uid() AND sc.status = 'active'
    ))
  )
);

-- Vendors can delete their own store's quick replies
CREATE POLICY "Store owners can delete quick replies"
ON public.store_quick_replies FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.stores s
    WHERE s.id = store_quick_replies.store_id
    AND (s.owner_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.store_collaborators sc
      WHERE sc.store_id = s.id AND sc.user_id = auth.uid() AND sc.status = 'active'
    ))
  )
);

-- Admin full access
CREATE POLICY "Admins can manage all quick replies"
ON public.store_quick_replies FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger to enforce max 25 custom replies per store
CREATE OR REPLACE FUNCTION public.enforce_max_quick_replies()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.store_quick_replies WHERE store_id = NEW.store_id) >= 25 THEN
    RAISE EXCEPTION 'Maximum 25 réponses rapides personnalisées par boutique';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_max_quick_replies
BEFORE INSERT ON public.store_quick_replies
FOR EACH ROW EXECUTE FUNCTION public.enforce_max_quick_replies();
