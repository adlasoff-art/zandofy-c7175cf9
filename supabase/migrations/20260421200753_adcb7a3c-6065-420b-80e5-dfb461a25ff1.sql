ALTER TABLE public.product_sourcing_requests
  ADD COLUMN IF NOT EXISTS admin_notified_email boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_product_sourcing_requests_admin_notif
  ON public.product_sourcing_requests (admin_notified_email, created_at)
  WHERE admin_notified_email = false;