-- Lot 1 + Lot 4 + Lot 7 : RPC d'agrégation admin overview + index conversations vendeur
-- Objectif : remplacer 8+ requêtes client lourdes (qui transferent jusqu'à 50k lignes)
-- par un seul appel RPC retournant ~1KB de JSON agrégé côté Postgres.

-- =========================================================================
-- RPC : admin_dashboard_overview
-- Agrège orders + payment_transactions + disputes + returns + role counts
-- + basic table counts pour la page Vue d'ensemble du tableau de bord admin.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.admin_dashboard_overview(
  _since timestamptz DEFAULT NULL,
  _country text DEFAULT NULL,
  _city text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_since timestamptz := COALESCE(_since, 'epoch'::timestamptz);
  v_order_stats jsonb;
  v_payment_stats jsonb;
  v_dispute_stats jsonb;
  v_return_stats jsonb;
  v_role_counts jsonb;
  v_profile_count bigint;
  v_product_count bigint;
  v_store_count bigint;
  v_recent_orders jsonb;
BEGIN
  -- Sécurité : seuls admins / managers
  IF v_uid IS NULL
     OR NOT (public.has_role(v_uid, 'admin'::public.app_role)
             OR public.has_role(v_uid, 'manager'::public.app_role)) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- ---------- ORDER STATS (agrégation SQL plutôt que client) ----------
  WITH base AS (
    SELECT o.total, o.status, o.shipping_payment_status, o.last_mile_payment_status,
           o.shipping_cost, o.last_mile_fee, o.shipping_payment_proof_url,
           o.last_mile_payment_proof_url
    FROM public.orders o
    WHERE o.created_at >= v_since
      AND (_country IS NULL OR o.shipping_country = _country)
      AND (_city IS NULL OR o.shipping_city = _city)
  ),
  by_status AS (
    SELECT status, count(*)::int AS cnt FROM base GROUP BY status
  )
  SELECT jsonb_build_object(
    'count', COALESCE(sum(CASE WHEN status NOT IN ('payment_failed','awaiting_payment','cancelled','returned') THEN 1 ELSE 0 END), 0),
    'revenue', COALESCE(sum(CASE WHEN status IN ('delivered','shipped','received') THEN total ELSE 0 END), 0),
    'currentRevenue', COALESCE(sum(CASE WHEN status NOT IN ('payment_failed','awaiting_payment','cancelled','returned') THEN total ELSE 0 END), 0),
    'cancelledRevenue', COALESCE(sum(CASE WHEN status IN ('cancelled','returned') THEN total ELSE 0 END), 0),
    'cancelledCount', COALESCE(sum(CASE WHEN status IN ('cancelled','returned') THEN 1 ELSE 0 END), 0),
    'deliveredCount', COALESCE(sum(CASE WHEN status='delivered' THEN 1 ELSE 0 END), 0),
    'pendingCount', COALESCE(sum(CASE WHEN status='pending' THEN 1 ELSE 0 END), 0),
    'failedAmount', COALESCE(sum(CASE WHEN status IN ('payment_failed','awaiting_payment') THEN total ELSE 0 END), 0),
    'failedCount', COALESCE(sum(CASE WHEN status IN ('payment_failed','awaiting_payment') THEN 1 ELSE 0 END), 0),
    'proofShippingPaid', COALESCE(sum(CASE WHEN shipping_payment_status='paid' AND shipping_payment_proof_url IS NOT NULL THEN COALESCE(shipping_cost,0) ELSE 0 END), 0),
    'proofLastMilePaid', COALESCE(sum(CASE WHEN last_mile_payment_status='paid' AND last_mile_payment_proof_url IS NOT NULL THEN COALESCE(last_mile_fee,0) ELSE 0 END), 0),
    'byStatus', COALESCE((SELECT jsonb_object_agg(status, cnt) FROM by_status), '{}'::jsonb)
  )
  INTO v_order_stats
  FROM base;

  -- ---------- PAYMENT STATS ----------
  WITH p AS (
    SELECT status, amount, method, payment_type
    FROM public.payment_transactions
    WHERE created_at >= v_since
  )
  SELECT jsonb_build_object(
    'successful', COALESCE(sum(CASE WHEN status IN ('success','completed') THEN 1 ELSE 0 END), 0),
    'pending', COALESCE(sum(CASE WHEN status='pending' THEN 1 ELSE 0 END), 0),
    'failed', COALESCE(sum(CASE WHEN status='failed' THEN 1 ELSE 0 END), 0),
    'totalAmount', COALESCE(sum(CASE WHEN status IN ('success','completed') THEN amount ELSE 0 END), 0),
    'orderAmount', COALESCE(sum(CASE WHEN status IN ('success','completed') AND COALESCE(payment_type,'order')='order' THEN amount ELSE 0 END), 0),
    'shippingAmount', COALESCE(sum(CASE WHEN status IN ('success','completed') AND payment_type='shipping' THEN amount ELSE 0 END), 0),
    'lastMileAmount', COALESCE(sum(CASE WHEN status IN ('success','completed') AND payment_type='last_mile' THEN amount ELSE 0 END), 0),
    'mobileMoneyGross', COALESCE(sum(CASE WHEN status IN ('success','completed') AND method='mobile_money' THEN amount ELSE 0 END), 0)
  )
  INTO v_payment_stats
  FROM p;

  -- ---------- DISPUTES & RETURNS ----------
  SELECT jsonb_build_object(
    'total', count(*),
    'open', count(*) FILTER (WHERE status='open')
  ) INTO v_dispute_stats
  FROM public.disputes WHERE created_at >= v_since;

  SELECT jsonb_build_object(
    'total', count(*),
    'pending', count(*) FILTER (WHERE status='pending')
  ) INTO v_return_stats
  FROM public.return_requests WHERE created_at >= v_since;

  -- ---------- ROLE COUNTS ----------
  SELECT COALESCE(jsonb_agg(jsonb_build_object('role', role, 'count', cnt) ORDER BY cnt DESC), '[]'::jsonb)
  INTO v_role_counts
  FROM (
    SELECT role::text AS role, count(*)::int AS cnt
    FROM public.user_roles
    GROUP BY role
  ) t;

  -- ---------- BASIC COUNTS (estimated pour grosses tables) ----------
  -- profiles / products / stores : on utilise pg_class.reltuples (estimation)
  -- pour éviter un seq scan complet à chaque chargement.
  SELECT COALESCE(reltuples::bigint, 0) INTO v_profile_count
    FROM pg_class WHERE oid = 'public.profiles'::regclass;
  SELECT COALESCE(reltuples::bigint, 0) INTO v_product_count
    FROM pg_class WHERE oid = 'public.products'::regclass;
  SELECT COALESCE(reltuples::bigint, 0) INTO v_store_count
    FROM pg_class WHERE oid = 'public.stores'::regclass;

  -- ---------- RECENT ORDERS (8 dernières) ----------
  SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.created_at DESC), '[]'::jsonb)
  INTO v_recent_orders
  FROM (
    SELECT order_ref, shipping_first_name, shipping_last_name, total, status, created_at
    FROM public.orders
    ORDER BY created_at DESC
    LIMIT 8
  ) r;

  RETURN jsonb_build_object(
    'orderStats', v_order_stats,
    'paymentStats', v_payment_stats,
    'disputeStats', v_dispute_stats,
    'returnStats', v_return_stats,
    'roleCounts', v_role_counts,
    'profileCount', v_profile_count,
    'productCount', v_product_count,
    'storeCount', v_store_count,
    'recentOrders', v_recent_orders
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_dashboard_overview(timestamptz, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_overview(timestamptz, text, text) TO authenticated;

-- =========================================================================
-- RPC : vendor_conversation_summary
-- Pour `VendorDashboardPage` : remplace le N+1 (2 requêtes par conversation)
-- par un seul appel agrégé.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.vendor_conversation_summary(_store_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT owner_id INTO v_owner FROM public.stores WHERE id = _store_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'store_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- Autorisation : propriétaire du store, admin ou manager
  IF v_owner <> v_uid
     AND NOT public.has_role(v_uid, 'admin'::public.app_role)
     AND NOT public.has_role(v_uid, 'manager'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  WITH convs AS (
    SELECT id, user_id, product_id, updated_at
    FROM public.conversations
    WHERE store_id = _store_id
    ORDER BY updated_at DESC
  ),
  last_msgs AS (
    SELECT DISTINCT ON (m.conversation_id)
      m.conversation_id, m.content, m.created_at
    FROM public.messages m
    JOIN convs c ON c.id = m.conversation_id
    ORDER BY m.conversation_id, m.created_at DESC
  ),
  unread AS (
    SELECT m.conversation_id, count(*)::int AS unread_count
    FROM public.messages m
    JOIN convs c ON c.id = m.conversation_id
    WHERE m.is_read = false AND m.sender_id <> v_uid
    GROUP BY m.conversation_id
  ),
  profs AS (
    SELECT id, email FROM public.profiles
    WHERE id IN (SELECT user_id FROM convs)
  ),
  prods AS (
    SELECT id, name_fr FROM public.products
    WHERE id IN (SELECT product_id FROM convs WHERE product_id IS NOT NULL)
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'user_id', c.user_id,
      'product_id', c.product_id,
      'updated_at', c.updated_at,
      'last_message', lm.content,
      'unread_count', COALESCE(u.unread_count, 0),
      'customer_email', pf.email,
      'product_name', pr.name_fr
    ) ORDER BY c.updated_at DESC
  ), '[]'::jsonb)
  INTO v_result
  FROM convs c
  LEFT JOIN last_msgs lm ON lm.conversation_id = c.id
  LEFT JOIN unread u ON u.conversation_id = c.id
  LEFT JOIN profs pf ON pf.id = c.user_id
  LEFT JOIN prods pr ON pr.id = c.product_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.vendor_conversation_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vendor_conversation_summary(uuid) TO authenticated;

-- =========================================================================
-- Lot 7 : indexes complémentaires
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_messages_unread_per_conv
  ON public.messages (conversation_id, sender_id)
  WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_orders_store_status
  ON public.orders (store_id, status);

CREATE INDEX IF NOT EXISTS idx_orders_created_at_desc
  ON public.orders (created_at DESC);
