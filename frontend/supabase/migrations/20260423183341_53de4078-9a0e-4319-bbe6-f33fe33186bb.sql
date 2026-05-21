-- ============================================================
-- Forwarder Tiered Pricing System
-- Note: FK to public.forwarders is added conditionally (table exists in prod, may not in preview)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.forwarder_pricing_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forwarder_id uuid NOT NULL,
  mode text NOT NULL CHECK (mode IN ('sea','air','road','rail')),
  country_code text NOT NULL,
  city_id uuid NULL,
  currency text NOT NULL DEFAULT 'USD',
  transit_min_days int NULL,
  transit_max_days int NULL,
  deposit_pct numeric(5,2) NOT NULL DEFAULT 0,
  deposit_threshold_cbm numeric(10,2) NULL,
  notes text NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Conditional FKs (forwarders + cities tables may not exist on every environment)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='forwarders')
     AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='fpp_forwarder_fk') THEN
    ALTER TABLE public.forwarder_pricing_profiles
      ADD CONSTRAINT fpp_forwarder_fk FOREIGN KEY (forwarder_id) REFERENCES public.forwarders(id) ON DELETE CASCADE;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='cities')
     AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='fpp_city_fk') THEN
    ALTER TABLE public.forwarder_pricing_profiles
      ADD CONSTRAINT fpp_city_fk FOREIGN KEY (city_id) REFERENCES public.cities(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_fpp_unique
  ON public.forwarder_pricing_profiles (forwarder_id, mode, country_code, COALESCE(city_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS idx_fpp_active ON public.forwarder_pricing_profiles (forwarder_id, is_active);

CREATE TABLE IF NOT EXISTS public.forwarder_cbm_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.forwarder_pricing_profiles(id) ON DELETE CASCADE,
  min_cbm numeric(10,3) NOT NULL DEFAULT 0,
  max_cbm numeric(10,3) NULL,
  price_per_cbm numeric(12,2) NULL,
  is_quote_only boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fct_profile ON public.forwarder_cbm_tiers (profile_id, sort_order);

CREATE TABLE IF NOT EXISTS public.forwarder_piece_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.forwarder_pricing_profiles(id) ON DELETE CASCADE,
  category_id uuid NULL,
  custom_label text NULL,
  pricing_unit text NOT NULL DEFAULT 'piece' CHECK (pricing_unit IN ('piece','cbm')),
  price numeric(12,2) NOT NULL,
  min_quantity int NOT NULL DEFAULT 1,
  includes_customs boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='categories')
     AND NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='fpt_category_fk') THEN
    ALTER TABLE public.forwarder_piece_tiers
      ADD CONSTRAINT fpt_category_fk FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_fpt_profile ON public.forwarder_piece_tiers (profile_id, sort_order);

CREATE TABLE IF NOT EXISTS public.forwarder_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.forwarder_pricing_profiles(id) ON DELETE CASCADE,
  restriction_type text NOT NULL CHECK (restriction_type IN ('forbidden','license_required','info')),
  label text NOT NULL,
  icon text NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fr_profile ON public.forwarder_restrictions (profile_id, sort_order);

DROP TRIGGER IF EXISTS trg_fpp_updated_at ON public.forwarder_pricing_profiles;
CREATE TRIGGER trg_fpp_updated_at
  BEFORE UPDATE ON public.forwarder_pricing_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.forwarder_pricing_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forwarder_cbm_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forwarder_piece_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forwarder_restrictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active forwarder profiles"
  ON public.forwarder_pricing_profiles FOR SELECT USING (is_active = true);
CREATE POLICY "Admins manage forwarder profiles"
  ON public.forwarder_pricing_profiles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Public read CBM tiers of active profiles"
  ON public.forwarder_cbm_tiers FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.forwarder_pricing_profiles p WHERE p.id = profile_id AND p.is_active = true));
CREATE POLICY "Admins manage CBM tiers"
  ON public.forwarder_cbm_tiers FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Public read piece tiers of active profiles"
  ON public.forwarder_piece_tiers FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.forwarder_pricing_profiles p WHERE p.id = profile_id AND p.is_active = true));
CREATE POLICY "Admins manage piece tiers"
  ON public.forwarder_piece_tiers FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Public read restrictions of active profiles"
  ON public.forwarder_restrictions FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.forwarder_pricing_profiles p WHERE p.id = profile_id AND p.is_active = true));
CREATE POLICY "Admins manage restrictions"
  ON public.forwarder_restrictions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

-- Public view (masks notes)
DROP VIEW IF EXISTS public.v_forwarder_profiles_public;
CREATE VIEW public.v_forwarder_profiles_public
WITH (security_invoker = true) AS
SELECT id, forwarder_id, mode, country_code, city_id, currency,
       transit_min_days, transit_max_days, deposit_pct, deposit_threshold_cbm,
       is_active, created_at, updated_at
FROM public.forwarder_pricing_profiles
WHERE is_active = true;
GRANT SELECT ON public.v_forwarder_profiles_public TO anon, authenticated;

-- RPC quote_forwarder
CREATE OR REPLACE FUNCTION public.quote_forwarder(
  p_profile_id uuid,
  p_items jsonb,
  p_total_cbm numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_profile RECORD;
  v_item jsonb;
  v_total numeric := 0;
  v_breakdown jsonb := '[]'::jsonb;
  v_remaining_cbm numeric := 0;
  v_total_cbm numeric := 0;
  v_match RECORD;
  v_line_total numeric;
  v_qty int;
  v_item_cbm numeric;
  v_cbm_tier RECORD;
  v_deposit_required boolean := false;
  v_restrictions jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_profile FROM public.forwarder_pricing_profiles WHERE id = p_profile_id AND is_active = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','profile_not_found'); END IF;

  IF p_total_cbm IS NULL THEN
    SELECT COALESCE(SUM((it->>'cbm')::numeric * COALESCE((it->>'quantity')::int,1)), 0)
      INTO v_total_cbm FROM jsonb_array_elements(COALESCE(p_items,'[]'::jsonb)) it;
  ELSE
    v_total_cbm := p_total_cbm;
  END IF;
  v_remaining_cbm := v_total_cbm;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items,'[]'::jsonb)) LOOP
    v_qty := COALESCE((v_item->>'quantity')::int, 1);
    v_item_cbm := COALESCE((v_item->>'cbm')::numeric, 0) * v_qty;

    SELECT * INTO v_match FROM public.forwarder_piece_tiers
    WHERE profile_id = p_profile_id
      AND (
        (v_item ? 'category_id' AND category_id IS NOT NULL AND category_id::text = v_item->>'category_id')
        OR (v_item ? 'custom_label' AND custom_label IS NOT NULL AND lower(custom_label) = lower(v_item->>'custom_label'))
      )
    LIMIT 1;

    IF FOUND THEN
      IF v_qty < v_match.min_quantity THEN v_qty := v_match.min_quantity; END IF;
      IF v_match.pricing_unit = 'piece' THEN
        v_line_total := v_qty * v_match.price;
      ELSE
        v_line_total := v_item_cbm * v_match.price;
        v_remaining_cbm := GREATEST(v_remaining_cbm - v_item_cbm, 0);
      END IF;
      v_total := v_total + v_line_total;
      v_breakdown := v_breakdown || jsonb_build_object(
        'type','piece_tier',
        'label', COALESCE(v_match.custom_label, 'Catégorie'),
        'unit', v_match.pricing_unit,
        'unit_price', v_match.price,
        'quantity', v_qty,
        'cbm', CASE WHEN v_match.pricing_unit='cbm' THEN v_item_cbm ELSE NULL END,
        'includes_customs', v_match.includes_customs,
        'line_total', v_line_total
      );
    END IF;
  END LOOP;

  IF v_remaining_cbm > 0 THEN
    SELECT * INTO v_cbm_tier FROM public.forwarder_cbm_tiers
    WHERE profile_id = p_profile_id
      AND v_remaining_cbm >= min_cbm
      AND (max_cbm IS NULL OR v_remaining_cbm <= max_cbm)
    ORDER BY sort_order, min_cbm LIMIT 1;

    IF FOUND THEN
      IF v_cbm_tier.is_quote_only OR v_cbm_tier.price_per_cbm IS NULL THEN
        v_breakdown := v_breakdown || jsonb_build_object(
          'type','cbm_tier','label','Sur devis','cbm',v_remaining_cbm,'quote_only',true);
      ELSE
        v_line_total := v_remaining_cbm * v_cbm_tier.price_per_cbm;
        v_total := v_total + v_line_total;
        v_breakdown := v_breakdown || jsonb_build_object(
          'type','cbm_tier',
          'label', v_cbm_tier.min_cbm || '–' || COALESCE(v_cbm_tier.max_cbm::text,'∞') || ' CBM',
          'unit_price', v_cbm_tier.price_per_cbm,
          'cbm', v_remaining_cbm,
          'line_total', v_line_total);
      END IF;
    END IF;
  END IF;

  IF v_profile.deposit_pct > 0 AND v_profile.deposit_threshold_cbm IS NOT NULL
     AND v_total_cbm > v_profile.deposit_threshold_cbm THEN
    v_deposit_required := true;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('type', restriction_type, 'label', label, 'icon', icon) ORDER BY sort_order), '[]'::jsonb)
    INTO v_restrictions FROM public.forwarder_restrictions WHERE profile_id = p_profile_id;

  RETURN jsonb_build_object(
    'profile_id', p_profile_id,
    'currency', v_profile.currency,
    'total', ROUND(v_total::numeric, 2),
    'total_cbm', v_total_cbm,
    'breakdown', v_breakdown,
    'deposit_required', v_deposit_required,
    'deposit_pct', v_profile.deposit_pct,
    'deposit_amount', CASE WHEN v_deposit_required THEN ROUND((v_total * v_profile.deposit_pct / 100)::numeric, 2) ELSE 0 END,
    'transit_min_days', v_profile.transit_min_days,
    'transit_max_days', v_profile.transit_max_days,
    'restrictions', v_restrictions
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.quote_forwarder(uuid, jsonb, numeric) TO anon, authenticated;