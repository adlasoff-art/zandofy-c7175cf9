-- =========================================================================
-- Lot 11B Phase B8 — Couverture stricte + validation tarifs opérateurs
-- =========================================================================

-- 1) TABLE : plafonds par ville (caps admin)
CREATE TABLE IF NOT EXISTS public.delivery_operator_city_caps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  city text NOT NULL,
  max_base_price numeric NOT NULL CHECK (max_base_price >= 0),
  max_surcharge numeric NOT NULL DEFAULT 0 CHECK (max_surcharge >= 0),
  max_estimated_minutes integer NOT NULL DEFAULT 180 CHECK (max_estimated_minutes > 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_code, city)
);

ALTER TABLE public.delivery_operator_city_caps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "city_caps_public_read"
  ON public.delivery_operator_city_caps FOR SELECT
  USING (true);

CREATE POLICY "city_caps_admin_insert"
  ON public.delivery_operator_city_caps FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "city_caps_admin_update"
  ON public.delivery_operator_city_caps FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "city_caps_admin_delete"
  ON public.delivery_operator_city_caps FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_city_caps_updated_at
  BEFORE UPDATE ON public.delivery_operator_city_caps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_city_caps_country_city
  ON public.delivery_operator_city_caps (country_code, lower(city));


-- 2) RATES : ajouter colonnes de validation
ALTER TABLE public.delivery_operator_rates
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Backfill : tarifs existants -> approved (sinon checkout casse)
UPDATE public.delivery_operator_rates
   SET status = 'approved',
       reviewed_at = COALESCE(reviewed_at, created_at)
 WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_op_rates_status
  ON public.delivery_operator_rates (status) WHERE status = 'pending';


-- 3) TRIGGER : enforce caps (skip pour platform-owned)
CREATE OR REPLACE FUNCTION public.enforce_operator_rate_caps()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_platform boolean;
  v_cap RECORD;
BEGIN
  SELECT is_platform_owned INTO v_is_platform
    FROM public.delivery_operators
   WHERE id = NEW.operator_id;

  IF COALESCE(v_is_platform, false) THEN
    RETURN NEW;
  END IF;

  SELECT max_base_price, max_surcharge, max_estimated_minutes
    INTO v_cap
    FROM public.delivery_operator_city_caps
   WHERE country_code = NEW.country_code
     AND lower(city) = lower(NEW.city)
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;  -- pas de cap défini pour cette ville = libre
  END IF;

  IF NEW.base_price > v_cap.max_base_price THEN
    RAISE EXCEPTION 'Tarif refusé : prix de base ($%) dépasse le plafond admin ($%) pour %.',
      NEW.base_price, v_cap.max_base_price, NEW.city;
  END IF;

  IF COALESCE(NEW.surcharge, 0) > v_cap.max_surcharge THEN
    RAISE EXCEPTION 'Tarif refusé : surcharge ($%) dépasse le plafond admin ($%) pour %.',
      NEW.surcharge, v_cap.max_surcharge, NEW.city;
  END IF;

  IF NEW.estimated_minutes > v_cap.max_estimated_minutes THEN
    RAISE EXCEPTION 'Tarif refusé : ETA (% min) dépasse le plafond admin (% min) pour %.',
      NEW.estimated_minutes, v_cap.max_estimated_minutes, NEW.city;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_operator_rate_caps ON public.delivery_operator_rates;
CREATE TRIGGER trg_enforce_operator_rate_caps
  BEFORE INSERT OR UPDATE OF base_price, surcharge, estimated_minutes, city, country_code
  ON public.delivery_operator_rates
  FOR EACH ROW EXECUTE FUNCTION public.enforce_operator_rate_caps();


-- 4) TRIGGER : forcer pending sur création/modif prix (skip platform-owned)
CREATE OR REPLACE FUNCTION public.force_pending_on_rate_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_platform boolean;
  v_price_changed boolean;
BEGIN
  SELECT is_platform_owned INTO v_is_platform
    FROM public.delivery_operators
   WHERE id = NEW.operator_id;

  -- Platform-owned : auto-approved, pas de validation
  IF COALESCE(v_is_platform, false) THEN
    NEW.status := 'approved';
    NEW.reviewed_at := COALESCE(NEW.reviewed_at, now());
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status := 'pending';
    NEW.submitted_at := now();
    NEW.reviewed_at := NULL;
    NEW.reviewed_by := NULL;
    NEW.rejection_reason := NULL;
    RETURN NEW;
  END IF;

  -- UPDATE : si prix/zone changent -> retour pending
  v_price_changed :=
       NEW.base_price IS DISTINCT FROM OLD.base_price
    OR NEW.surcharge IS DISTINCT FROM OLD.surcharge
    OR NEW.estimated_minutes IS DISTINCT FROM OLD.estimated_minutes
    OR NEW.commune IS DISTINCT FROM OLD.commune
    OR NEW.quartier IS DISTINCT FROM OLD.quartier
    OR NEW.zone_name IS DISTINCT FROM OLD.zone_name;

  IF v_price_changed AND OLD.status = 'approved' THEN
    -- Permet à l'admin de continuer à set status='approved' explicitement
    -- en distinguant : si reviewed_by est null OU == operator owner -> pending
    IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
      NEW.status := 'pending';
      NEW.submitted_at := now();
      NEW.reviewed_at := NULL;
      NEW.reviewed_by := NULL;
      NEW.rejection_reason := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_force_pending_on_rate_change ON public.delivery_operator_rates;
CREATE TRIGGER trg_force_pending_on_rate_change
  BEFORE INSERT OR UPDATE
  ON public.delivery_operator_rates
  FOR EACH ROW EXECUTE FUNCTION public.force_pending_on_rate_change();


-- 5) VUE : ne compter que les rates approuvés
DROP VIEW IF EXISTS public.v_active_operators_by_city;
CREATE VIEW public.v_active_operators_by_city AS
SELECT o.id AS operator_id,
       o.company_name,
       o.logo_url,
       o.rating_avg,
       o.total_deliveries,
       o.is_platform_owned,
       c.country_code,
       c.city,
       (SELECT min(r.base_price + COALESCE(r.surcharge, 0::numeric))
          FROM public.delivery_operator_rates r
         WHERE r.operator_id = o.id
           AND r.country_code = c.country_code
           AND r.city = c.city
           AND r.is_active = true
           AND r.status = 'approved') AS min_fee_preview,
       (SELECT min(r.estimated_minutes)
          FROM public.delivery_operator_rates r
         WHERE r.operator_id = o.id
           AND r.country_code = c.country_code
           AND r.city = c.city
           AND r.is_active = true
           AND r.status = 'approved') AS min_eta_minutes
  FROM public.delivery_operators o
  JOIN public.delivery_operator_cities c ON c.operator_id = o.id
 WHERE o.is_active = true
   AND o.status = 'approved'
   AND c.is_active = true;


-- 6) RPC : has_operator_coverage pour le checkout
CREATE OR REPLACE FUNCTION public.get_operator_coverage(
  p_country text,
  p_city text,
  p_commune text DEFAULT NULL,
  p_quartier text DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.delivery_operator_rates r
      JOIN public.delivery_operators o ON o.id = r.operator_id
     WHERE r.country_code = upper(p_country)
       AND lower(r.city) = lower(p_city)
       AND r.is_active = true
       AND r.status = 'approved'
       AND o.is_active = true
       AND o.status = 'approved'
       AND (
         -- match exact quartier
         (p_quartier IS NOT NULL AND r.quartier IS NOT NULL
          AND lower(r.quartier) = lower(p_quartier))
         OR
         -- match commune sans quartier spécifique
         (p_commune IS NOT NULL AND r.commune IS NOT NULL AND r.quartier IS NULL
          AND lower(r.commune) = lower(p_commune))
         OR
         -- tarif générique ville
         (r.commune IS NULL AND r.quartier IS NULL)
       )
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_operator_coverage(text, text, text, text) TO anon, authenticated;