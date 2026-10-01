-- Purpose: Collaborator SELECT on stores + identity gate RPC (owner or active collab).
-- Tables: stores (new SELECT policy), assert_store_identity_ready()
-- Risk: low — additive policy + RPC; no destructive changes.
-- Staging → production: run this file in SQL Editor after commit.

-- ---------------------------------------------------------------------------
-- 1) Collaborators can read assigned stores (full row — not stores_public)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Collaborators read assigned stores" ON public.stores;
CREATE POLICY "Collaborators read assigned stores"
  ON public.stores FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.store_collaborators sc
      WHERE sc.store_id = stores.id
        AND sc.user_id = auth.uid()
        AND sc.status = 'active'
    )
  );

-- ---------------------------------------------------------------------------
-- 2) Identity readiness for publish (SECURITY DEFINER — bypasses catalog view)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_store_identity_ready(p_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok_access boolean;
  v_row public.stores%ROWTYPE;
  v_missing text[] := ARRAY[]::text[];
BEGIN
  IF p_store_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Boutique invalide.');
  END IF;

  v_ok_access := (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = p_store_id AND s.owner_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.store_collaborators sc
      WHERE sc.store_id = p_store_id AND sc.user_id = auth.uid() AND sc.status = 'active'
    )
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  );

  IF NOT v_ok_access THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Accès boutique refusé.');
  END IF;

  SELECT * INTO v_row FROM public.stores WHERE id = p_store_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Boutique introuvable.');
  END IF;

  -- Platform-owned / claimed stores: identity managed by ops
  IF COALESCE(v_row.is_platform_owned, false) IS TRUE THEN
    RETURN jsonb_build_object(
      'ok', true,
      'is_platform_owned', true,
      'missing', '[]'::jsonb
    );
  END IF;

  IF v_row.logo_url IS NULL OR length(trim(v_row.logo_url)) = 0 THEN
    v_missing := array_append(v_missing, 'logo');
  END IF;
  IF v_row.banner_url IS NULL OR length(trim(v_row.banner_url)) = 0 THEN
    v_missing := array_append(v_missing, 'bannière');
  END IF;
  IF COALESCE(nullif(trim(v_row.country_code), ''), nullif(trim(v_row.country), '')) IS NULL THEN
    v_missing := array_append(v_missing, 'pays');
  END IF;
  IF v_row.whatsapp_number IS NULL OR length(trim(v_row.whatsapp_number)) = 0 THEN
    v_missing := array_append(v_missing, 'WhatsApp business');
  END IF;

  IF cardinality(v_missing) = 0 THEN
    RETURN jsonb_build_object(
      'ok', true,
      'is_platform_owned', false,
      'missing', '[]'::jsonb
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', false,
    'is_platform_owned', false,
    'missing', to_jsonb(v_missing),
    'message', format(
      'Complétez l’identité boutique avant de publier (%s). Ouvrez Paramètres boutique.',
      array_to_string(v_missing, ', ')
    )
  );
END;
$$;

COMMENT ON FUNCTION public.assert_store_identity_ready(uuid) IS
  'Publish gate: platform-owned exempt; else require logo, banner, country, WhatsApp. Owner/collab/admin.';

GRANT EXECUTE ON FUNCTION public.assert_store_identity_ready(uuid) TO authenticated;
