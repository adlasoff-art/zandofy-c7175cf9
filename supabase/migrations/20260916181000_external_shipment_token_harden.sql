-- Purpose: Harden get_external_shipment_by_token (kill switch + event sanitize).
-- Safe re-apply if 20260916180000 already ran with the first RPC revision.
-- Tables: none new. Function: public.get_external_shipment_by_token
-- Risk: low — additive behavior only.

CREATE OR REPLACE FUNCTION public.get_external_shipment_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.external_shipments%ROWTYPE;
  v_fw_name text;
  v_enabled boolean;
  v_safe_events jsonb;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 8 THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE((ps.value->>'public_tracking_enabled')::boolean, true)
    INTO v_enabled
    FROM public.platform_settings ps
   WHERE ps.key = 'forwarder_saas';

  IF v_enabled IS FALSE THEN
    RETURN jsonb_build_object('disabled', true);
  END IF;

  SELECT * INTO v_row
  FROM public.external_shipments
  WHERE public_token = trim(p_token);

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT f.name INTO v_fw_name
  FROM public.forwarders f
  WHERE f.id = v_row.forwarder_id;

  SELECT COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'at', e->>'at',
               'status', e->>'status',
               'label', e->>'label'
             )
             ORDER BY COALESCE(e->>'at', '')
           ),
           '[]'::jsonb
         )
    INTO v_safe_events
    FROM jsonb_array_elements(
           CASE
             WHEN jsonb_typeof(v_row.events) = 'array' THEN v_row.events
             ELSE '[]'::jsonb
           END
         ) AS e;

  RETURN jsonb_build_object(
    'awb_bl', v_row.awb_bl,
    'mode', v_row.mode,
    'status', v_row.status,
    'origin', v_row.origin,
    'destination', v_row.destination,
    'eta', v_row.eta,
    'events', v_safe_events,
    'updated_at', v_row.updated_at,
    'forwarder_name', v_fw_name
  );
END;
$$;

COMMENT ON FUNCTION public.get_external_shipment_by_token(text)
  IS 'Public tracking for external_shipments by opaque token; respects forwarder_saas.public_tracking_enabled; no consignee PII.';
