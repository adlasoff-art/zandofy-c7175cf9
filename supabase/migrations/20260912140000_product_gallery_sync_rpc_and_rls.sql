-- Purpose: Fix vendor gallery (cover + complementary photos) disappearing after save.
-- Tables: product_images (+ RPC sync_product_gallery)
-- Why: Client multi-step insert/select can "succeed" while RLS/RETURNING leaves 0 rows;
--      vendors then see empty thumbnails and a disabled/hidden Submit button.
-- Rollback: DROP FUNCTION public.sync_product_gallery(uuid, jsonb);
--           re-apply prior policies manually if needed (policies below are additive/idempotent).
-- Risk (~4000+ users): Low — additive RLS + SECURITY DEFINER RPC scoped to store owner/admin.
--                      Public SELECT of product_images remains public. No DROP TABLE/COLUMN.

-- ---------------------------------------------------------------------------
-- 1) RLS — ensure public can read catalog images; owners can manage theirs
-- ---------------------------------------------------------------------------
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
  )
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
);

-- ---------------------------------------------------------------------------
-- 2) Atomic gallery sync (owner-scoped SECURITY DEFINER)
-- p_images: JSON array of { "image_url": string, "position": number }
-- Returns number of rows written.
-- ---------------------------------------------------------------------------
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
  v_count integer := 0;
  v_item jsonb;
  v_url text;
  v_pos integer;
  v_idx integer := 0;
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

  SELECT s.owner_id INTO v_owner
  FROM public.products p
  JOIN public.stores s ON s.id = p.store_id
  WHERE p.id = p_product_id;

  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'product_not_found';
  END IF;

  IF v_owner <> v_uid
     AND NOT public.has_role(v_uid, 'admin'::public.app_role)
     AND NOT public.has_role(v_uid, 'manager'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Atomic replace inside one transaction (function body).
  DELETE FROM public.product_images
  WHERE product_id = p_product_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_images)
  LOOP
    v_url := nullif(trim(both FROM coalesce(v_item->>'image_url', v_item->>'url', '')), '');
    IF v_url IS NULL THEN
      CONTINUE;
    END IF;

    BEGIN
      v_pos := coalesce((v_item->>'position')::integer, v_idx);
    EXCEPTION WHEN others THEN
      v_pos := v_idx;
    END;

    INSERT INTO public.product_images (product_id, image_url, position)
    VALUES (p_product_id, v_url, v_pos);

    v_count := v_count + 1;
    v_idx := v_idx + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_product_gallery(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_product_gallery(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_product_gallery(uuid, jsonb) TO service_role;

COMMENT ON FUNCTION public.sync_product_gallery(uuid, jsonb) IS
  'Atomically replace product_images gallery for a product; allowed for store owner, admin, manager.';
