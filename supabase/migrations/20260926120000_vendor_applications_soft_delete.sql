-- Purpose: Soft-delete for vendor applications (admin archives). Additive only.
-- Tables: vendor_applications
-- Rollback: ALTER TABLE ... DROP COLUMN deleted_at; (not recommended with live data)

ALTER TABLE public.vendor_applications
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

COMMENT ON COLUMN public.vendor_applications.deleted_at IS
  'Soft-delete timestamp; NULL = active. Hard-delete remains an explicit admin action.';

CREATE INDEX IF NOT EXISTS idx_vendor_applications_deleted_at
  ON public.vendor_applications (deleted_at)
  WHERE deleted_at IS NULL;
