-- Product image embeddings for visual search (pgvector, primary catalog images)

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS embedding vector(512),
  ADD COLUMN IF NOT EXISTS embedding_model text,
  ADD COLUMN IF NOT EXISTS embedded_at timestamptz,
  ADD COLUMN IF NOT EXISTS embedding_status text DEFAULT 'pending'
    CHECK (embedding_status IN ('pending', 'ready', 'failed', 'skipped'));

CREATE INDEX IF NOT EXISTS product_images_embedding_hnsw
  ON public.product_images
  USING hnsw (embedding vector_cosine_ops)
  WHERE embedding IS NOT NULL;

UPDATE public.product_images pi
SET embedding_status = 'pending'
FROM (
  SELECT DISTINCT ON (product_id) id
  FROM public.product_images
  ORDER BY product_id, position ASC NULLS LAST, id ASC
) primary_img
WHERE pi.id = primary_img.id
  AND pi.embedding IS NULL
  AND (pi.embedding_status IS NULL OR pi.embedding_status = 'skipped');

UPDATE public.product_images pi
SET embedding_status = 'skipped'
WHERE pi.embedding IS NULL
  AND pi.id NOT IN (
    SELECT DISTINCT ON (product_id) id
    FROM public.product_images
    ORDER BY product_id, position ASC NULLS LAST, id ASC
  );

CREATE OR REPLACE FUNCTION public.match_products_by_image(
  query_embedding vector(512),
  match_threshold float DEFAULT 0.85,
  match_count int DEFAULT 20
)
RETURNS TABLE (product_id uuid, image_id uuid, similarity float)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT
    pi.product_id,
    pi.id AS image_id,
    1 - (pi.embedding <=> query_embedding) AS similarity
  FROM public.product_images pi
  INNER JOIN public.products p ON p.id = pi.product_id
  WHERE pi.embedding IS NOT NULL
    AND pi.embedding_status = 'ready'
    AND p.publish_status = 'published'
    AND 1 - (pi.embedding <=> query_embedding) >= match_threshold
  ORDER BY pi.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_products_by_image(vector(512), float, int) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.reset_product_image_embedding_on_url_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.image_url IS DISTINCT FROM NEW.image_url THEN
    NEW.embedding := NULL;
    NEW.embedded_at := NULL;
    NEW.embedding_model := NULL;
    NEW.embedding_status := 'pending';
  ELSIF TG_OP = 'INSERT' THEN
    IF NEW.embedding_status IS NULL THEN
      NEW.embedding_status := 'pending';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_product_images_embedding_reset ON public.product_images;
CREATE TRIGGER trg_product_images_embedding_reset
  BEFORE INSERT OR UPDATE OF image_url ON public.product_images
  FOR EACH ROW
  EXECUTE FUNCTION public.reset_product_image_embedding_on_url_change();

CREATE OR REPLACE FUNCTION public.queue_product_embedding_on_publish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_image_id uuid;
  v_supabase_url text;
  v_service_key text;
  v_function_url text;
BEGIN
  IF NEW.publish_status = 'published'
     AND (TG_OP = 'INSERT' OR OLD.publish_status IS DISTINCT FROM NEW.publish_status) THEN
    SELECT id INTO v_image_id
    FROM public.product_images
    WHERE product_id = NEW.id
    ORDER BY position ASC NULLS LAST, id ASC
    LIMIT 1;

    IF v_image_id IS NULL THEN
      RETURN NEW;
    END IF;

    UPDATE public.product_images
    SET embedding_status = 'pending',
        embedding = NULL,
        embedded_at = NULL,
        embedding_model = NULL
    WHERE id = v_image_id;

    BEGIN
      SELECT decrypted_secret INTO v_supabase_url FROM vault.decrypted_secrets WHERE name = 'project_url' LIMIT 1;
      SELECT decrypted_secret INTO v_service_key FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      v_supabase_url := NULL;
      v_service_key := NULL;
    END;

    IF v_supabase_url IS NOT NULL AND v_service_key IS NOT NULL THEN
      v_function_url := rtrim(v_supabase_url, '/') || '/functions/v1/index-product-image';
      BEGIN
        PERFORM extensions.http_post(
          url := v_function_url,
          body := jsonb_build_object('product_image_id', v_image_id),
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key
          )
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_queue_embedding ON public.products;
CREATE TRIGGER trg_products_queue_embedding
  AFTER INSERT OR UPDATE OF publish_status ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_product_embedding_on_publish();
