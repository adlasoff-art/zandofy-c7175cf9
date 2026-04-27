-- Lot 12 - Phase A: Customer order tracking RPC
-- Returns consolidated tracking info: order, last-mile delivery + rider GPS, operator, international shipments, forwarder handoffs.
-- Security: SECURITY DEFINER, ownership verified via orders.user_id = auth.uid().

CREATE OR REPLACE FUNCTION public.get_customer_tracking(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_order RECORD;
  v_result jsonb;
  v_delivery jsonb;
  v_rider_loc jsonb;
  v_operator jsonb;
  v_handoffs jsonb;
  v_shipments jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT id, user_id, store_id, status, order_ref, tracking_number,
         delivery_choice, delivery_option, shipping_mode,
         shipping_city, shipping_address, shipping_country,
         delivered_at, created_at, updated_at,
         delivery_operator_id, operator_acceptance_status,
         assigned_rider_id, assigned_rider_name,
         pickup_code, pickup_code_generated_at, pickup_code_verified_at,
         origin_country, total
    INTO v_order
    FROM public.orders
   WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_order.user_id <> v_user THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  -- Last-mile delivery
  SELECT to_jsonb(d.*) - 'customer_phone' - 'customer_name' - 'address'
    INTO v_delivery
    FROM public.deliveries d
   WHERE d.order_id = p_order_id
   ORDER BY d.created_at DESC
   LIMIT 1;

  -- Latest rider GPS for this delivery (only if recent < 30min)
  IF v_delivery IS NOT NULL THEN
    SELECT jsonb_build_object(
             'latitude', rl.latitude,
             'longitude', rl.longitude,
             'heading', rl.heading,
             'speed', rl.speed,
             'updated_at', rl.updated_at,
             'is_fresh', (rl.updated_at > now() - interval '30 minutes')
           )
      INTO v_rider_loc
      FROM public.rider_locations rl
     WHERE rl.delivery_id = (v_delivery->>'id')::uuid
     ORDER BY rl.updated_at DESC
     LIMIT 1;
  END IF;

  -- Delivery operator (multi-operator system, Lot 11B)
  IF v_order.delivery_operator_id IS NOT NULL THEN
    SELECT jsonb_build_object(
             'id', op.id,
             'company_name', op.company_name,
             'logo_url', op.logo_url,
             'contact_phone', op.contact_phone,
             'rating_avg', op.rating_avg,
             'is_platform_owned', op.is_platform_owned
           )
      INTO v_operator
      FROM public.delivery_operators op
     WHERE op.id = v_order.delivery_operator_id;
  END IF;

  -- Forwarder handoffs (international legs)
  SELECT jsonb_agg(
           jsonb_build_object(
             'id', h.id,
             'leg_index', h.leg_index,
             'status', h.status,
             'tracking_number', h.tracking_number,
             'tracking_carrier', h.tracking_carrier,
             'tracking_url', h.tracking_url,
             'intermediate_destination_city', h.intermediate_destination_city,
             'created_at', h.created_at,
             'updated_at', h.updated_at,
             'is_active', h.is_active
           ) ORDER BY h.leg_index
         )
    INTO v_handoffs
    FROM public.forwarder_handoffs h
   WHERE h.order_id = p_order_id
     AND h.is_active = true;

  -- International shipments (legacy / by tracking_number / awb)
  IF v_order.tracking_number IS NOT NULL THEN
    SELECT jsonb_agg(
             jsonb_build_object(
               'id', s.id,
               'awb_bl', s.awb_bl,
               'origin', s.origin,
               'destination', s.destination,
               'mode', s.mode,
               'status', s.status,
               'eta', s.eta,
               'updated_at', s.updated_at
             )
           )
      INTO v_shipments
      FROM public.shipments s
     WHERE s.awb_bl = v_order.tracking_number;
  END IF;

  v_result := jsonb_build_object(
    'order', jsonb_build_object(
      'id', v_order.id,
      'order_ref', v_order.order_ref,
      'status', v_order.status,
      'tracking_number', v_order.tracking_number,
      'delivery_choice', v_order.delivery_choice,
      'delivery_option', v_order.delivery_option,
      'shipping_mode', v_order.shipping_mode,
      'shipping_city', v_order.shipping_city,
      'shipping_country', v_order.shipping_country,
      'origin_country', v_order.origin_country,
      'created_at', v_order.created_at,
      'updated_at', v_order.updated_at,
      'delivered_at', v_order.delivered_at,
      'pickup_code', v_order.pickup_code,
      'pickup_code_generated_at', v_order.pickup_code_generated_at,
      'pickup_code_verified_at', v_order.pickup_code_verified_at,
      'assigned_rider_name', v_order.assigned_rider_name
    ),
    'delivery', v_delivery,
    'rider_location', v_rider_loc,
    'operator', v_operator,
    'handoffs', COALESCE(v_handoffs, '[]'::jsonb),
    'shipments', COALESCE(v_shipments, '[]'::jsonb)
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_customer_tracking(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customer_tracking(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_customer_tracking(uuid)
  IS 'Lot 12 - Returns consolidated tracking info for an order owned by the authenticated customer.';