-- Purpose: Harden product gallery sync (audit follow-up).
-- Tables: product_images (+ RPC sync_product_gallery)
-- Changes vs first cut:
--   - Allow active store collaborators with "products" permission (not owner-only)
--   - Cap gallery size; reject non-http(s) / non product-media Storage URLs
--   - Smart sync (keep rows with same URL → preserve embeddings); no blind wipe
--   - No TEMP tables (unsafe with PgBouncer / pooled sessions)
--   - RLS insert/update/delete also allow collaborators with products permission
-- Rollback: DROP FUNCTION public.sync_product_gallery(uuid, jsonb);
-- Risk (~4000+ users): Low — CREATE OR REPLACE + DROP POLICY IF EXISTS; public SELECT kept.

ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read product_images" ON public.product_images;
CREATE POLICY "Public read product_images"
ON public.product_images
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Store owners insert product_images" ON public.product_images;
CREATE POLICY "Store owners insert product_images"
ON public.product_images
FOR INSERT
TO authenticated
WITH CHECK (
  product_id IN (
    SELECT p.id
    FROM public.products p
    JOIN public.stores s ON s.id = p.store_id
    WHERE s.owner_id = auth.uid()
       OR EXISTS (
         SELECT 1
         FROM public.store_collaborators sc
         WHERE sc.store_id = s.id
           AND sc.user_id = auth.uid()
           AND sc.status = 'active'
           AND (
             sc.permissions IS NULL
             OR 'products' = ANY (sc.permissions)
             OR sc.sub_role = 'products'
           )
       )
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
);

DROP POLICY IF EXISTS "Store owners update product_images" ON public.product_images;
CREATE POLICY "Store owners update product_images"
ON public.product_images
FOR UPDATE
TO authenticated
USING (
  product_id IN (
    SELECT p.id
    FROM public.products p
    JOIN public.stores s ON s.id = p.store_id
    WHERE s.owner_id = auth.uid()
       OR EXISTS (
         SELECT 1
         FROM public.store_collaborators sc
         WHERE sc.store_id = s.id
           AND sc.user_id = auth.uid()
           AND sc.status = 'active'
           AND (
             sc.permissions IS NULL
             OR 'products' = ANY (sc.permissions)
             OR sc.sub_role = 'products'
           )
       )
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
)
WITH CHECK (
  product_id IN (
    SELECT p.id
    FROM public.products p
    JOIN public.stores s ON s.id = p.store_id
    WHERE s.owner_id = auth.uid()
       OR EXISTS (
         SELECT 1
         FROM public.store_collaborators sc
         WHERE sc.store_id = s.id
           AND sc.user_id = auth.uid()
           AND sc.status = 'active'
           AND (
             sc.permissions IS NULL
             OR 'products' = ANY (sc.permissions)
             OR sc.sub_role = 'products'
           )
       )
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
);

DROP POLICY IF EXISTS "Store owners delete product_images" ON public.product_images;
CREATE POLICY "Store owners delete product_images"
ON public.product_images
FOR DELETE
TO authenticated
USING (
  product_id IN (
    SELECT p.id
    FROM public.products p
    JOIN public.stores s ON s.id = p.store_id
    WHERE s.owner_id = auth.uid()
       OR EXISTS (
         SELECT 1
         FROM public.store_collaborators sc
         WHERE sc.store_id = s.id
           AND sc.user_id = auth.uid()
           AND sc.status = 'active'
           AND (
             sc.permissions IS NULL
             OR 'products' = ANY (sc.permissions)
             OR sc.sub_role = 'products'
           )
       )
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
);

CREATE OR REPLACE FUNCTION public.sync_product_gallery(
  p_product_id uuid,
  p_images jsonb DEFAULT '[]'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_store_id uuid;
  v_allowed boolean := false;
  v_count integer := 0;
  v_item jsonb;
  v_url text;
  v_pos integer;
  v_idx integer := 0;
  v_clean jsonb := '[]'::jsonb;
  v_seen text[] := ARRAY[]::text[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_product_id IS NULL THEN
    RAISE EXCEPTION 'product_id_required';
  END IF;

  IF p_images IS NULL OR jsonb_typeof(p_images) <> 'array' THEN
    RAISE EXCEPTION 'images_must_be_json_array';
  END IF;

  IF jsonb_array_length(p_images) > 30 THEN
    RAISE EXCEPTION 'too_many_images';
  END IF;

  SELECT s.owner_id, s.id
    INTO v_owner, v_store_id
  FROM public.products p
  JOIN public.stores s ON s.id = p.store_id
  WHERE p.id = p_product_id;

  IF v_owner IS NULL OR v_store_id IS NULL THEN
    RAISE EXCEPTION 'product_not_found';
  END IF;

  v_allowed := (
    v_owner = v_uid
    OR EXISTS (
      SELECT 1
      FROM public.store_collaborators sc
      WHERE sc.store_id = v_store_id
        AND sc.user_id = v_uid
        AND sc.status = 'active'
        AND (
          sc.permissions IS NULL
          OR 'products' = ANY (sc.permissions)
          OR sc.sub_role = 'products'
        )
    )
    OR public.has_role(v_uid, 'admin'::public.app_role)
    OR public.has_role(v_uid, 'manager'::public.app_role)
  );

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Normalize + validate (dedupe by URL, keep last position)
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_images)
  LOOP
    v_url := nullif(trim(both FROM coalesce(v_item->>'image_url', v_item->>'url', '')), '');
    IF v_url IS NULL THEN
      CONTINUE;
    END IF;

    IF char_length(v_url) > 2048 THEN
      RAISE EXCEPTION 'image_url_too_long';
    END IF;

    IF v_url !~* '^https?://' THEN
      RAISE EXCEPTION 'image_url_invalid_scheme';
    END IF;

    IF position('/storage/v1/object/public/product-media/' in v_url) = 0
       AND position('/storage/v1/object/sign/product-media/' in v_url) = 0 THEN
      -- Grandfather: keep URLs already linked to this product (legacy paths)
      IF NOT EXISTS (
        SELECT 1
        FROM public.product_images pi
        WHERE pi.product_id = p_product_id
          AND pi.image_url = v_url
      ) THEN
        RAISE EXCEPTION 'image_url_not_product_media';
      END IF;
    END IF;

    BEGIN
      v_pos := coalesce((v_item->>'position')::integer, v_idx);
    EXCEPTION WHEN others THEN
      v_pos := v_idx;
    END;

    IF v_url = ANY (v_seen) THEN
      -- Replace prior entry with same URL (update position in rebuilt array)
      SELECT coalesce(jsonb_agg(elem), '[]'::jsonb)
        INTO v_clean
      FROM jsonb_array_elements(v_clean) elem
      WHERE elem->>'image_url' <> v_url;
    ELSE
      v_seen := array_append(v_seen, v_url);
    END IF;

    v_clean := v_clean || jsonb_build_array(
      jsonb_build_object('image_url', v_url, 'position', v_pos)
    );
    v_idx := v_idx + 1;
  END LOOP;

  -- Remove orphans
  DELETE FROM public.product_images pi
  WHERE pi.product_id = p_product_id
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(v_clean) d
      WHERE d->>'image_url' = pi.image_url
    );

  -- Update positions only (does not touch image_url → embeddings preserved)
  UPDATE public.product_images pi
  SET position = (d.elem->>'position')::integer
  FROM jsonb_array_elements(v_clean) AS d(elem)
  WHERE pi.product_id = p_product_id
    AND pi.image_url = d.elem->>'image_url'
    AND pi.position IS DISTINCT FROM (d.elem->>'position')::integer;

  -- Insert new URLs
  INSERT INTO public.product_images (product_id, image_url, position)
  SELECT
    p_product_id,
    d.elem->>'image_url',
    (d.elem->>'position')::integer
  FROM jsonb_array_elements(v_clean) AS d(elem)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.product_images pi
    WHERE pi.product_id = p_product_id
      AND pi.image_url = d.elem->>'image_url'
  );

  SELECT count(*)::integer INTO v_count
  FROM public.product_images
  WHERE product_id = p_product_id;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_product_gallery(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_product_gallery(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_product_gallery(uuid, jsonb) TO service_role;

COMMENT ON FUNCTION public.sync_product_gallery(uuid, jsonb) IS
  'Smart-sync product_images for owner/collaborator(products)/admin/manager; validates product-media URLs; preserves embeddings when URL unchanged.';
