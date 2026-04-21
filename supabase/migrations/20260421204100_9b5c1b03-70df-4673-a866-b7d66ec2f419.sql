-- S6: FK responder_id -> profiles
ALTER TABLE public.product_sourcing_responses
  ALTER COLUMN responder_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_sourcing_responses_responder_fk'
  ) THEN
    ALTER TABLE public.product_sourcing_responses
      ADD CONSTRAINT product_sourcing_responses_responder_fk
      FOREIGN KEY (responder_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- S2: Storage policy admin upload sous responses/
DROP POLICY IF EXISTS sourcing_insert_admin_responses ON storage.objects;
CREATE POLICY sourcing_insert_admin_responses ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'sourcing-images'
  AND (storage.foldername(name))[1] = 'responses'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
);

DROP POLICY IF EXISTS sourcing_update_admin ON storage.objects;
CREATE POLICY sourcing_update_admin ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'sourcing-images'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
);