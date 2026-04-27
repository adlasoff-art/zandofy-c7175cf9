-- =====================================================================
-- Lot 13 — Disputes v2: SLA, refunds (cash + wallet + negotiation), evidence
-- =====================================================================

-- 1) Disputes table enrichment ---------------------------------------------
ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS vendor_first_response_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_response_due_at      timestamptz,
  ADD COLUMN IF NOT EXISTS sla_resolution_due_at    timestamptz,
  ADD COLUMN IF NOT EXISTS escalated_at             timestamptz,
  ADD COLUMN IF NOT EXISTS escalated_reason         text,
  ADD COLUMN IF NOT EXISTS is_overdue               boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS proposed_refund_amount   numeric(12,2),
  ADD COLUMN IF NOT EXISTS proposed_refund_method   text CHECK (proposed_refund_method IN ('wallet','cash','original_method')),
  ADD COLUMN IF NOT EXISTS proposed_refund_by       uuid,
  ADD COLUMN IF NOT EXISTS proposed_refund_at       timestamptz,
  ADD COLUMN IF NOT EXISTS proposed_refund_status   text CHECK (proposed_refund_status IN ('pending','accepted','rejected','expired')),
  ADD COLUMN IF NOT EXISTS final_refund_amount      numeric(12,2),
  ADD COLUMN IF NOT EXISTS final_refund_method      text,
  ADD COLUMN IF NOT EXISTS refunded_at              timestamptz,
  ADD COLUMN IF NOT EXISTS refunded_by              uuid;

CREATE INDEX IF NOT EXISTS idx_disputes_sla_response_due
  ON public.disputes (sla_response_due_at)
  WHERE status = 'open' AND escalated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_disputes_sla_resolution_due
  ON public.disputes (sla_resolution_due_at)
  WHERE status NOT IN ('resolved','closed','rejected') AND is_overdue = false;

-- 2) Customer wallets ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_wallets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL UNIQUE,
  balance      numeric(12,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  currency     text NOT NULL DEFAULT 'USD',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_wallet_transactions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id    uuid NOT NULL REFERENCES public.customer_wallets(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL,
  amount       numeric(12,2) NOT NULL,
  type         text NOT NULL CHECK (type IN ('credit_refund','debit_purchase','adjustment')),
  dispute_id   uuid REFERENCES public.disputes(id) ON DELETE SET NULL,
  order_id     uuid REFERENCES public.orders(id)   ON DELETE SET NULL,
  description  text,
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cwt_wallet  ON public.customer_wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_cwt_user    ON public.customer_wallet_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_cwt_dispute ON public.customer_wallet_transactions(dispute_id);

ALTER TABLE public.customer_wallets              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_wallet_transactions  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wallet_owner_select"   ON public.customer_wallets;
DROP POLICY IF EXISTS "wallet_admin_select"   ON public.customer_wallets;
DROP POLICY IF EXISTS "wallet_admin_write"    ON public.customer_wallets;

CREATE POLICY "wallet_owner_select" ON public.customer_wallets
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "wallet_admin_write" ON public.customer_wallets
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "cwt_owner_select" ON public.customer_wallet_transactions;
DROP POLICY IF EXISTS "cwt_admin_write"  ON public.customer_wallet_transactions;

CREATE POLICY "cwt_owner_select" ON public.customer_wallet_transactions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "cwt_admin_write" ON public.customer_wallet_transactions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- 3) updated_at trigger on customer_wallets --------------------------------
DROP TRIGGER IF EXISTS trg_customer_wallets_updated_at ON public.customer_wallets;
CREATE TRIGGER trg_customer_wallets_updated_at
  BEFORE UPDATE ON public.customer_wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) SLA computation trigger on dispute insert -----------------------------
CREATE OR REPLACE FUNCTION public.compute_dispute_sla()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sla_response_due_at IS NULL THEN
    NEW.sla_response_due_at := NEW.created_at + interval '48 hours';
  END IF;
  IF NEW.sla_resolution_due_at IS NULL THEN
    NEW.sla_resolution_due_at := NEW.created_at + interval '7 days';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compute_dispute_sla ON public.disputes;
CREATE TRIGGER trg_compute_dispute_sla
  BEFORE INSERT ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.compute_dispute_sla();

-- 5) Mark vendor first response on new dispute_messages --------------------
CREATE OR REPLACE FUNCTION public.mark_vendor_first_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_owner uuid;
  v_dispute     RECORD;
BEGIN
  SELECT d.id, d.store_id, d.vendor_first_response_at
    INTO v_dispute
    FROM public.disputes d
   WHERE d.id = NEW.dispute_id;

  IF NOT FOUND OR v_dispute.vendor_first_response_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT s.owner_id INTO v_store_owner
    FROM public.stores s
   WHERE s.id = v_dispute.store_id;

  IF v_store_owner IS NOT NULL AND NEW.user_id = v_store_owner THEN
    UPDATE public.disputes
       SET vendor_first_response_at = NEW.created_at
     WHERE id = NEW.dispute_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_vendor_first_response ON public.dispute_messages;
CREATE TRIGGER trg_mark_vendor_first_response
  AFTER INSERT ON public.dispute_messages
  FOR EACH ROW EXECUTE FUNCTION public.mark_vendor_first_response();

-- 6) SLA processor (called by hourly cron) ---------------------------------
CREATE OR REPLACE FUNCTION public.process_dispute_sla()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_escalated int := 0;
  v_overdue   int := 0;
BEGIN
  -- Auto-escalate to admin: vendor missed 48h response window
  WITH escalated AS (
    UPDATE public.disputes d
       SET escalated_at      = now(),
           escalated_reason  = 'sla_no_vendor_response_48h',
           priority          = 'high',
           status            = CASE WHEN status = 'open' THEN 'escalated' ELSE status END
     WHERE d.escalated_at IS NULL
       AND d.vendor_first_response_at IS NULL
       AND d.sla_response_due_at IS NOT NULL
       AND d.sla_response_due_at < now()
       AND d.status NOT IN ('resolved','closed','rejected')
     RETURNING d.id
  )
  SELECT count(*) INTO v_escalated FROM escalated;

  -- Mark overdue: resolution SLA breached
  WITH overdue AS (
    UPDATE public.disputes d
       SET is_overdue = true,
           priority   = 'high'
     WHERE d.is_overdue = false
       AND d.sla_resolution_due_at IS NOT NULL
       AND d.sla_resolution_due_at < now()
       AND d.status NOT IN ('resolved','closed','rejected')
     RETURNING d.id
  )
  SELECT count(*) INTO v_overdue FROM overdue;

  RETURN jsonb_build_object(
    'escalated', v_escalated,
    'overdue',   v_overdue,
    'ran_at',    now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_dispute_sla() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_dispute_sla() TO service_role;

-- 7) Apply refund (called by Edge Function with admin/service_role) --------
CREATE OR REPLACE FUNCTION public.apply_dispute_refund(
  p_dispute_id uuid,
  p_amount     numeric,
  p_method     text,        -- 'wallet' | 'cash' | 'original_method'
  p_actor      uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dispute RECORD;
  v_order   RECORD;
  v_wallet  RECORD;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid refund amount';
  END IF;
  IF p_method NOT IN ('wallet','cash','original_method') THEN
    RAISE EXCEPTION 'Invalid refund method';
  END IF;

  SELECT * INTO v_dispute FROM public.disputes WHERE id = p_dispute_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dispute not found'; END IF;

  SELECT id, user_id, total INTO v_order FROM public.orders WHERE id = v_dispute.order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF p_amount > COALESCE(v_order.total, 0) THEN
    RAISE EXCEPTION 'Refund amount exceeds order total';
  END IF;

  IF p_method = 'wallet' THEN
    SELECT * INTO v_wallet FROM public.customer_wallets WHERE user_id = v_order.user_id;
    IF NOT FOUND THEN
      INSERT INTO public.customer_wallets(user_id, balance, currency)
      VALUES (v_order.user_id, p_amount, 'USD')
      RETURNING * INTO v_wallet;
    ELSE
      UPDATE public.customer_wallets
         SET balance = balance + p_amount
       WHERE id = v_wallet.id
       RETURNING * INTO v_wallet;
    END IF;

    INSERT INTO public.customer_wallet_transactions
      (wallet_id, user_id, amount, type, dispute_id, order_id, description, created_by)
    VALUES
      (v_wallet.id, v_order.user_id, p_amount, 'credit_refund',
       p_dispute_id, v_order.id,
       'Dispute refund #' || p_dispute_id::text, p_actor);
  END IF;

  IF p_method IN ('cash','original_method') THEN
    INSERT INTO public.payment_transactions
      (order_id, amount, payment_type, status, payment_method, notes)
    VALUES
      (v_order.id, -p_amount, 'refund', 'completed',
       p_method,
       'Refund for dispute ' || p_dispute_id::text);
  END IF;

  UPDATE public.disputes
     SET final_refund_amount = p_amount,
         final_refund_method = p_method,
         refunded_at         = now(),
         refunded_by         = p_actor,
         status              = 'resolved',
         resolved_at         = now(),
         resolved_by         = p_actor
   WHERE id = p_dispute_id;

  RETURN jsonb_build_object(
    'dispute_id', p_dispute_id,
    'amount',     p_amount,
    'method',     p_method,
    'wallet_balance', CASE WHEN p_method = 'wallet' THEN v_wallet.balance ELSE NULL END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_dispute_refund(uuid, numeric, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_dispute_refund(uuid, numeric, text, uuid) TO authenticated;

-- 8) Storage bucket for dispute evidence -----------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dispute-evidence', 'dispute-evidence', false,
  10485760,
  ARRAY['image/jpeg','image/png','image/webp','image/heic']
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Path convention: <dispute_id>/<uploader_user_id>/<uuid>.<ext>
DROP POLICY IF EXISTS "dispute_evidence_select" ON storage.objects;
DROP POLICY IF EXISTS "dispute_evidence_insert" ON storage.objects;
DROP POLICY IF EXISTS "dispute_evidence_delete" ON storage.objects;

CREATE POLICY "dispute_evidence_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'dispute-evidence'
    AND EXISTS (
      SELECT 1 FROM public.disputes d
       LEFT JOIN public.stores s ON s.id = d.store_id
       WHERE d.id::text = (storage.foldername(name))[1]
         AND (
           d.user_id = auth.uid()
           OR s.owner_id = auth.uid()
           OR public.has_role(auth.uid(),'admin')
         )
    )
  );

CREATE POLICY "dispute_evidence_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'dispute-evidence'
    AND auth.uid()::text = (storage.foldername(name))[2]
    AND EXISTS (
      SELECT 1 FROM public.disputes d
       LEFT JOIN public.stores s ON s.id = d.store_id
       WHERE d.id::text = (storage.foldername(name))[1]
         AND (
           d.user_id = auth.uid()
           OR s.owner_id = auth.uid()
           OR public.has_role(auth.uid(),'admin')
         )
    )
  );

CREATE POLICY "dispute_evidence_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'dispute-evidence'
    AND (
      auth.uid()::text = (storage.foldername(name))[2]
      OR public.has_role(auth.uid(),'admin')
    )
  );
