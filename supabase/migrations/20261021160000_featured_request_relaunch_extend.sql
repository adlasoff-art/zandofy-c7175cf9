-- Purpose: allow vendors to relaunch past featured requests and request
--          duration extensions on active placements, always via admin review.
-- Tables: featured_placement_requests, featured_placements
-- Rollback: DROP columns action_type, parent_request_id, target_placement_id,
--           source_request_id and related indexes/constraints (non-destructive
--           data loss only on those columns).

-- Linkage + action on vendor requests
ALTER TABLE public.featured_placement_requests
  ADD COLUMN IF NOT EXISTS action_type text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS parent_request_id uuid REFERENCES public.featured_placement_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS target_placement_id uuid REFERENCES public.featured_placements(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'featured_placement_requests_action_type_check'
  ) THEN
    ALTER TABLE public.featured_placement_requests
      ADD CONSTRAINT featured_placement_requests_action_type_check
      CHECK (action_type IN ('new', 'relaunch', 'extend'));
  END IF;
END $$;

-- Trace which placement was created from which request (helps extend UX)
ALTER TABLE public.featured_placements
  ADD COLUMN IF NOT EXISTS source_request_id uuid REFERENCES public.featured_placement_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_featured_req_parent
  ON public.featured_placement_requests (parent_request_id);

CREATE INDEX IF NOT EXISTS idx_featured_req_target_placement
  ON public.featured_placement_requests (target_placement_id);

CREATE INDEX IF NOT EXISTS idx_featured_placements_store
  ON public.featured_placements (store_id)
  WHERE store_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_featured_placements_source_req
  ON public.featured_placements (source_request_id)
  WHERE source_request_id IS NOT NULL;

-- At most one pending extension per placement
CREATE UNIQUE INDEX IF NOT EXISTS idx_featured_req_one_pending_extend
  ON public.featured_placement_requests (target_placement_id)
  WHERE status = 'pending'
    AND action_type = 'extend'
    AND target_placement_id IS NOT NULL;

COMMENT ON COLUMN public.featured_placement_requests.action_type IS
  'new = first request; relaunch = renew from a past request; extend = prolong an active placement';
COMMENT ON COLUMN public.featured_placement_requests.parent_request_id IS
  'Previous request this relaunch/extend was based on';
COMMENT ON COLUMN public.featured_placement_requests.target_placement_id IS
  'Active featured_placements row to extend when action_type = extend';
COMMENT ON COLUMN public.featured_placements.source_request_id IS
  'Vendor request that originated this placement (if created from approval)';
