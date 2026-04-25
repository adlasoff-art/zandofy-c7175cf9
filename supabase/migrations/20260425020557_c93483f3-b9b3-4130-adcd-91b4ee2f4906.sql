-- Lot A: Mark Very Speed as platform-owned forwarder
-- Add columns to forwarders table
ALTER TABLE public.forwarders
  ADD COLUMN IF NOT EXISTS is_platform_owned BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unavailable_message TEXT;

-- Partial index for fast lookup of platform-owned forwarder
CREATE INDEX IF NOT EXISTS idx_forwarders_platform_owned
  ON public.forwarders (is_platform_owned)
  WHERE is_platform_owned = true;

-- Mark Very Speed as the platform-owned forwarder (case-insensitive match)
UPDATE public.forwarders
SET is_platform_owned = true
WHERE lower(name) IN ('very speed', 'veryspeed', 'verispeed');

-- Drop and recreate get_eligible_forwarders to:
--  1. Always return platform-owned forwarder (even with no zone profile)
--  2. Add has_profile_for_zone + is_platform_owned flags
DROP FUNCTION IF EXISTS public.get_eligible_forwarders(text, uuid, text);

CREATE OR REPLACE FUNCTION public.get_eligible_forwarders(
  p_country text,
  p_city_id uuid,
  p_mode text
)
RETURNS TABLE (
  forwarder_id uuid,
  forwarder_name text,
  forwarder_slug text,
  logo_url text,
  tier text,
  mode text,
  price_multiplier numeric,
  transit_min_days integer,
  transit_max_days integer,
  is_platform_owned boolean,
  has_profile_for_zone boolean,
  unavailable_message text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  -- Partner forwarders with profile matching zone
  SELECT
    f.id,
    f.name,
    f.slug,
    f.logo_url,
    COALESCE(fpp.tier, 'standard')::text AS tier,
    fpp.mode::text,
    COALESCE(fpp.price_multiplier, 1)::numeric,
    fpp.transit_min_days,
    fpp.transit_max_days,
    f.is_platform_owned,
    true AS has_profile_for_zone,
    f.unavailable_message
  FROM public.forwarders f
  INNER JOIN public.forwarder_pricing_profiles fpp ON fpp.forwarder_id = f.id
  WHERE f.is_active = true
    AND fpp.is_active = true
    AND fpp.mode = p_mode
    AND (fpp.country_code IS NULL OR upper(fpp.country_code) = upper(p_country))
    AND (fpp.city_id IS NULL OR fpp.city_id = p_city_id)

  UNION ALL

  -- Platform-owned forwarder WITHOUT a matching profile (greyed out card)
  SELECT
    f.id,
    f.name,
    f.slug,
    f.logo_url,
    'platform'::text AS tier,
    p_mode::text AS mode,
    1::numeric AS price_multiplier,
    NULL::integer AS transit_min_days,
    NULL::integer AS transit_max_days,
    f.is_platform_owned,
    false AS has_profile_for_zone,
    COALESCE(f.unavailable_message, 'Service plateforme non disponible dans votre zone') AS unavailable_message
  FROM public.forwarders f
  WHERE f.is_active = true
    AND f.is_platform_owned = true
    AND NOT EXISTS (
      SELECT 1
      FROM public.forwarder_pricing_profiles fpp2
      WHERE fpp2.forwarder_id = f.id
        AND fpp2.is_active = true
        AND fpp2.mode = p_mode
        AND (fpp2.country_code IS NULL OR upper(fpp2.country_code) = upper(p_country))
        AND (fpp2.city_id IS NULL OR fpp2.city_id = p_city_id)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_eligible_forwarders(text, uuid, text) TO anon, authenticated;