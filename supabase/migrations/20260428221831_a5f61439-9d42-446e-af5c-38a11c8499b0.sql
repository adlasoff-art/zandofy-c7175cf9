DROP FUNCTION IF EXISTS public.quote_forwarder(uuid, jsonb, numeric);
DROP FUNCTION IF EXISTS public.quote_forwarder(uuid, jsonb, numeric, text);
DROP FUNCTION IF EXISTS public.quote_forwarder(uuid, jsonb, numeric, numeric);

CREATE FUNCTION public.quote_forwarder(
  p_profile_id uuid,
  p_items jsonb,
  p_total_cbm numeric DEFAULT NULL,
  p_consolidation_choice text DEFAULT 'split'
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
  v_item jsonb;
  v_subpackages jsonb := '[]'::jsonb;
  v_subpkg jsonb;
  v_supplier text;
  v_qty numeric;
  v_cbm numeric;
  v_weight numeric;
  v_volumetric numeric;
  v_billable numeric;
  v_billable_lookup numeric;
  v_real_total numeric;
  v_split_total numeric := 0;
  v_consolidated_total numeric := 0;
  v_consolidated_billable numeric := 0;
  v_kg_tier RECORD;
  v_cbm_tier RECORD;
  v_piece_tier RECORD;
  v_line_total numeric;
  v_tier_used text;
  v_restrictions jsonb := '[]'::jsonb;
  v_grouped jsonb := '{}'::jsonb;
  v_key text;
  v_cur jsonb;
  v_consolidation_offer jsonb := NULL;
  v_consolidation_fee numeric := 0;
  v_consolidation_base numeric := 0;
  v_count_pkgs int;
  v_any_round_up boolean;
BEGIN
  SELECT * INTO v_profile FROM public.forwarder_pricing_profiles WHERE id = p_profile_id AND is_active = true;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'profile_not_found_or_inactive'); END IF;

  SELECT EXISTS (SELECT 1 FROM public.forwarder_kg_tiers WHERE profile_id = p_profile_id AND round_up_to_kg = true) INTO v_any_round_up;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('type', restriction_type, 'label', label, 'icon', icon) ORDER BY sort_order), '[]'::jsonb)
  INTO v_restrictions FROM public.forwarder_restrictions WHERE profile_id = p_profile_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) LOOP
    v_supplier := COALESCE(v_item->>'supplier_id', 'default');
    v_qty := COALESCE((v_item->>'quantity')::numeric, 1);
    v_cbm := COALESCE((v_item->>'cbm')::numeric, 0) * v_qty;
    v_weight := COALESCE((v_item->>'weight_kg')::numeric, 0) * v_qty;
    v_cur := COALESCE(v_grouped->v_supplier, jsonb_build_object('supplier_id', v_supplier, 'real_weight_kg', 0, 'cbm', 0, 'items', '[]'::jsonb));
    v_cur := jsonb_set(v_cur, '{real_weight_kg}', to_jsonb(((v_cur->>'real_weight_kg')::numeric + v_weight)));
    v_cur := jsonb_set(v_cur, '{cbm}', to_jsonb(((v_cur->>'cbm')::numeric + v_cbm)));
    v_cur := jsonb_set(v_cur, '{items}', (v_cur->'items') || jsonb_build_array(v_item));
    v_grouped := jsonb_set(v_grouped, ARRAY[v_supplier], v_cur);
  END LOOP;

  FOR v_key IN SELECT jsonb_object_keys(v_grouped) LOOP
    v_cur := v_grouped->v_key;
    v_real_total := (v_cur->>'real_weight_kg')::numeric;
    v_cbm := (v_cur->>'cbm')::numeric;
    IF COALESCE(v_profile.volumetric_divisor, 0) > 0 AND v_cbm > 0 THEN
      v_volumetric := (v_cbm * 1000000) / v_profile.volumetric_divisor;
    ELSE v_volumetric := 0; END IF;
    v_billable := GREATEST(v_real_total, v_volumetric);
    IF v_any_round_up THEN v_billable_lookup := GREATEST(1, CEIL(v_billable)); ELSE v_billable_lookup := v_billable; END IF;
    v_tier_used := 'none'; v_line_total := 0;

    SELECT fpt.* INTO v_piece_tier FROM public.forwarder_piece_tiers fpt
    WHERE fpt.profile_id = p_profile_id AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_cur->'items') it
      WHERE (it->>'category_id') = fpt.category_id::text
         OR (fpt.custom_label IS NOT NULL AND (it->>'custom_label') = fpt.custom_label))
    ORDER BY fpt.sort_order LIMIT 1;

    IF FOUND THEN
      v_tier_used := 'piece';
      SELECT COALESCE(SUM((it->>'quantity')::numeric), 0) INTO v_qty
      FROM jsonb_array_elements(v_cur->'items') it
      WHERE (it->>'category_id') = v_piece_tier.category_id::text
         OR (v_piece_tier.custom_label IS NOT NULL AND (it->>'custom_label') = v_piece_tier.custom_label);
      v_line_total := v_piece_tier.price * v_qty;
    ELSE
      SELECT * INTO v_kg_tier FROM public.forwarder_kg_tiers
      WHERE profile_id = p_profile_id AND v_billable_lookup >= min_kg AND (max_kg IS NULL OR v_billable_lookup <= max_kg)
      ORDER BY sort_order, min_kg LIMIT 1;
      IF NOT FOUND THEN
        SELECT * INTO v_kg_tier FROM public.forwarder_kg_tiers WHERE profile_id = p_profile_id AND max_kg IS NULL
        ORDER BY sort_order DESC, min_kg DESC LIMIT 1;
      END IF;
      IF NOT FOUND THEN
        SELECT * INTO v_kg_tier FROM public.forwarder_kg_tiers WHERE profile_id = p_profile_id
        ORDER BY sort_order DESC, min_kg DESC LIMIT 1;
      END IF;
      IF FOUND THEN
        IF v_kg_tier.round_up_to_kg THEN v_billable := GREATEST(1, CEIL(v_billable)); END IF;
        v_tier_used := 'kg';
        IF v_kg_tier.is_quote_only THEN v_line_total := 0; v_tier_used := 'quote_only';
        ELSIF v_kg_tier.flat_price IS NOT NULL THEN v_line_total := v_kg_tier.flat_price;
        ELSE v_line_total := v_kg_tier.price_per_kg * v_billable; END IF;
      ELSE
        SELECT * INTO v_cbm_tier FROM public.forwarder_cbm_tiers
        WHERE profile_id = p_profile_id AND v_cbm >= min_cbm AND (max_cbm IS NULL OR v_cbm <= max_cbm)
        ORDER BY sort_order, min_cbm LIMIT 1;
        IF FOUND THEN
          v_tier_used := 'cbm';
          IF v_cbm_tier.is_quote_only THEN v_line_total := 0; v_tier_used := 'quote_only';
          ELSE v_line_total := COALESCE(v_cbm_tier.price_per_cbm, 0) * v_cbm; END IF;
        ELSE v_tier_used := 'quote_only'; v_line_total := 0; END IF;
      END IF;
    END IF;

    v_subpkg := jsonb_build_object('supplier_id', v_key, 'real_weight_kg', v_real_total, 'volumetric_weight_kg', v_volumetric,
      'billable_weight_kg', v_billable, 'cbm', v_cbm, 'tier_used', v_tier_used, 'line_total', v_line_total);
    v_subpackages := v_subpackages || jsonb_build_array(v_subpkg);
    v_split_total := v_split_total + v_line_total;
    v_consolidated_billable := v_consolidated_billable + v_billable;
  END LOOP;

  v_count_pkgs := jsonb_array_length(v_subpackages);
  IF v_profile.consolidation_enabled AND v_count_pkgs >= COALESCE(v_profile.consolidation_min_packages, 2) THEN
    SELECT * INTO v_kg_tier FROM public.forwarder_kg_tiers
    WHERE profile_id = p_profile_id AND v_consolidated_billable >= min_kg AND (max_kg IS NULL OR v_consolidated_billable <= max_kg)
    ORDER BY sort_order, min_kg LIMIT 1;
    IF FOUND AND NOT v_kg_tier.is_quote_only THEN
      IF v_kg_tier.flat_price IS NOT NULL THEN v_consolidation_base := v_kg_tier.flat_price;
      ELSE v_consolidation_base := v_kg_tier.price_per_kg * v_consolidated_billable; END IF;
      v_consolidation_fee := COALESCE(v_profile.consolidation_fee_flat, 0) + COALESCE(v_profile.consolidation_fee_per_kg, 0) * v_consolidated_billable;
      v_consolidated_total := v_consolidation_base + v_consolidation_fee;
      v_consolidation_offer := jsonb_build_object('available', true, 'consolidated_billable_kg', v_consolidated_billable,
        'base_price', v_consolidation_base, 'consolidation_fee', v_consolidation_fee,
        'consolidated_total', v_consolidated_total, 'delta_vs_split', v_consolidated_total - v_split_total);
    END IF;
  END IF;

  RETURN jsonb_build_object('profile_id', p_profile_id, 'currency', v_profile.currency, 'mode', p_consolidation_choice,
    'subpackages', v_subpackages, 'split_total', v_split_total, 'consolidation_offer', v_consolidation_offer,
    'total', CASE WHEN p_consolidation_choice = 'consolidated' AND v_consolidation_offer IS NOT NULL THEN v_consolidated_total ELSE v_split_total END,
    'deposit_required', (v_profile.deposit_threshold_cbm IS NOT NULL AND COALESCE(p_total_cbm, 0) >= v_profile.deposit_threshold_cbm),
    'deposit_pct', v_profile.deposit_pct, 'transit_min_days', v_profile.transit_min_days,
    'transit_max_days', v_profile.transit_max_days, 'restrictions', v_restrictions);
END;
$$;

COMMENT ON FUNCTION public.quote_forwarder IS 'Hotfix 2026-04-29 : palier KG choisi APRÈS arrondi quand round_up_to_kg actif, borne max_kg inclusive (<=), filet de sécurité sur palier ouvert.';