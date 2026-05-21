-- Lot 1.2 — Migration legacy fees → delivery_operator_rates (Very Speed conservé)
-- Idempotent : peut être rejoué sans créer de doublons.

DO $$
DECLARE
  v_operator_id uuid := 'abbbc968-1180-4b07-86d7-4ceaaf274a8e';
  v_country text := 'CD';
  v_currency text := 'USD';
  v_inserted_communes int := 0;
  v_inserted_quartiers int := 0;
BEGIN
  -- Vérifie l'existence de l'opérateur. Si absent (cas Lovable Cloud preview), on log et on sort proprement.
  IF NOT EXISTS (SELECT 1 FROM public.delivery_operators WHERE id = v_operator_id) THEN
    RAISE NOTICE 'Operator % not found — skipping legacy migration (preview env)', v_operator_id;
    RETURN;
  END IF;

  -- A. Communes : crée 1 tarif par commune ayant un delivery_fee > 0
  WITH src AS (
    SELECT
      c.id AS commune_id,
      c.name AS commune_name,
      c.city AS city_name,
      c.country_code,
      c.delivery_fee::numeric AS base_price
    FROM public.communes c
    WHERE c.delivery_fee IS NOT NULL
      AND c.delivery_fee > 0
      AND COALESCE(c.is_deliverable, true) = true
  ),
  ins AS (
    INSERT INTO public.delivery_operator_rates
      (operator_id, country_code, city, zone_name, commune, quartier,
       base_price, surcharge, price_per_km, currency, estimated_minutes,
       is_active, status, submitted_at, reviewed_at, reviewed_by)
    SELECT
      v_operator_id,
      COALESCE(s.country_code, v_country),
      s.city_name,
      s.commune_name,                 -- zone_name = commune
      s.commune_name,
      NULL,
      s.base_price,
      0,
      0,
      v_currency,
      45,                              -- ETA défaut 45 min (modifiable ensuite)
      true,
      'approved',
      now(),
      now(),
      NULL                             -- migration système, pas d'admin reviewer
    FROM src s
    WHERE NOT EXISTS (
      SELECT 1 FROM public.delivery_operator_rates r
      WHERE r.operator_id = v_operator_id
        AND r.city = s.city_name
        AND r.commune = s.commune_name
        AND r.quartier IS NULL
    )
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_inserted_communes FROM ins;

  -- B. Quartiers : crée 1 tarif par quartier avec delivery_surcharge > 0
  --    base_price = delivery_fee de la commune parente, surcharge = delivery_surcharge du quartier
  WITH src AS (
    SELECT
      q.id AS quartier_id,
      q.name AS quartier_name,
      c.name AS commune_name,
      c.city AS city_name,
      c.country_code,
      COALESCE(c.delivery_fee, 0)::numeric AS base_price,
      q.delivery_surcharge::numeric AS surcharge
    FROM public.quartiers q
    JOIN public.communes c ON c.id = q.commune_id
    WHERE q.delivery_surcharge IS NOT NULL
      AND q.delivery_surcharge > 0
      AND COALESCE(q.is_active, true) = true
      AND COALESCE(q.is_restricted, false) = false
  ),
  ins AS (
    INSERT INTO public.delivery_operator_rates
      (operator_id, country_code, city, zone_name, commune, quartier,
       base_price, surcharge, price_per_km, currency, estimated_minutes,
       is_active, status, submitted_at, reviewed_at, reviewed_by)
    SELECT
      v_operator_id,
      COALESCE(s.country_code, v_country),
      s.city_name,
      s.quartier_name,                -- zone_name = quartier
      s.commune_name,
      s.quartier_name,
      s.base_price,
      s.surcharge,
      0,
      v_currency,
      45,
      true,
      'approved',
      now(),
      now(),
      NULL
    FROM src s
    WHERE NOT EXISTS (
      SELECT 1 FROM public.delivery_operator_rates r
      WHERE r.operator_id = v_operator_id
        AND r.city = s.city_name
        AND r.commune = s.commune_name
        AND r.quartier = s.quartier_name
    )
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_inserted_quartiers FROM ins;

  RAISE NOTICE 'Legacy migration done — communes: %, quartiers: %', v_inserted_communes, v_inserted_quartiers;
END $$;