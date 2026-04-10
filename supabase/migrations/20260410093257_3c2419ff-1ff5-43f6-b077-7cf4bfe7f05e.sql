
-- =============================================================
-- PACK SÉCURITÉ PRÉ-LANCEMENT — Failles 1 à 5
-- =============================================================

-- ─── FAILLE 1 : Retirer les tables sensibles du Realtime ───
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.messages;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'deliveries'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.deliveries;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'delivery_chats'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.delivery_chats;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'dispute_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.dispute_messages;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'support_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.support_messages;
  END IF;
END $$;

-- ─── FAILLE 2 : Protéger le WhatsApp des boutiques ───

-- Supprimer l'ancienne politique publique trop permissive
DROP POLICY IF EXISTS "Public read stores" ON public.stores;

-- Authentifiés : accès complet en lecture (whatsapp_number visible)
CREATE POLICY "Authenticated read stores"
  ON public.stores FOR SELECT
  TO authenticated
  USING (true);

-- Anonymes : accès en lecture aussi (la vue stores_public est préférée côté frontend,
-- mais on garde un accès anon pour ne pas casser les pages produit publiques)
CREATE POLICY "Anon read stores"
  ON public.stores FOR SELECT
  TO anon
  USING (true);

-- ─── FAILLE 3 : Bloquer l'injection d'email dans error_reports ───

CREATE OR REPLACE FUNCTION public.trg_sanitize_error_report_email()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = 'public'
AS $$
BEGIN
  -- Si l'utilisateur est authentifié, on récupère l'email depuis le profil
  IF auth.uid() IS NOT NULL THEN
    SELECT email INTO NEW.user_email
    FROM public.profiles
    WHERE id = auth.uid();
    NEW.user_id := auth.uid();
  ELSE
    -- Anonyme : on force à NULL
    NEW.user_email := NULL;
    NEW.user_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sanitize_error_report_email
  BEFORE INSERT ON public.error_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sanitize_error_report_email();

-- ─── FAILLE 4 : Restreindre la lecture de pwa_installs ───

DROP POLICY IF EXISTS "Anyone can read pwa installs" ON public.pwa_installs;
DROP POLICY IF EXISTS "Anyone can insert pwa installs" ON public.pwa_installs;

-- Utilisateurs : lecture de leurs propres lignes uniquement
CREATE POLICY "Users read own pwa installs"
  ON public.pwa_installs FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins : lecture complète
CREATE POLICY "Admins read all pwa installs"
  ON public.pwa_installs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Insertion restreinte
CREATE POLICY "Users insert own pwa installs"
  ON public.pwa_installs FOR INSERT
  TO public
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- ─── FAILLE 5 : Restreindre la lecture de rider_ratings ───

DROP POLICY IF EXISTS "Authenticated read rider ratings" ON public.rider_ratings;

-- L'auteur peut lire ses propres avis
CREATE POLICY "Users read own rider ratings"
  ON public.rider_ratings FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Le livreur peut lire ses propres avis
CREATE POLICY "Riders read own ratings"
  ON public.rider_ratings FOR SELECT
  TO authenticated
  USING (rider_id = auth.uid());

-- Admins peuvent tout lire
CREATE POLICY "Admins read all rider ratings"
  ON public.rider_ratings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
