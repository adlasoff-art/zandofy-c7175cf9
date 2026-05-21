-- Tables principales
CREATE TABLE IF NOT EXISTS public.delivery_operators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  company_name text NOT NULL,
  legal_name text,
  registration_number text,
  tax_id text,
  contact_email text NOT NULL,
  contact_phone text NOT NULL,
  headquarters_country text NOT NULL DEFAULT 'CD',
  headquarters_city text NOT NULL,
  headquarters_address text,
  logo_url text,
  vehicle_types jsonb NOT NULL DEFAULT '[]'::jsonb,
  declared_riders_count int NOT NULL DEFAULT 1 CHECK (declared_riders_count BETWEEN 1 AND 30),
  max_riders int NOT NULL DEFAULT 1 CHECK (max_riders BETWEEN 1 AND 30),
  platform_commission_pct numeric(5,2) NOT NULL DEFAULT 25.00 CHECK (platform_commission_pct BETWEEN 0 AND 100),
  is_platform_owned boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','suspended','rejected')),
  rating_avg numeric(3,2),
  total_deliveries int NOT NULL DEFAULT 0,
  rejection_reason text,
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_delivery_operators_owner ON public.delivery_operators(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_operators_status ON public.delivery_operators(status, is_active);

CREATE TABLE IF NOT EXISTS public.delivery_operator_cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.delivery_operators(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  city text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (operator_id, country_code, city)
);
CREATE INDEX IF NOT EXISTS idx_operator_cities_lookup ON public.delivery_operator_cities(country_code, city, is_active);

CREATE TABLE IF NOT EXISTS public.delivery_operator_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.delivery_operators(id) ON DELETE CASCADE,
  country_code text NOT NULL,
  city text NOT NULL,
  zone_name text NOT NULL,
  commune text,
  quartier text,
  base_price numeric(10,2) NOT NULL CHECK (base_price >= 0),
  surcharge numeric(10,2) NOT NULL DEFAULT 0 CHECK (surcharge >= 0),
  price_per_km numeric(10,2) NOT NULL DEFAULT 0 CHECK (price_per_km >= 0),
  currency text NOT NULL DEFAULT 'USD',
  estimated_minutes int NOT NULL DEFAULT 60,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_operator_rates_lookup ON public.delivery_operator_rates(operator_id, country_code, city, is_active);

CREATE TABLE IF NOT EXISTS public.delivery_operator_riders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.delivery_operators(id) ON DELETE CASCADE,
  rider_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_type text NOT NULL DEFAULT 'moto',
  vehicle_plate text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','kyc_required','active','suspended','revoked')),
  invited_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  revoked_at timestamptz,
  UNIQUE (rider_user_id)
);
CREATE INDEX IF NOT EXISTS idx_operator_riders_op ON public.delivery_operator_riders(operator_id, status);

CREATE TABLE IF NOT EXISTS public.operator_quota_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.delivery_operators(id) ON DELETE CASCADE,
  current_quota int NOT NULL,
  requested_quota int NOT NULL CHECK (requested_quota BETWEEN 1 AND 30),
  justification text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quota_requests_op ON public.operator_quota_requests(operator_id, status);

CREATE TABLE IF NOT EXISTS public.operator_commission_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id uuid NOT NULL REFERENCES public.delivery_operators(id) ON DELETE RESTRICT,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  rider_user_id uuid REFERENCES auth.users(id),
  delivery_fee numeric(10,2) NOT NULL,
  platform_commission_pct numeric(5,2) NOT NULL,
  platform_commission_amount numeric(10,2) NOT NULL,
  operator_net_amount numeric(10,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  payout_status text NOT NULL DEFAULT 'pending' CHECK (payout_status IN ('pending','scheduled','paid','disputed')),
  paid_at timestamptz,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id)
);
CREATE INDEX IF NOT EXISTS idx_commission_ledger_op ON public.operator_commission_ledger(operator_id, payout_status);

ALTER TABLE public.orders 
  ADD COLUMN IF NOT EXISTS delivery_operator_id uuid REFERENCES public.delivery_operators(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_orders_delivery_operator ON public.orders(delivery_operator_id);

-- Security definer helpers
CREATE OR REPLACE FUNCTION public.is_operator_owner(_uid uuid, _operator_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.delivery_operators WHERE id=_operator_id AND owner_user_id=_uid)
$$;

CREATE OR REPLACE FUNCTION public.is_operator_rider(_uid uuid, _operator_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.delivery_operator_riders WHERE rider_user_id=_uid AND operator_id=_operator_id AND status='active')
$$;

CREATE OR REPLACE FUNCTION public.user_owns_any_operator(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.delivery_operators WHERE owner_user_id=_uid)
$$;

-- Triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_delivery_operators_updated_at ON public.delivery_operators;
CREATE TRIGGER trg_delivery_operators_updated_at
  BEFORE UPDATE ON public.delivery_operators
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_operator_rates_updated_at ON public.delivery_operator_rates;
CREATE TRIGGER trg_operator_rates_updated_at
  BEFORE UPDATE ON public.delivery_operator_rates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.lock_operator_sensitive_fields()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.role()='service_role' THEN RETURN NEW; END IF;
  IF has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager') THEN RETURN NEW; END IF;
  NEW.status                    := OLD.status;
  NEW.is_active                 := OLD.is_active;
  NEW.is_platform_owned         := OLD.is_platform_owned;
  NEW.platform_commission_pct   := OLD.platform_commission_pct;
  NEW.max_riders                := OLD.max_riders;
  NEW.approved_at               := OLD.approved_at;
  NEW.approved_by               := OLD.approved_by;
  NEW.rejection_reason          := OLD.rejection_reason;
  NEW.total_deliveries          := OLD.total_deliveries;
  NEW.rating_avg                := OLD.rating_avg;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_lock_operator_sensitive_fields ON public.delivery_operators;
CREATE TRIGGER trg_lock_operator_sensitive_fields
  BEFORE UPDATE ON public.delivery_operators
  FOR EACH ROW EXECUTE FUNCTION public.lock_operator_sensitive_fields();

CREATE OR REPLACE FUNCTION public.enforce_max_riders()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE current_active_count int; quota int;
BEGIN
  IF NEW.status NOT IN ('active','pending','kyc_required') THEN RETURN NEW; END IF;
  SELECT max_riders INTO quota FROM public.delivery_operators WHERE id=NEW.operator_id;
  SELECT COUNT(*) INTO current_active_count FROM public.delivery_operator_riders
    WHERE operator_id=NEW.operator_id AND status IN ('active','pending','kyc_required')
      AND (TG_OP='INSERT' OR id<>NEW.id);
  IF current_active_count >= quota THEN
    RAISE EXCEPTION 'Quota riders atteint (%). Demandez une augmentation.', quota USING ERRCODE='check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_max_riders ON public.delivery_operator_riders;
CREATE TRIGGER trg_enforce_max_riders
  BEFORE INSERT OR UPDATE OF status, operator_id ON public.delivery_operator_riders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_max_riders();

CREATE OR REPLACE FUNCTION public.record_operator_commission()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE op_commission_pct numeric(5,2); fee numeric(10,2);
BEGIN
  IF NEW.status='delivered' AND OLD.status IS DISTINCT FROM 'delivered'
     AND NEW.delivery_operator_id IS NOT NULL THEN
    SELECT platform_commission_pct INTO op_commission_pct FROM public.delivery_operators WHERE id=NEW.delivery_operator_id;
    fee := COALESCE(NEW.last_mile_fee, 0);
    IF fee > 0 THEN
      INSERT INTO public.operator_commission_ledger
        (operator_id, order_id, rider_user_id, delivery_fee, platform_commission_pct,
         platform_commission_amount, operator_net_amount, currency)
      VALUES
        (NEW.delivery_operator_id, NEW.id, NEW.assigned_rider_id, fee, op_commission_pct,
         ROUND(fee * op_commission_pct / 100, 2),
         ROUND(fee - (fee * op_commission_pct / 100), 2), 'USD')
      ON CONFLICT (order_id) DO NOTHING;
      UPDATE public.delivery_operators SET total_deliveries = total_deliveries + 1 WHERE id=NEW.delivery_operator_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_record_operator_commission ON public.orders;
CREATE TRIGGER trg_record_operator_commission
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.record_operator_commission();

CREATE OR REPLACE FUNCTION public.protect_commission_ledger()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF auth.role()='service_role' THEN RETURN NEW; END IF;
  IF has_role(auth.uid(),'admin') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Le ledger commission est immuable';
END $$;

DROP TRIGGER IF EXISTS trg_protect_commission_ledger_upd ON public.operator_commission_ledger;
CREATE TRIGGER trg_protect_commission_ledger_upd
  BEFORE UPDATE OR DELETE ON public.operator_commission_ledger
  FOR EACH ROW EXECUTE FUNCTION public.protect_commission_ledger();

-- RLS
ALTER TABLE public.delivery_operators           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_operator_cities     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_operator_rates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_operator_riders     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_quota_requests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_commission_ledger   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "operators_select_owner" ON public.delivery_operators;
DROP POLICY IF EXISTS "operators_select_staff" ON public.delivery_operators;
DROP POLICY IF EXISTS "operators_insert_self"  ON public.delivery_operators;
DROP POLICY IF EXISTS "operators_update_owner" ON public.delivery_operators;
DROP POLICY IF EXISTS "operators_update_staff" ON public.delivery_operators;
DROP POLICY IF EXISTS "operators_delete_staff" ON public.delivery_operators;

CREATE POLICY "operators_select_owner" ON public.delivery_operators FOR SELECT TO authenticated USING (owner_user_id=auth.uid());
CREATE POLICY "operators_select_staff" ON public.delivery_operators FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));
CREATE POLICY "operators_insert_self"  ON public.delivery_operators FOR INSERT TO authenticated
  WITH CHECK (owner_user_id=auth.uid() AND status='pending' AND is_active=false AND is_platform_owned=false);
CREATE POLICY "operators_update_owner" ON public.delivery_operators FOR UPDATE TO authenticated USING (owner_user_id=auth.uid());
CREATE POLICY "operators_update_staff" ON public.delivery_operators FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));
CREATE POLICY "operators_delete_staff" ON public.delivery_operators FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "op_cities_select_public" ON public.delivery_operator_cities;
DROP POLICY IF EXISTS "op_cities_manage_owner"  ON public.delivery_operator_cities;
DROP POLICY IF EXISTS "op_cities_manage_staff"  ON public.delivery_operator_cities;

CREATE POLICY "op_cities_select_public" ON public.delivery_operator_cities FOR SELECT TO anon, authenticated USING (is_active=true);
CREATE POLICY "op_cities_manage_owner" ON public.delivery_operator_cities FOR ALL TO authenticated
  USING (is_operator_owner(auth.uid(),operator_id)) WITH CHECK (is_operator_owner(auth.uid(),operator_id));
CREATE POLICY "op_cities_manage_staff" ON public.delivery_operator_cities FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));

DROP POLICY IF EXISTS "op_rates_select_public" ON public.delivery_operator_rates;
DROP POLICY IF EXISTS "op_rates_manage_owner"  ON public.delivery_operator_rates;
DROP POLICY IF EXISTS "op_rates_manage_staff"  ON public.delivery_operator_rates;

CREATE POLICY "op_rates_select_public" ON public.delivery_operator_rates FOR SELECT TO anon, authenticated USING (is_active=true);
CREATE POLICY "op_rates_manage_owner" ON public.delivery_operator_rates FOR ALL TO authenticated
  USING (is_operator_owner(auth.uid(),operator_id)) WITH CHECK (is_operator_owner(auth.uid(),operator_id));
CREATE POLICY "op_rates_manage_staff" ON public.delivery_operator_rates FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));

DROP POLICY IF EXISTS "op_riders_select_owner" ON public.delivery_operator_riders;
DROP POLICY IF EXISTS "op_riders_select_self"  ON public.delivery_operator_riders;
DROP POLICY IF EXISTS "op_riders_select_staff" ON public.delivery_operator_riders;
DROP POLICY IF EXISTS "op_riders_insert_owner" ON public.delivery_operator_riders;
DROP POLICY IF EXISTS "op_riders_update_owner" ON public.delivery_operator_riders;
DROP POLICY IF EXISTS "op_riders_update_staff" ON public.delivery_operator_riders;
DROP POLICY IF EXISTS "op_riders_delete_owner" ON public.delivery_operator_riders;

CREATE POLICY "op_riders_select_owner" ON public.delivery_operator_riders FOR SELECT TO authenticated USING (is_operator_owner(auth.uid(),operator_id));
CREATE POLICY "op_riders_select_self"  ON public.delivery_operator_riders FOR SELECT TO authenticated USING (rider_user_id=auth.uid());
CREATE POLICY "op_riders_select_staff" ON public.delivery_operator_riders FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));
CREATE POLICY "op_riders_insert_owner" ON public.delivery_operator_riders FOR INSERT TO authenticated
  WITH CHECK (is_operator_owner(auth.uid(),operator_id) AND status IN ('pending','kyc_required'));
CREATE POLICY "op_riders_update_owner" ON public.delivery_operator_riders FOR UPDATE TO authenticated USING (is_operator_owner(auth.uid(),operator_id));
CREATE POLICY "op_riders_update_staff" ON public.delivery_operator_riders FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));
CREATE POLICY "op_riders_delete_owner" ON public.delivery_operator_riders FOR DELETE TO authenticated USING (is_operator_owner(auth.uid(),operator_id));

DROP POLICY IF EXISTS "quota_select_owner" ON public.operator_quota_requests;
DROP POLICY IF EXISTS "quota_select_staff" ON public.operator_quota_requests;
DROP POLICY IF EXISTS "quota_insert_owner" ON public.operator_quota_requests;
DROP POLICY IF EXISTS "quota_update_staff" ON public.operator_quota_requests;

CREATE POLICY "quota_select_owner" ON public.operator_quota_requests FOR SELECT TO authenticated USING (is_operator_owner(auth.uid(),operator_id));
CREATE POLICY "quota_select_staff" ON public.operator_quota_requests FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));
CREATE POLICY "quota_insert_owner" ON public.operator_quota_requests FOR INSERT TO authenticated
  WITH CHECK (is_operator_owner(auth.uid(),operator_id) AND status='pending');
CREATE POLICY "quota_update_staff" ON public.operator_quota_requests FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));

DROP POLICY IF EXISTS "ledger_select_owner" ON public.operator_commission_ledger;
DROP POLICY IF EXISTS "ledger_select_staff" ON public.operator_commission_ledger;
DROP POLICY IF EXISTS "ledger_insert_definer" ON public.operator_commission_ledger;

CREATE POLICY "ledger_select_owner" ON public.operator_commission_ledger FOR SELECT TO authenticated USING (is_operator_owner(auth.uid(),operator_id));
CREATE POLICY "ledger_select_staff" ON public.operator_commission_ledger FOR SELECT TO authenticated USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));
CREATE POLICY "ledger_insert_definer" ON public.operator_commission_ledger FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'));

-- Vue de sélection client
DROP VIEW IF EXISTS public.v_active_operators_by_city;
CREATE VIEW public.v_active_operators_by_city
WITH (security_invoker = true) AS
SELECT
  o.id AS operator_id, o.company_name, o.logo_url, o.rating_avg, o.total_deliveries, o.is_platform_owned,
  c.country_code, c.city,
  (SELECT MIN(base_price + COALESCE(surcharge,0)) FROM public.delivery_operator_rates r
     WHERE r.operator_id=o.id AND r.country_code=c.country_code AND r.city=c.city AND r.is_active=true) AS min_fee_preview,
  (SELECT MIN(estimated_minutes) FROM public.delivery_operator_rates r
     WHERE r.operator_id=o.id AND r.country_code=c.country_code AND r.city=c.city AND r.is_active=true) AS min_eta_minutes
FROM public.delivery_operators o
JOIN public.delivery_operator_cities c ON c.operator_id=o.id
WHERE o.is_active=true AND o.status='approved' AND c.is_active=true;

GRANT SELECT ON public.v_active_operators_by_city TO anon, authenticated;

-- Seed Zandofy Kinshasa
DO $$
DECLARE admin_uid uuid; zandofy_op_id uuid;
BEGIN
  SELECT user_id INTO admin_uid FROM public.user_roles WHERE role='admin' ORDER BY created_at ASC LIMIT 1;
  IF admin_uid IS NULL THEN
    RAISE NOTICE '[Lot11B Seed] Aucun admin trouvé — seed Zandofy Kinshasa SAUTÉ.';
    RETURN;
  END IF;
  SELECT id INTO zandofy_op_id FROM public.delivery_operators
    WHERE is_platform_owned=true AND headquarters_city='Kinshasa' LIMIT 1;
  IF zandofy_op_id IS NULL THEN
    INSERT INTO public.delivery_operators (
      owner_user_id, company_name, legal_name, contact_email, contact_phone,
      headquarters_country, headquarters_city, headquarters_address,
      vehicle_types, declared_riders_count, max_riders,
      platform_commission_pct, is_platform_owned, is_active, status, approved_at, approved_by
    ) VALUES (
      admin_uid, 'Zandofy Kinshasa Delivery', 'Zandofy SARL',
      'delivery@zandofy.com', '+243000000000',
      'CD', 'Kinshasa', '23 Avenue Munongo, Lubumbashi',
      '[{"type":"moto","count":2}]'::jsonb, 2, 30,
      25.00, true, true, 'approved', now(), admin_uid
    ) RETURNING id INTO zandofy_op_id;

    INSERT INTO public.delivery_operator_cities (operator_id, country_code, city, is_active)
    VALUES (zandofy_op_id, 'CD', 'Kinshasa', true) ON CONFLICT DO NOTHING;

    INSERT INTO public.delivery_operator_rates
      (operator_id, country_code, city, zone_name, base_price, price_per_km, currency, is_active)
    SELECT zandofy_op_id, COALESCE(lsr.country,'CD'), COALESCE(lsr.city,'Kinshasa'),
           lsr.zone_name, lsr.base_price, COALESCE(lsr.price_per_km,0), 'USD', true
    FROM public.local_shipping_rates lsr
    WHERE lsr.store_id IS NULL AND COALESCE(lsr.city,'Kinshasa')='Kinshasa'
    ON CONFLICT DO NOTHING;

    RAISE NOTICE '[Lot11B Seed] Zandofy Kinshasa Delivery créé : %', zandofy_op_id;
  END IF;
END $$;

-- Migration data : vendors can_self_deliver=true → opérateurs auto
DO $$
DECLARE v_store RECORD; v_op_id uuid; v_count int := 0;
BEGIN
  FOR v_store IN
    SELECT s.id AS store_id, s.name, s.owner_id, s.city, s.country
    FROM public.stores s JOIN public.vendor_subscriptions vs ON vs.store_id=s.id
    WHERE vs.can_self_deliver=true AND s.owner_id IS NOT NULL AND s.city IS NOT NULL
  LOOP
    IF EXISTS (SELECT 1 FROM public.delivery_operators
      WHERE owner_user_id=v_store.owner_id AND company_name='Auto-livraison '||v_store.name) THEN CONTINUE; END IF;

    INSERT INTO public.delivery_operators (
      owner_user_id, company_name, contact_email, contact_phone,
      headquarters_country, headquarters_city, vehicle_types,
      declared_riders_count, max_riders, platform_commission_pct,
      is_platform_owned, is_active, status, approved_at
    ) VALUES (
      v_store.owner_id, 'Auto-livraison '||v_store.name,
      COALESCE((SELECT email FROM auth.users WHERE id=v_store.owner_id), 'noreply@zandofy.com'),
      '+000000000', COALESCE(v_store.country,'CD'), v_store.city,
      '[]'::jsonb, 1, 1, 25.00, false, true, 'approved', now()
    ) RETURNING id INTO v_op_id;

    INSERT INTO public.delivery_operator_cities (operator_id, country_code, city, is_active)
    VALUES (v_op_id, COALESCE(v_store.country,'CD'), v_store.city, true) ON CONFLICT DO NOTHING;

    INSERT INTO public.delivery_operator_rates
      (operator_id, country_code, city, zone_name, base_price, currency, is_active)
    SELECT v_op_id, COALESCE(v_store.country,'CD'), vdz.city, vdz.zone_name,
           vdz.price::numeric, vdz.currency, vdz.is_active
    FROM public.vendor_delivery_zones vdz WHERE vdz.store_id=v_store.store_id
    ON CONFLICT DO NOTHING;

    v_count := v_count + 1;
  END LOOP;
  RAISE NOTICE '[Lot11B Migration] % vendor(s) self-delivery migré(s).', v_count;
END $$;

-- Marquage DEPRECATED + verrouillage écriture
COMMENT ON TABLE public.vendor_delivery_zones IS '[DEPRECATED Lot11B] Remplacée par delivery_operator_rates. Conservée 30j en lecture seule.';

DROP POLICY IF EXISTS "Store owners manage own delivery zones" ON public.vendor_delivery_zones;
CREATE POLICY "Store owners read own delivery zones (deprecated)" ON public.vendor_delivery_zones
  FOR SELECT TO authenticated USING (store_id IN (SELECT id FROM public.stores WHERE owner_id=auth.uid()));