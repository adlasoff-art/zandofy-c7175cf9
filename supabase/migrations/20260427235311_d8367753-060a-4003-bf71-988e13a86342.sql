-- LOT 17 — Dette technique & performances

-- PARTIE 1 : Révocation EXECUTE sur fonctions internes
DO $$
DECLARE
  fn record;
  internal_prefixes text[] := ARRAY[
    'notify_', 'enforce_', 'auto_', 'log_', 'compute_', 'cleanup_',
    'set_', 'refresh_', 'force_', 'prevent_', 'protect_', 'sync_',
    'lock_', 'bridge_', 'mark_', 'record_', 'decrement_', 'credit_',
    'release_', 'process_', 'handle_', 'generate_',
    'products_ensure_', 'enrich_', 'create_pending_', 'create_forwarder_',
    'finalize_', 'is_kyc_', 'is_operator_', 'increment_coupon_'
  ];
  pref text;
  matched boolean;
BEGIN
  FOR fn IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    IF fn.proname IN (
      'release_pending_wallet_funds', 'expire_inactive_points',
      'has_role', 'check_kyc_required', 'check_rate_limit',
      'increment_blog_post_views', 'increment_helpful'
    ) THEN
      CONTINUE;
    END IF;

    matched := false;
    FOREACH pref IN ARRAY internal_prefixes LOOP
      IF fn.proname LIKE pref || '%' THEN
        matched := true;
        EXIT;
      END IF;
    END LOOP;

    IF matched THEN
      BEGIN
        EXECUTE format(
          'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
          fn.proname, fn.args
        );
      EXCEPTION WHEN OTHERS THEN NULL;
      END;
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE
  fn_name text;
  args_def text;
BEGIN
  FOR fn_name, args_def IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid)
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
      AND p.proname IN (
        'apply_dispute_refund', 'add_intermediate_hub_handoff',
        'reassign_forwarder', 'quote_forwarder',
        'refresh_all_operator_reliability', 'operator_decide_order'
      )
  LOOP
    BEGIN
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated',
        fn_name, args_def
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- PARTIE 2 : INDEXES de performance
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON public.payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON public.payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status_created ON public.payment_transactions(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_products_store_status ON public.products(store_id, publish_status);
CREATE INDEX IF NOT EXISTS idx_products_status_created ON public.products(publish_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);

CREATE INDEX IF NOT EXISTS idx_reviews_product_approved ON public.reviews(product_id, is_approved);

CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at DESC);

ANALYZE public.order_items;
ANALYZE public.payment_transactions;
ANALYZE public.products;
ANALYZE public.reviews;
ANALYZE public.notifications;