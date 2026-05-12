-- ============================================================
-- Forwarder self-service : RLS pour gérer ses tarifs en autonomie
-- ============================================================

-- 1) Helper : forwarder approuvé appartenant à l'utilisateur
CREATE OR REPLACE FUNCTION public.user_owns_forwarder(_forwarder_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.forwarders f
    WHERE f.id = _forwarder_id
      AND f.status = 'approved'
      AND (f.owner_user_id = _user_id OR f.linked_transporter_user_id = _user_id)
  )
$$;

-- 2) Helper : profil tarifaire d'un forwarder appartenant à l'utilisateur
CREATE OR REPLACE FUNCTION public.user_owns_forwarder_profile(_profile_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.forwarder_pricing_profiles p
    JOIN public.forwarders f ON f.id = p.forwarder_id
    WHERE p.id = _profile_id
      AND f.status = 'approved'
      AND (f.owner_user_id = _user_id OR f.linked_transporter_user_id = _user_id)
  )
$$;

-- ============================================================
-- forwarder_pricing_profiles : owner peut CRUD ses profils
-- ============================================================
DROP POLICY IF EXISTS "Forwarder owner reads own profiles" ON public.forwarder_pricing_profiles;
CREATE POLICY "Forwarder owner reads own profiles"
ON public.forwarder_pricing_profiles
FOR SELECT
TO authenticated
USING (public.user_owns_forwarder(forwarder_id, auth.uid()));

DROP POLICY IF EXISTS "Forwarder owner inserts own profiles" ON public.forwarder_pricing_profiles;
CREATE POLICY "Forwarder owner inserts own profiles"
ON public.forwarder_pricing_profiles
FOR INSERT
TO authenticated
WITH CHECK (public.user_owns_forwarder(forwarder_id, auth.uid()));

DROP POLICY IF EXISTS "Forwarder owner updates own profiles" ON public.forwarder_pricing_profiles;
CREATE POLICY "Forwarder owner updates own profiles"
ON public.forwarder_pricing_profiles
FOR UPDATE
TO authenticated
USING (public.user_owns_forwarder(forwarder_id, auth.uid()))
WITH CHECK (public.user_owns_forwarder(forwarder_id, auth.uid()));

DROP POLICY IF EXISTS "Forwarder owner deletes own profiles" ON public.forwarder_pricing_profiles;
CREATE POLICY "Forwarder owner deletes own profiles"
ON public.forwarder_pricing_profiles
FOR DELETE
TO authenticated
USING (public.user_owns_forwarder(forwarder_id, auth.uid()));

-- ============================================================
-- forwarder_kg_tiers
-- ============================================================
DROP POLICY IF EXISTS "Forwarder owner manages own kg tiers" ON public.forwarder_kg_tiers;
CREATE POLICY "Forwarder owner manages own kg tiers"
ON public.forwarder_kg_tiers
FOR ALL
TO authenticated
USING (public.user_owns_forwarder_profile(profile_id, auth.uid()))
WITH CHECK (public.user_owns_forwarder_profile(profile_id, auth.uid()));

-- ============================================================
-- forwarder_cbm_tiers
-- ============================================================
DROP POLICY IF EXISTS "Forwarder owner manages own cbm tiers" ON public.forwarder_cbm_tiers;
CREATE POLICY "Forwarder owner manages own cbm tiers"
ON public.forwarder_cbm_tiers
FOR ALL
TO authenticated
USING (public.user_owns_forwarder_profile(profile_id, auth.uid()))
WITH CHECK (public.user_owns_forwarder_profile(profile_id, auth.uid()));

-- ============================================================
-- forwarder_piece_tiers
-- ============================================================
DROP POLICY IF EXISTS "Forwarder owner manages own piece tiers" ON public.forwarder_piece_tiers;
CREATE POLICY "Forwarder owner manages own piece tiers"
ON public.forwarder_piece_tiers
FOR ALL
TO authenticated
USING (public.user_owns_forwarder_profile(profile_id, auth.uid()))
WITH CHECK (public.user_owns_forwarder_profile(profile_id, auth.uid()));

-- ============================================================
-- forwarder_surcharges
-- ============================================================
DROP POLICY IF EXISTS "Forwarder owner manages own surcharges" ON public.forwarder_surcharges;
CREATE POLICY "Forwarder owner manages own surcharges"
ON public.forwarder_surcharges
FOR ALL
TO authenticated
USING (public.user_owns_forwarder_profile(profile_id, auth.uid()))
WITH CHECK (public.user_owns_forwarder_profile(profile_id, auth.uid()));

-- ============================================================
-- forwarders : owner peut mettre à jour ses contacts / coverage_routes
-- (sans toucher au statut, RCCM, NIF, raison sociale, approval)
-- Trigger qui empêche la modification des champs sensibles côté non-admin.
-- ============================================================
CREATE OR REPLACE FUNCTION public.protect_forwarder_sensitive_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Admins peuvent tout
  IF public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') THEN
    RETURN NEW;
  END IF;

  -- Owner forwarder : champs verrouillés
  IF NEW.status IS DISTINCT FROM OLD.status
     OR NEW.legal_name IS DISTINCT FROM OLD.legal_name
     OR NEW.registration_number IS DISTINCT FROM OLD.registration_number
     OR NEW.tax_id IS DISTINCT FROM OLD.tax_id
     OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
     OR NEW.linked_transporter_user_id IS DISTINCT FROM OLD.linked_transporter_user_id
     OR NEW.is_platform_owned IS DISTINCT FROM OLD.is_platform_owned
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
     OR NEW.documents IS DISTINCT FROM OLD.documents
     OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
  THEN
    RAISE EXCEPTION 'Modification de champs sensibles interdite — contactez le support Zandofy';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_forwarder_sensitive ON public.forwarders;
CREATE TRIGGER trg_protect_forwarder_sensitive
  BEFORE UPDATE ON public.forwarders
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_forwarder_sensitive_fields();

DROP POLICY IF EXISTS "Forwarder owner updates own row" ON public.forwarders;
CREATE POLICY "Forwarder owner updates own row"
ON public.forwarders
FOR UPDATE
TO authenticated
USING (
  status = 'approved'
  AND (owner_user_id = auth.uid() OR linked_transporter_user_id = auth.uid())
)
WITH CHECK (
  status = 'approved'
  AND (owner_user_id = auth.uid() OR linked_transporter_user_id = auth.uid())
);

COMMENT ON FUNCTION public.user_owns_forwarder IS 'Retourne true si _user_id est owner ou transporteur lié d''un forwarder approuvé.';
COMMENT ON FUNCTION public.user_owns_forwarder_profile IS 'Retourne true si _user_id contrôle le forwarder propriétaire de _profile_id.';