-- =============================================================
-- Product Sourcing Requests — Lot "Trouvez-moi ce produit"
-- =============================================================

-- 1) Tables ----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.product_sourcing_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_name text CHECK (product_name IS NULL OR char_length(product_name) <= 200),
  note text CHECK (note IS NULL OR char_length(note) <= 500),
  images text[] NOT NULL DEFAULT ARRAY[]::text[],
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','answered','closed')),
  email_digest_sent boolean NOT NULL DEFAULT false,
  client_seen_response boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sourcing_max_two_images CHECK (array_length(images, 1) IS NULL OR array_length(images, 1) <= 2)
);

CREATE INDEX IF NOT EXISTS idx_psr_user ON public.product_sourcing_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_psr_status ON public.product_sourcing_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_psr_digest ON public.product_sourcing_requests(email_digest_sent, created_at DESC);

CREATE TABLE IF NOT EXISTS public.product_sourcing_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE REFERENCES public.product_sourcing_requests(id) ON DELETE CASCADE,
  responder_id uuid NOT NULL,
  product_name text NOT NULL CHECK (char_length(product_name) BETWEEN 1 AND 200),
  description text CHECK (description IS NULL OR char_length(description) <= 2000),
  price numeric(12,2) CHECK (price IS NULL OR price >= 0),
  currency text NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD','EUR','XAF','CDF','NGN','GBP','CNY')),
  min_quantity integer CHECK (min_quantity IS NULL OR min_quantity >= 1),
  colors text[] NOT NULL DEFAULT ARRAY[]::text[],
  image_url text,
  notify_email_sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_psresp_request ON public.product_sourcing_responses(request_id);

-- 2) updated_at triggers --------------------------------------

DROP TRIGGER IF EXISTS trg_psr_updated_at ON public.product_sourcing_requests;
CREATE TRIGGER trg_psr_updated_at
BEFORE UPDATE ON public.product_sourcing_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_psresp_updated_at ON public.product_sourcing_responses;
CREATE TRIGGER trg_psresp_updated_at
BEFORE UPDATE ON public.product_sourcing_responses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Rate-limit trigger (5 / day / user) ----------------------

CREATE OR REPLACE FUNCTION public.enforce_sourcing_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.product_sourcing_requests
  WHERE user_id = NEW.user_id
    AND created_at >= date_trunc('day', now());

  IF v_count >= 5 THEN
    RAISE EXCEPTION 'sourcing_rate_limit_exceeded'
      USING HINT = 'Maximum 5 sourcing requests per day';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_psr_rate_limit ON public.product_sourcing_requests;
CREATE TRIGGER trg_psr_rate_limit
BEFORE INSERT ON public.product_sourcing_requests
FOR EACH ROW EXECUTE FUNCTION public.enforce_sourcing_rate_limit();

-- 4) Notify admins on new request -----------------------------

CREATE OR REPLACE FUNCTION public.notify_admins_sourcing_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin RECORD;
  v_label text;
BEGIN
  v_label := COALESCE(NULLIF(NEW.product_name, ''), 'Produit sans nom');
  FOR v_admin IN
    SELECT user_id FROM public.user_roles WHERE role IN ('admin','manager')
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      v_admin.user_id,
      'system',
      'Nouvelle demande de sourcing',
      'Un client recherche : ' || v_label,
      '/admin/sourcing'
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_psr_notify_admins ON public.product_sourcing_requests;
CREATE TRIGGER trg_psr_notify_admins
AFTER INSERT ON public.product_sourcing_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_sourcing_request();

-- 5) Notify client when response is created -------------------

CREATE OR REPLACE FUNCTION public.notify_client_sourcing_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id FROM public.product_sourcing_requests WHERE id = NEW.request_id;
  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      v_user_id,
      'system',
      'Votre produit est prêt',
      'Nous avons trouvé : ' || NEW.product_name,
      '/sourcing'
    );

    UPDATE public.product_sourcing_requests
    SET status = 'answered', client_seen_response = false, updated_at = now()
    WHERE id = NEW.request_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_psresp_notify_client ON public.product_sourcing_responses;
CREATE TRIGGER trg_psresp_notify_client
AFTER INSERT ON public.product_sourcing_responses
FOR EACH ROW EXECUTE FUNCTION public.notify_client_sourcing_response();

-- 6) Cleanup function (admin-only via Edge Function) ----------

CREATE OR REPLACE FUNCTION public.cleanup_sourcing_requests(p_older_than_days integer)
RETURNS TABLE(deleted_count integer, image_paths text[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff timestamptz;
  v_paths text[] := ARRAY[]::text[];
  v_count int := 0;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager')) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_older_than_days IS NULL OR p_older_than_days < 0 THEN
    RAISE EXCEPTION 'invalid_days';
  END IF;

  v_cutoff := now() - (p_older_than_days || ' days')::interval;

  -- Collect image paths for the Edge Function to remove from storage
  SELECT COALESCE(array_agg(img), ARRAY[]::text[])
  INTO v_paths
  FROM (
    SELECT unnest(images) AS img
    FROM public.product_sourcing_requests
    WHERE created_at < v_cutoff
  ) sub
  WHERE img IS NOT NULL AND img <> '';

  -- Add response images
  SELECT v_paths || COALESCE(array_agg(image_url), ARRAY[]::text[])
  INTO v_paths
  FROM public.product_sourcing_responses r
  JOIN public.product_sourcing_requests q ON q.id = r.request_id
  WHERE q.created_at < v_cutoff AND r.image_url IS NOT NULL AND r.image_url <> '';

  WITH del AS (
    DELETE FROM public.product_sourcing_requests
    WHERE created_at < v_cutoff
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM del;

  deleted_count := v_count;
  image_paths := v_paths;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_sourcing_requests(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.cleanup_sourcing_requests(integer) TO authenticated;

-- 7) RLS ------------------------------------------------------

ALTER TABLE public.product_sourcing_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_sourcing_responses ENABLE ROW LEVEL SECURITY;

-- Requests: client = own; admin/manager = all
DROP POLICY IF EXISTS psr_select_own ON public.product_sourcing_requests;
CREATE POLICY psr_select_own ON public.product_sourcing_requests
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
);

DROP POLICY IF EXISTS psr_insert_own ON public.product_sourcing_requests;
CREATE POLICY psr_insert_own ON public.product_sourcing_requests
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS psr_update_own_seen ON public.product_sourcing_requests;
CREATE POLICY psr_update_own_seen ON public.product_sourcing_requests
FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
)
WITH CHECK (
  user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
);

DROP POLICY IF EXISTS psr_delete_admin ON public.product_sourcing_requests;
CREATE POLICY psr_delete_admin ON public.product_sourcing_requests
FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
);

-- Responses: client SELECT own response; admin/manager all
DROP POLICY IF EXISTS psresp_select ON public.product_sourcing_responses;
CREATE POLICY psresp_select ON public.product_sourcing_responses
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.product_sourcing_requests q
    WHERE q.id = request_id AND q.user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
);

DROP POLICY IF EXISTS psresp_write_admin ON public.product_sourcing_responses;
CREATE POLICY psresp_write_admin ON public.product_sourcing_responses
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
);

-- 8) Storage bucket -------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('sourcing-images', 'sourcing-images', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DROP POLICY IF EXISTS sourcing_insert_own ON storage.objects;
CREATE POLICY sourcing_insert_own ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'sourcing-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS sourcing_select_own_or_admin ON storage.objects;
CREATE POLICY sourcing_select_own_or_admin ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'sourcing-images'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  )
);

DROP POLICY IF EXISTS sourcing_delete_admin ON storage.objects;
CREATE POLICY sourcing_delete_admin ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'sourcing-images'
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  )
);
