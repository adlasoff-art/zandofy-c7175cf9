-- Purpose: Queue Facebook→Instagram posts for approved products (admin explicit enqueue only).
-- Tables: social_post_jobs, social_post_settings
-- Rollback: DROP FUNCTION enqueue_product_social_posts; DROP TABLE social_post_jobs, social_post_settings;
-- Risk (~4000 users): no buyer-facing schema change; admin-only social publishing.

CREATE TABLE IF NOT EXISTS public.social_post_settings (
  platform text PRIMARY KEY CHECK (platform IN ('facebook', 'instagram')),
  is_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.social_post_settings (platform, is_enabled)
VALUES ('facebook', true), ('instagram', true)
ON CONFLICT (platform) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.social_post_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('facebook', 'instagram')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'posted', 'failed', 'skipped')),
  image_mode text NOT NULL CHECK (image_mode IN ('primary', 'all')),
  caption_snapshot text,
  image_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
  external_post_id text,
  external_permalink text,
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  posted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS social_post_jobs_one_active
  ON public.social_post_jobs (product_id, platform)
  WHERE status IN ('pending', 'processing', 'posted');

CREATE INDEX IF NOT EXISTS idx_social_post_jobs_status_platform
  ON public.social_post_jobs (status, platform, created_at);

CREATE INDEX IF NOT EXISTS idx_social_post_jobs_product
  ON public.social_post_jobs (product_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_social_post_jobs_updated_at ON public.social_post_jobs;
CREATE TRIGGER trg_social_post_jobs_updated_at
BEFORE UPDATE ON public.social_post_jobs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.social_post_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage social_post_jobs" ON public.social_post_jobs;
CREATE POLICY "Admins manage social_post_jobs"
  ON public.social_post_jobs FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  );

DROP POLICY IF EXISTS "Admins manage social_post_settings" ON public.social_post_settings;
CREATE POLICY "Admins manage social_post_settings"
  ON public.social_post_settings FOR ALL
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  );

-- Sanitize payment / Mobile Money hints from free text
CREATE OR REPLACE FUNCTION public.social_sanitize_payment_text(p_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v text := COALESCE(p_text, '');
BEGIN
  v := regexp_replace(v, '(?i)\b(momo|orange\s*money|airtel\s*money|mpesa|iban|compte\s*bancaire|mobile\s*money|visa|mastercard)\b[:\s]*\S*', '', 'g');
  v := regexp_replace(v, '\b\d{8,}\b', '', 'g');
  v := regexp_replace(v, '[ \t]{2,}', ' ', 'g');
  v := regexp_replace(v, '\n{3,}', E'\n\n', 'g');
  RETURN trim(both FROM v);
END;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_product_social_posts(
  p_product_id uuid,
  p_image_mode text DEFAULT 'primary',
  p_force_repost boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_product RECORD;
  v_urls jsonb := '[]'::jsonb;
  v_url text;
  v_title text;
  v_product_url text;
  v_short text;
  v_details text := '';
  v_colors text;
  v_sizes text;
  v_parts text[] := ARRAY[]::text[];
  v_price_line text;
  v_caption_fb text;
  v_caption_ig text;
  v_fb_id uuid;
  v_ig_id uuid;
  v_fb_enabled boolean;
  v_ig_enabled boolean;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT (
    public.has_role(v_caller, 'admin'::app_role)
    OR public.has_role(v_caller, 'manager'::app_role)
  ) THEN
    RAISE EXCEPTION 'Admin or manager role required';
  END IF;

  IF p_image_mode NOT IN ('primary', 'all') THEN
    RAISE EXCEPTION 'Invalid image_mode';
  END IF;

  SELECT * INTO v_product
  FROM public.products
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  IF v_product.publish_status IS DISTINCT FROM 'published' THEN
    RAISE EXCEPTION 'Product must be published before social enqueue';
  END IF;

  SELECT is_enabled INTO v_fb_enabled FROM public.social_post_settings WHERE platform = 'facebook';
  SELECT is_enabled INTO v_ig_enabled FROM public.social_post_settings WHERE platform = 'instagram';
  v_fb_enabled := COALESCE(v_fb_enabled, true);
  v_ig_enabled := COALESCE(v_ig_enabled, true);

  IF NOT v_fb_enabled AND NOT v_ig_enabled THEN
    RAISE EXCEPTION 'Social publishing disabled for all platforms';
  END IF;

  IF p_force_repost THEN
    UPDATE public.social_post_jobs
    SET status = 'skipped',
        updated_at = now(),
        last_error = COALESCE(last_error, 'Superseded by force_repost')
    WHERE product_id = p_product_id
      AND status IN ('pending', 'processing', 'posted');
  END IF;

  -- Collect image URLs ordered by position
  FOR v_url IN
    SELECT pi.image_url
    FROM public.product_images pi
    WHERE pi.product_id = p_product_id
      AND pi.image_url IS NOT NULL
      AND length(trim(pi.image_url)) > 0
    ORDER BY pi.position NULLS LAST, pi.id
  LOOP
    IF p_image_mode = 'primary' AND jsonb_array_length(v_urls) >= 1 THEN
      EXIT;
    END IF;
    IF p_image_mode = 'all' AND jsonb_array_length(v_urls) >= 10 THEN
      EXIT;
    END IF;
    -- Prefer https
    IF v_url ~* '^https?://' THEN
      IF v_url ~* '^http://' THEN
        v_url := regexp_replace(v_url, '^http://', 'https://', 'i');
      END IF;
      v_urls := v_urls || jsonb_build_array(v_url);
    END IF;
  END LOOP;

  IF jsonb_array_length(v_urls) = 0 THEN
    RAISE EXCEPTION 'Product has no public image URL';
  END IF;

  v_title := COALESCE(NULLIF(trim(v_product.name_fr), ''), NULLIF(trim(v_product.name), ''), 'Produit Zandofy');
  v_product_url := 'https://zandofy.com/product/' || COALESCE(NULLIF(trim(v_product.slug), ''), v_product.id::text);
  v_short := public.social_sanitize_payment_text(v_product.short_description);

  SELECT string_agg(x, ', ' ORDER BY x)
  INTO v_colors
  FROM (
    SELECT DISTINCT NULLIF(trim(c.color_name), '') AS x
    FROM public.product_colors c
    WHERE c.product_id = p_product_id
  ) s
  WHERE x IS NOT NULL;

  SELECT string_agg(x, ', ' ORDER BY x)
  INTO v_sizes
  FROM (
    SELECT DISTINCT NULLIF(trim(s.size_label), '') AS x
    FROM public.product_sizes s
    WHERE s.product_id = p_product_id
  ) s
  WHERE x IS NOT NULL;

  IF v_colors IS NOT NULL AND length(v_colors) > 0 THEN
    v_parts := array_append(v_parts, 'Couleurs : ' || v_colors);
  END IF;
  IF v_sizes IS NOT NULL AND length(v_sizes) > 0 THEN
    v_parts := array_append(v_parts, 'Tailles : ' || v_sizes);
  END IF;
  IF NULLIF(trim(COALESCE(v_product.material, '')), '') IS NOT NULL THEN
    v_parts := array_append(v_parts, 'Matière : ' || trim(v_product.material));
  END IF;
  IF NULLIF(trim(COALESCE(v_product.style, '')), '') IS NOT NULL THEN
    v_parts := array_append(v_parts, 'Style : ' || trim(v_product.style));
  END IF;
  IF NULLIF(trim(COALESCE(v_product.origin_country, '')), '') IS NOT NULL THEN
    v_parts := array_append(v_parts, 'Origine : ' || trim(v_product.origin_country));
  END IF;

  IF array_length(v_parts, 1) IS NOT NULL THEN
    v_details := public.social_sanitize_payment_text(array_to_string(v_parts, ' · '));
  END IF;

  v_price_line := 'Prix : ' || COALESCE(NULLIF(trim(v_product.currency), ''), 'USD') || ' ' ||
    trim(to_char(COALESCE(v_product.price, 0), 'FM999999990.00'));

  -- Facebook: title, link, short, details, price
  v_caption_fb := v_title || E'\n\n' || v_product_url;
  IF v_short IS NOT NULL AND length(v_short) > 0 THEN
    v_caption_fb := v_caption_fb || E'\n\n' || v_short;
  END IF;
  IF v_details IS NOT NULL AND length(v_details) > 0 THEN
    v_caption_fb := v_caption_fb || E'\n\n' || v_details;
  END IF;
  v_caption_fb := v_caption_fb || E'\n\n' || v_price_line;

  -- Instagram: title, short, details, price, link last
  v_caption_ig := v_title;
  IF v_short IS NOT NULL AND length(v_short) > 0 THEN
    v_caption_ig := v_caption_ig || E'\n\n' || v_short;
  END IF;
  IF v_details IS NOT NULL AND length(v_details) > 0 THEN
    v_caption_ig := v_caption_ig || E'\n\n' || v_details;
  END IF;
  v_caption_ig := v_caption_ig || E'\n\n' || v_price_line || E'\n\n' || v_product_url;

  IF v_fb_enabled THEN
    INSERT INTO public.social_post_jobs (
      product_id, platform, status, image_mode, caption_snapshot, image_urls, requested_by
    ) VALUES (
      p_product_id, 'facebook', 'pending', p_image_mode, v_caption_fb, v_urls, v_caller
    )
    RETURNING id INTO v_fb_id;
  END IF;

  IF v_ig_enabled THEN
    INSERT INTO public.social_post_jobs (
      product_id, platform, status, image_mode, caption_snapshot, image_urls, requested_by
    ) VALUES (
      p_product_id, 'instagram', 'pending', p_image_mode, v_caption_ig, v_urls, v_caller
    )
    RETURNING id INTO v_ig_id;
  END IF;

  RETURN jsonb_build_object(
    'facebook_job_id', v_fb_id,
    'instagram_job_id', v_ig_id,
    'image_count', jsonb_array_length(v_urls),
    'image_mode', p_image_mode
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.enqueue_product_social_posts(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.social_sanitize_payment_text(text) TO authenticated;

COMMENT ON TABLE public.social_post_jobs IS 'Queue for Meta Facebook/Instagram product posts (admin enqueue only).';
COMMENT ON FUNCTION public.enqueue_product_social_posts IS 'Admin/manager: enqueue FB then IG jobs for a published product.';
