-- ===========================================================================
-- LOT 1 — Finalisation : table forwarders (parente) + RLS + triggers
-- ===========================================================================

-- 1. Table forwarders (parente — manquante en base, bloque l'UI admin)
CREATE TABLE IF NOT EXISTS public.forwarders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  description text,
  contact_email text,
  contact_phone text,
  website_url text,
  is_active boolean NOT NULL DEFAULT true,
  linked_transporter_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forwarders_active ON public.forwarders(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_forwarders_slug ON public.forwarders(slug);

-- 2. Trigger updated_at
DROP TRIGGER IF EXISTS trg_forwarders_updated_at ON public.forwarders;
CREATE TRIGGER trg_forwarders_updated_at
  BEFORE UPDATE ON public.forwarders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. RLS — sécurité
ALTER TABLE public.forwarders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "forwarders_public_read_active" ON public.forwarders;
CREATE POLICY "forwarders_public_read_active"
  ON public.forwarders FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "forwarders_admin_read_all" ON public.forwarders;
CREATE POLICY "forwarders_admin_read_all"
  ON public.forwarders FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "forwarders_admin_insert" ON public.forwarders;
CREATE POLICY "forwarders_admin_insert"
  ON public.forwarders FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "forwarders_admin_update" ON public.forwarders;
CREATE POLICY "forwarders_admin_update"
  ON public.forwarders FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "forwarders_admin_delete" ON public.forwarders;
CREATE POLICY "forwarders_admin_delete"
  ON public.forwarders FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. FK forwarder_pricing_profiles.forwarder_id → forwarders.id (si manquante)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fpp_forwarder_fk' AND conrelid = 'public.forwarder_pricing_profiles'::regclass
  ) THEN
    ALTER TABLE public.forwarder_pricing_profiles
      ADD CONSTRAINT fpp_forwarder_fk
      FOREIGN KEY (forwarder_id) REFERENCES public.forwarders(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 5. RLS sur forwarder_surcharges (créée au lot précédent, vérifions les policies)
ALTER TABLE public.forwarder_surcharges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "forwarder_surcharges_public_read" ON public.forwarder_surcharges;
CREATE POLICY "forwarder_surcharges_public_read"
  ON public.forwarder_surcharges FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "forwarder_surcharges_admin_write" ON public.forwarder_surcharges;
CREATE POLICY "forwarder_surcharges_admin_write"
  ON public.forwarder_surcharges FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 6. RLS sur provinces (créée au lot précédent)
ALTER TABLE public.provinces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "provinces_public_read" ON public.provinces;
CREATE POLICY "provinces_public_read"
  ON public.provinces FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "provinces_admin_write" ON public.provinces;
CREATE POLICY "provinces_admin_write"
  ON public.provinces FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 7. Seed transitaires démo (idempotent)
INSERT INTO public.forwarders (name, slug, description, is_active, sort_order) VALUES
  ('Zandofy Express',  'zandofy-express',  'Service interne Zandofy — aérien & maritime depuis Chine/Turquie/Dubaï', true, 1),
  ('Sky Cargo Africa', 'sky-cargo-africa', 'Fret aérien express vers la RDC',                                        true, 2),
  ('Ocean Link',       'ocean-link',       'Fret maritime conteneurs FCL/LCL',                                       true, 3)
ON CONFLICT (slug) DO NOTHING;
