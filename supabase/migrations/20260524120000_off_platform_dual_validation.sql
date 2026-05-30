-- Double validation hors plateforme : vendeur valide la preuve, admin libère la commande.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS off_platform_vendor_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS off_platform_vendor_verified_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS off_platform_admin_released_at timestamptz,
  ADD COLUMN IF NOT EXISTS off_platform_admin_released_by uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_orders_off_platform_pending_admin
  ON public.orders (created_at DESC)
  WHERE payment_method = 'off_platform'
    AND status = 'awaiting_payment'
    AND off_platform_vendor_verified_at IS NOT NULL
    AND off_platform_admin_released_at IS NULL;

COMMENT ON COLUMN public.orders.off_platform_vendor_verified_at IS
  'Horodatage validation preuve client par le vendeur (hors plateforme, avant libération admin).';
COMMENT ON COLUMN public.orders.off_platform_admin_released_at IS
  'Horodatage libération admin → commande opérationnelle (pending).';
