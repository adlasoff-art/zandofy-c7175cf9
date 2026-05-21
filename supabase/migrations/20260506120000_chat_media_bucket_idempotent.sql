-- Lot 1.2 — chat-media bucket & RLS (idempotent)
-- Recrée le bucket privé `chat-media` et ses policies si manquants.
-- À rejouer sans risque sur staging et prod.

-- 1) Bucket privé
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- 2) Policies (drop+recreate pour garantir l'état)
DROP POLICY IF EXISTS "Authenticated users can upload chat media" ON storage.objects;
CREATE POLICY "Authenticated users can upload chat media"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chat-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Participants read chat media" ON storage.objects;
CREATE POLICY "Participants read chat media"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND (
      -- L'uploader peut toujours relire ses fichiers
      (storage.foldername(name))[1] = auth.uid()::text
      -- Ou un participant d'une conversation contenant ce path peut le lire
      OR EXISTS (
        SELECT 1
        FROM public.messages m
        JOIN public.conversations c ON c.id = m.conversation_id
        LEFT JOIN public.stores s ON s.id = c.store_id
        WHERE position(storage.objects.name in m.content) > 0
          AND (c.user_id = auth.uid() OR s.owner_id = auth.uid())
      )
      -- Admins
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );

DROP POLICY IF EXISTS "Users can delete own chat media" ON storage.objects;
CREATE POLICY "Users can delete own chat media"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'chat-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );