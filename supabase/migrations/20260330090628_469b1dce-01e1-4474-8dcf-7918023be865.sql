
-- 1. Contrainte unique sur cart_items pour empêcher les doublons
CREATE UNIQUE INDEX IF NOT EXISTS uq_cart_items_variant
  ON public.cart_items (user_id, product_id, COALESCE(color, ''), COALESCE(size, ''));

-- 2. Colonne selected sur cart_items pour le checkout sélectif
ALTER TABLE public.cart_items ADD COLUMN IF NOT EXISTS selected boolean NOT NULL DEFAULT true;

-- 3. Champs Commune et Quartier sur saved_addresses
ALTER TABLE public.saved_addresses ADD COLUMN IF NOT EXISTS commune text;
ALTER TABLE public.saved_addresses ADD COLUMN IF NOT EXISTS quartier text;

-- 4. Champs Commune et Quartier sur orders (shipping)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_commune text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS shipping_quartier text;

-- 5. Table communes (admin-gérée)
CREATE TABLE IF NOT EXISTS public.communes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city text NOT NULL,
  country_code text NOT NULL DEFAULT 'CD',
  name text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(city, name, country_code)
);
ALTER TABLE public.communes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Anyone can read communes" ON public.communes;
  CREATE POLICY "Anyone can read communes" ON public.communes FOR SELECT USING (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins manage communes" ON public.communes;
  CREATE POLICY "Admins manage communes" ON public.communes FOR ALL
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- 6. Table quartiers (admin-gérée, liée à commune)
CREATE TABLE IF NOT EXISTS public.quartiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commune_id uuid NOT NULL REFERENCES public.communes(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean DEFAULT true,
  is_restricted boolean DEFAULT false,
  restriction_reason text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(commune_id, name)
);
ALTER TABLE public.quartiers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Anyone can read quartiers" ON public.quartiers;
  CREATE POLICY "Anyone can read quartiers" ON public.quartiers FOR SELECT USING (true);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Admins manage quartiers" ON public.quartiers;
  CREATE POLICY "Admins manage quartiers" ON public.quartiers FOR ALL
    USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
