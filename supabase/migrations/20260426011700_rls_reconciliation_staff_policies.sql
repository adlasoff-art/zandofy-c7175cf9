-- ============================================================
-- MIGRATION CORRECTIVE — Réconciliation RLS Staging→Prod
-- Contexte : héritage du split historique d'un projet unique
--            en deux projets Supabase (staging + prod).
-- Effet :    ajoute (sans casser l'existant) les policies
--            admin/manager manquantes pour la lecture/édition
--            des tables critiques.
-- Sécurité : 100% idempotent, aucune suppression de policy
--            restrictive existante (DROP IF EXISTS uniquement
--            sur les policies que nous (re)créons).
-- À exécuter en STAGING d'abord, puis en PROD.
-- ============================================================

-- Pré-requis : la fonction has_role(uuid, app_role) doit exister.
-- (Elle est créée par la migration 20260225202951_*.sql)

-- ─────────── ORDER_ITEMS ───────────
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read all order items" ON public.order_items;
CREATE POLICY "Staff read all order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
);

DROP POLICY IF EXISTS "Staff update all order items" ON public.order_items;
CREATE POLICY "Staff update all order items"
ON public.order_items
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
);

DROP POLICY IF EXISTS "Staff delete all order items" ON public.order_items;
CREATE POLICY "Staff delete all order items"
ON public.order_items
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
);

-- ─────────── ORDERS ───────────
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read all orders" ON public.orders;
CREATE POLICY "Staff read all orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
);

DROP POLICY IF EXISTS "Staff update all orders" ON public.orders;
CREATE POLICY "Staff update all orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
);

DROP POLICY IF EXISTS "Staff delete all orders" ON public.orders;
CREATE POLICY "Staff delete all orders"
ON public.orders
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
);

-- ─────────── PAYMENT_TRANSACTIONS ───────────
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read all payment transactions" ON public.payment_transactions;
CREATE POLICY "Staff read all payment transactions"
ON public.payment_transactions
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
);

DROP POLICY IF EXISTS "Staff update payment transactions" ON public.payment_transactions;
CREATE POLICY "Staff update payment transactions"
ON public.payment_transactions
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
);

-- ─────────── REVIEWS (modération admin déjà appliquée mais on sécurise) ───────────
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage reviews" ON public.reviews;
CREATE POLICY "Staff manage reviews"
ON public.reviews
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  OR public.has_role(auth.uid(), 'manager'::public.app_role)
);

-- ─────────── ORDER_STATUS_HISTORY ───────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='order_status_history') THEN
    EXECUTE 'ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Staff read all order status history" ON public.order_status_history';
    EXECUTE $POL$
      CREATE POLICY "Staff read all order status history"
      ON public.order_status_history
      FOR SELECT
      TO authenticated
      USING (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'manager'::public.app_role)
      )
    $POL$;
  END IF;
END $$;

-- ─────────── SHIPMENTS ───────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='shipments') THEN
    EXECUTE 'ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Staff read all shipments" ON public.shipments';
    EXECUTE $POL$
      CREATE POLICY "Staff read all shipments"
      ON public.shipments
      FOR SELECT
      TO authenticated
      USING (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'manager'::public.app_role)
      )
    $POL$;
    EXECUTE 'DROP POLICY IF EXISTS "Staff update all shipments" ON public.shipments';
    EXECUTE $POL$
      CREATE POLICY "Staff update all shipments"
      ON public.shipments
      FOR UPDATE
      TO authenticated
      USING (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'manager'::public.app_role)
      )
      WITH CHECK (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'manager'::public.app_role)
      )
    $POL$;
  END IF;
END $$;

-- ─────────── VÉRIFICATION POST-MIGRATION ───────────
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname='public'
  AND policyname LIKE 'Staff %'
ORDER BY tablename, policyname;
