
-- Featured placements system
CREATE TABLE public.featured_placements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  placement_type TEXT NOT NULL DEFAULT 'product' CHECK (placement_type IN ('product', 'store', 'ad')),
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  store_id UUID REFERENCES public.stores(id) ON DELETE SET NULL,
  title TEXT,
  image_url TEXT,
  cta_text TEXT DEFAULT 'Voir',
  cta_link TEXT,
  bg_color TEXT DEFAULT '#ffffff',
  text_color TEXT DEFAULT '#000000',
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  price_charged NUMERIC(10,2) DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.featured_placements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Featured placements public read"
  ON public.featured_placements FOR SELECT USING (true);

CREATE POLICY "Admins manage featured placements"
  ON public.featured_placements FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Vendor requests for featured placement
CREATE TABLE public.featured_placement_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL,
  product_ids UUID[] NOT NULL DEFAULT '{}',
  message TEXT,
  desired_start_date TIMESTAMPTZ,
  desired_end_date TIMESTAMPTZ,
  desired_duration_days INT DEFAULT 7,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  admin_notes TEXT,
  price_quoted NUMERIC(10,2),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.featured_placement_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors see own requests"
  ON public.featured_placement_requests FOR SELECT
  USING (requested_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Vendors create requests"
  ON public.featured_placement_requests FOR INSERT
  WITH CHECK (auth.uid() = requested_by);

CREATE POLICY "Admins manage placement requests"
  ON public.featured_placement_requests FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Triggers
CREATE TRIGGER update_featured_placements_updated_at
  BEFORE UPDATE ON public.featured_placements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_featured_placement_requests_updated_at
  BEFORE UPDATE ON public.featured_placement_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
