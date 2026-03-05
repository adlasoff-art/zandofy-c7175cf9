
-- Create wishlists table
CREATE TABLE public.wishlists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Unique constraint to prevent duplicates
ALTER TABLE public.wishlists ADD CONSTRAINT wishlists_user_product_unique UNIQUE (user_id, product_id);

-- Enable RLS
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

-- Users can read their own wishlist
CREATE POLICY "Users read own wishlist"
  ON public.wishlists FOR SELECT
  USING (auth.uid() = user_id);

-- Users can add to their own wishlist
CREATE POLICY "Users insert own wishlist"
  ON public.wishlists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can remove from their own wishlist
CREATE POLICY "Users delete own wishlist"
  ON public.wishlists FOR DELETE
  USING (auth.uid() = user_id);
