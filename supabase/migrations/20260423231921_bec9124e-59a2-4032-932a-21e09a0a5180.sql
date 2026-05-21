CREATE OR REPLACE FUNCTION public.quote_forwarder(
  p_profile_id uuid,
  p_items jsonb,
  p_total_cbm numeric DEFAULT NULL,
  p_total_weight_kg numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_profile RECORD;
  v_item jsonb;
  v_total numeric := 0;
  v_breakdown jsonb := '[]'::jsonb;
  v_remaining_cbm numeric := 0;
  v_remaining_kg numeric := 0;
  v_total_cbm numeric := 0;
  v_total_kg numeric := 0;
  v_billable_kg numeric := 0;
  v_billable_unit text;
  v_match RECORD;
  v_line_total numeric;
  v_qty int;
  v_item_cbm numeric;
  v_item_kg numeric;
  v_tier RECORD;
  v_deposit_required boolean := false;
  v_restrictions jsonb := '[]'::jsonb;
  v_surcharges jsonb := '[]'::jsonb;
  v_surcharge RECORD;
  v_surcharge_amount numeric;
BEGIN
  SELECT * INTO v_profile FROM public.forwarder_pricing_profiles
    WHERE id = p_profile_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error','profile_not_found');
  END IF;

  -- Totaux CBM / kg
  IF p_total_cbm IS NULL THEN
    SELECT COALESCE(SUM((it->>'cbm')::numeric * COALESCE((it->>'quantity')::int,1)), 0)
      INTO v_total_cbm FROM jsonb_array_elements(COALESCE(p_items,'[]'::jsonb)) it;
  ELSE
    v_total_cbm := p_total_cbm;
  END IF;

  IF p_total_weight_kg IS NULL THEN
    SELECT COALESCE(SUM((it->>'weight_kg')::numeric * COALESCE((it->>'quantity')::int,1)), 0)
      INTO v_total_kg FROM jsonb_array_elements(COALESCE(p_items,'[]'::jsonb)) it;
  ELSE
    v_total_kg := p_total_weight_kg;
  END IF;

  -- Poids facturable aérien : max(poids_réel, vol_cm³ / diviseur)
  IF v_profile.mode = 'air' AND COALESCE(v_profile.volumetric_divisor,0) > 0 THEN
    v_billable_kg := GREATEST(v_total_kg, (v_total_cbm * 1000000.0) / v_profile.volumetric_divisor);
    v_billable_unit := 'kg';
  ELSE
    v_billable_kg := v_total_kg;
    v_billable_unit := 'cbm';
  END IF;

  v_remaining_cbm := v_total_cbm;
  v_remaining_kg  := v_billable_kg;

  -- Paliers par pièce / catégorie
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items,'[]'::jsonb)) LOOP
    v_qty := COALESCE((v_item->>'quantity')::int, 1);
    v_item_cbm := COALESCE((v_item->>'cbm')::numeric, 0) * v_qty;
    v_item_kg  := COALESCE((v_item->>'weight_kg')::numeric, 0) * v_qty;

    SELECT * INTO v_match FROM public.forwarder_piece_tiers
    WHERE profile_id = p_profile_id
      AND (
        (v_item ? 'category_id' AND category_id IS NOT NULL AND category_id::text = v_item->>'category_id')
        OR (v_item ? 'custom_label' AND custom_label IS NOT NULL AND lower(custom_label) = lower(v_item->>'custom_label'))
      )
    LIMIT 1;

    IF FOUND THEN
      IF v_qty < v_match.min_quantity THEN v_qty := v_match.min_quantity; END IF;

      IF v_match.pricing_unit IN ('per_piece','piece') THEN
        v_line_total := v_qty * v_match.price;
      ELSIF v_match.pricing_unit = 'per_kg' THEN
        v_line_total := v_item_kg * v_match.price;
        v_remaining_kg := GREATEST(v_remaining_kg - v_item_kg, 0);
      ELSIF v_match.pricing_unit IN ('per_cbm','cbm') THEN
        v_line_total := v_item_cbm * v_match.price;
        v_remaining_cbm := GREATEST(v_remaining_cbm - v_item_cbm, 0);
      ELSE -- flat
        v_line_total := v_match.price;
      END IF;

      v_total := v_total + v_line_total;
      v_breakdown := v_breakdown || jsonb_build_object(
        'type','piece_tier',
        'label', COALESCE(v_match.custom_label, 'Catégorie'),
        'unit', v_match.pricing_unit,
        'unit_price', v_match.price,
        'quantity', v_qty,
        'cbm', CASE WHEN v_match.pricing_unit IN ('per_cbm','cbm') THEN v_item_cbm ELSE NULL END,
        'kg',  CASE WHEN v_match.pricing_unit = 'per_kg' THEN v_item_kg ELSE NULL END,
        'includes_customs', v_match.includes_customs,
        'line_total', v_line_total
      );
    END IF;
  END LOOP;

  -- Paliers volumétriques (kg ou CBM selon unit)
  IF v_billable_unit = 'kg' AND v_remaining_kg > 0 THEN
    SELECT * INTO v_tier FROM public.forwarder_cbm_tiers
    WHERE profile_id = p_profile_id
      AND unit = 'kg'
      AND v_remaining_kg >= min_cbm
      AND (max_cbm IS NULL OR v_remaining_kg <= max_cbm)
    ORDER BY sort_order, min_cbm LIMIT 1;

    IF FOUND THEN
      IF v_tier.is_quote_only OR v_tier.price_per_cbm IS NULL THEN
        v_breakdown := v_breakdown || jsonb_build_object(
          'type','weight_tier','label','Sur devis','kg',v_remaining_kg,'quote_only',true);
      ELSE
        v_line_total := v_remaining_kg * v_tier.price_per_cbm;
        v_total := v_total + v_line_total;
        v_breakdown := v_breakdown || jsonb_build_object(
          'type','weight_tier',
          'label', v_tier.min_cbm || '–' || COALESCE(v_tier.max_cbm::text,'∞') || ' kg',
          'unit_price', v_tier.price_per_cbm,
          'kg', v_remaining_kg,
          'line_total', v_line_total);
      END IF;
    END IF;
  ELSIF v_remaining_cbm > 0 THEN
    SELECT * INTO v_tier FROM public.forwarder_cbm_tiers
    WHERE profile_id = p_profile_id
      AND unit = 'cbm'
      AND v_remaining_cbm >= min_cbm
      AND (max_cbm IS NULL OR v_remaining_cbm <= max_cbm)
    ORDER BY sort_order, min_cbm LIMIT 1;

    IF FOUND THEN
      IF v_tier.is_quote_only OR v_tier.price_per_cbm IS NULL THEN
        v_breakdown := v_breakdown || jsonb_build_object(
          'type','cbm_tier','label','Sur devis','cbm',v_remaining_cbm,'quote_only',true);
      ELSE
        v_line_total := v_remaining_cbm * v_tier.price_per_cbm;
        v_total := v_total + v_line_total;
        v_breakdown := v_breakdown || jsonb_build_object(
          'type','cbm_tier',
          'label', v_tier.min_cbm || '–' || COALESCE(v_tier.max_cbm::text,'∞') || ' CBM',
          'unit_price', v_tier.price_per_cbm,
          'cbm', v_remaining_cbm,
          'line_total', v_line_total);
      END IF;
    END IF;
  END IF;

  -- Surcharges (fixe prioritaire, % en option)
  FOR v_surcharge IN
    SELECT * FROM public.forwarder_surcharges WHERE profile_id = p_profile_id ORDER BY sort_order
  LOOP
    v_surcharge_amount := 0;
    IF v_surcharge.surcharge_type = 'fixed_per_kg' THEN
      v_surcharge_amount := v_billable_kg * v_surcharge.amount;
    ELSIF v_surcharge.surcharge_type = 'fixed_per_cbm' THEN
      v_surcharge_amount := v_total_cbm * v_surcharge.amount;
    ELSIF v_surcharge.surcharge_type = 'fixed_per_order' THEN
      v_surcharge_amount := v_surcharge.amount;
    ELSIF v_surcharge.surcharge_type = 'percent' THEN
      v_surcharge_amount := v_total * (v_surcharge.amount / 100.0);
    END IF;
    v_total := v_total + v_surcharge_amount;
    v_surcharges := v_surcharges || jsonb_build_object(
      'label', v_surcharge.label,
      'type', v_surcharge.surcharge_type,
      'amount', v_surcharge.amount,
      'computed', v_surcharge_amount
    );
  END LOOP;

  -- Acompte
  IF v_profile.deposit_pct > 0 AND v_profile.deposit_threshold_cbm IS NOT NULL
     AND v_total_cbm > v_profile.deposit_threshold_cbm THEN
    v_deposit_required := true;
  END IF;

  -- Restrictions (info / forbidden / license_required)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'type', restriction_type, 'label', label, 'icon', icon) ORDER BY sort_order), '[]'::jsonb)
    INTO v_restrictions FROM public.forwarder_restrictions WHERE profile_id = p_profile_id;

  RETURN jsonb_build_object(
    'profile_id', p_profile_id,
    'mode', v_profile.mode,
    'service_class', v_profile.service_class,
    'currency', v_profile.currency,
    'total', ROUND(v_total, 2),
    'total_cbm', v_total_cbm,
    'total_weight_kg', v_total_kg,
    'billable_kg', ROUND(v_billable_kg, 2),
    'billable_unit', v_billable_unit,
    'volumetric_divisor', v_profile.volumetric_divisor,
    'transit_min_days', v_profile.transit_min_days,
    'transit_max_days', v_profile.transit_max_days,
    'deposit_required', v_deposit_required,
    'deposit_pct', v_profile.deposit_pct,
    'breakdown', v_breakdown,
    'surcharges', v_surcharges,
    'restrictions', v_restrictions
  );
END;
$function$;