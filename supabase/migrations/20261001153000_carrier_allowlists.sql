-- Purpose: Phase C4 — store/product carrier allowlists (operators + forwarders).
-- Semantics: no enabled rows for (store|product, lane) ⇒ no filter (current coverage behavior).
-- Risk: low additive. Empty allowlists = zero regression.
-- Staging → production: after C3; smoke empty allowlist + single-op filter.
-- Rollback: DROP TABLES (explicit human).

CREATE TABLE IF NOT EXISTS public.store_carrier_allowlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  carrier_type text NOT NULL CHECK (carrier_type IN ('operator', 'forwarder')),
  carrier_id uuid NOT NULL,
  lanes text[] NOT NULL DEFAULT ARRAY['last_mile', 'domestic', 'freight']::text[],
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, carrier_type, carrier_id)
);

CREATE TABLE IF NOT EXISTS public.product_carrier_allowlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  carrier_type text NOT NULL CHECK (carrier_type IN ('operator', 'forwarder')),
  carrier_id uuid NOT NULL,
  lanes text[] NOT NULL DEFAULT ARRAY['last_mile', 'domestic', 'freight']::text[],
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, carrier_type, carrier_id)
);

CREATE INDEX IF NOT EXISTS idx_store_carrier_allowlists_store
  ON public.store_carrier_allowlists (store_id) WHERE enabled;
CREATE INDEX IF NOT EXISTS idx_product_carrier_allowlists_product
  ON public.product_carrier_allowlists (product_id) WHERE enabled;

ALTER TABLE public.store_carrier_allowlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_carrier_allowlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Store team manage store carrier allowlists" ON public.store_carrier_allowlists;
CREATE POLICY "Store team manage store carrier allowlists"
  ON public.store_carrier_allowlists FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.store_collaborators sc
      WHERE sc.store_id = store_carrier_allowlists.store_id
        AND sc.user_id = auth.uid() AND sc.status = 'active'
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.store_collaborators sc
      WHERE sc.store_id = store_carrier_allowlists.store_id
        AND sc.user_id = auth.uid() AND sc.status = 'active'
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "Public read enabled store carrier allowlists" ON public.store_carrier_allowlists;
CREATE POLICY "Public read enabled store carrier allowlists"
  ON public.store_carrier_allowlists FOR SELECT TO anon, authenticated
  USING (enabled = true);

DROP POLICY IF EXISTS "Store team manage product carrier allowlists" ON public.product_carrier_allowlists;
CREATE POLICY "Store team manage product carrier allowlists"
  ON public.product_carrier_allowlists FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.stores s ON s.id = p.store_id
      WHERE p.id = product_id AND (
        s.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.store_collaborators sc
          WHERE sc.store_id = s.id AND sc.user_id = auth.uid() AND sc.status = 'active'
        )
        OR public.has_role(auth.uid(), 'admin'::app_role)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.stores s ON s.id = p.store_id
      WHERE p.id = product_id AND (
        s.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.store_collaborators sc
          WHERE sc.store_id = s.id AND sc.user_id = auth.uid() AND sc.status = 'active'
        )
        OR public.has_role(auth.uid(), 'admin'::app_role)
      )
    )
  );

DROP POLICY IF EXISTS "Public read enabled product carrier allowlists" ON public.product_carrier_allowlists;
CREATE POLICY "Public read enabled product carrier allowlists"
  ON public.product_carrier_allowlists FOR SELECT TO anon, authenticated
  USING (enabled = true);

-- Returns null when no filter should apply; otherwise array of allowed carrier UUIDs
CREATE OR REPLACE FUNCTION public.get_carrier_allowlist_ids(
  p_store_id uuid,
  p_product_ids uuid[],
  p_carrier_type text,
  p_lane text
)
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_ids uuid[] := ARRAY[]::uuid[];
  v_store_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  -- Product-level wins if any enabled rows for these products + lane
  SELECT ARRAY_AGG(DISTINCT a.carrier_id) INTO v_product_ids
  FROM public.product_carrier_allowlists a
  WHERE a.enabled
    AND a.carrier_type = p_carrier_type
    AND a.product_id = ANY (COALESCE(p_product_ids, ARRAY[]::uuid[]))
    AND (p_lane IS NULL OR p_lane = ANY (a.lanes));

  IF v_product_ids IS NOT NULL AND array_length(v_product_ids, 1) > 0 THEN
    RETURN v_product_ids;
  END IF;

  SELECT ARRAY_AGG(DISTINCT a.carrier_id) INTO v_store_ids
  FROM public.store_carrier_allowlists a
  WHERE a.enabled
    AND a.carrier_type = p_carrier_type
    AND a.store_id = p_store_id
    AND (p_lane IS NULL OR p_lane = ANY (a.lanes));

  IF v_store_ids IS NOT NULL AND array_length(v_store_ids, 1) > 0 THEN
    RETURN v_store_ids;
  END IF;

  RETURN NULL; -- no filter
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_carrier_allowlist_ids(uuid, uuid[], text, text) TO anon, authenticated;
