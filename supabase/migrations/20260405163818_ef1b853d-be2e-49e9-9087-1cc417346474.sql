
-- LOT 1: Enrich store_transfer_requests
ALTER TABLE public.store_transfer_requests
  ADD COLUMN IF NOT EXISTS transfer_type text DEFAULT 'owner_initiated',
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS documents text[],
  ADD COLUMN IF NOT EXISTS claim_warning_accepted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- Allow users to insert their own transfer requests
DROP POLICY IF EXISTS "Users can insert own transfer requests" ON public.store_transfer_requests;
CREATE POLICY "Users can insert own transfer requests"
  ON public.store_transfer_requests FOR INSERT TO authenticated
  WITH CHECK (from_user_id = auth.uid() OR to_user_id = auth.uid());

-- Allow users to read their own transfer requests
DROP POLICY IF EXISTS "Users can read own transfer requests" ON public.store_transfer_requests;
CREATE POLICY "Users can read own transfer requests"
  ON public.store_transfer_requests FOR SELECT TO authenticated
  USING (from_user_id = auth.uid() OR to_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- LOT 2: Store change requests
CREATE TABLE IF NOT EXISTS public.store_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  field_name text NOT NULL,
  old_value text,
  new_value text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.store_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage store change requests" ON public.store_change_requests;
CREATE POLICY "Admins manage store change requests"
  ON public.store_change_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "Users can insert own change requests" ON public.store_change_requests;
CREATE POLICY "Users can insert own change requests"
  ON public.store_change_requests FOR INSERT TO authenticated
  WITH CHECK (requested_by = auth.uid());

DROP POLICY IF EXISTS "Users can read own change requests" ON public.store_change_requests;
CREATE POLICY "Users can read own change requests"
  ON public.store_change_requests FOR SELECT TO authenticated
  USING (requested_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- LOT 3: Platform service plans
CREATE TABLE IF NOT EXISTS public.platform_service_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_key text NOT NULL UNIQUE,
  label text NOT NULL,
  description text,
  price_monthly numeric NOT NULL DEFAULT 0,
  price_yearly numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  features jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_service_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read active service plans" ON public.platform_service_plans;
CREATE POLICY "Anyone can read active service plans"
  ON public.platform_service_plans FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins manage service plans" ON public.platform_service_plans;
CREATE POLICY "Admins manage service plans"
  ON public.platform_service_plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add active_services to vendor_subscriptions if not exists
ALTER TABLE public.vendor_subscriptions
  ADD COLUMN IF NOT EXISTS active_services jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS service_paid_until timestamptz;

-- LOT 4: Delivery subscriptions
CREATE TABLE IF NOT EXISTS public.delivery_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  plan_type text NOT NULL,
  tier text NOT NULL DEFAULT 'standard',
  max_riders int NOT NULL DEFAULT 1,
  hub_storage boolean NOT NULL DEFAULT false,
  price numeric NOT NULL DEFAULT 0,
  paid_until timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.delivery_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own delivery subscriptions" ON public.delivery_subscriptions;
CREATE POLICY "Users read own delivery subscriptions"
  ON public.delivery_subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "Admins manage delivery subscriptions" ON public.delivery_subscriptions;
CREATE POLICY "Admins manage delivery subscriptions"
  ON public.delivery_subscriptions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "Users insert own delivery subscriptions" ON public.delivery_subscriptions;
CREATE POLICY "Users insert own delivery subscriptions"
  ON public.delivery_subscriptions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Hub storage tracking
CREATE TABLE IF NOT EXISTS public.hub_storage_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  product_id uuid,
  weight_kg numeric NOT NULL DEFAULT 0,
  arrived_at timestamptz NOT NULL DEFAULT now(),
  free_until timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  daily_rate numeric NOT NULL DEFAULT 0.59,
  is_penalty_active boolean NOT NULL DEFAULT false,
  total_penalty numeric NOT NULL DEFAULT 0,
  last_penalty_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hub_storage_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage hub storage" ON public.hub_storage_tracking;
CREATE POLICY "Admins manage hub storage"
  ON public.hub_storage_tracking FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

DROP POLICY IF EXISTS "Store owners read own hub storage" ON public.hub_storage_tracking;
CREATE POLICY "Store owners read own hub storage"
  ON public.hub_storage_tracking FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.stores s WHERE s.id = store_id AND s.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  );

-- Seed delivery plan config in platform_settings
INSERT INTO public.platform_settings (key, value)
VALUES ('delivery_plans', '{
  "vendor_plans": [
    {"plan_type":"vendor_5","label":"5 livraisons/jour","tiers":{"standard":{"riders":1,"hub":false},"professional":{"riders":2,"hub":false},"premium":{"riders":2,"hub":true}}},
    {"plan_type":"vendor_10","label":"10 livraisons/jour","tiers":{"standard":{"riders":1,"hub":false},"professional":{"riders":2,"hub":false},"premium":{"riders":2,"hub":true}}},
    {"plan_type":"vendor_20","label":"20 livraisons/jour","tiers":{"standard":{"riders":2,"hub":false},"professional":{"riders":3,"hub":false},"premium":{"riders":4,"hub":true}}},
    {"plan_type":"vendor_50","label":"50 livraisons/jour","tiers":{"standard":{"riders":2,"hub":false},"professional":{"riders":3,"hub":false},"premium":{"riders":5,"hub":true}}},
    {"plan_type":"vendor_100","label":"100 livraisons/jour","tiers":{"standard":{"riders":4,"hub":false},"professional":{"riders":5,"hub":false},"premium":{"riders":10,"hub":true}}}
  ],
  "hub_storage":{"free_days":14,"daily_rate":0.59,"min_weight_kg":1,"work_days":["mon","tue","wed","thu","fri","sat"]}
}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_store_change_requests_store ON public.store_change_requests(store_id);
CREATE INDEX IF NOT EXISTS idx_store_change_requests_status ON public.store_change_requests(status);
CREATE INDEX IF NOT EXISTS idx_delivery_subscriptions_user ON public.delivery_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_subscriptions_store ON public.delivery_subscriptions(store_id);
CREATE INDEX IF NOT EXISTS idx_hub_storage_store ON public.hub_storage_tracking(store_id);
