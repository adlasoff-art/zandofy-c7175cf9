
-- 1. KYC verification status enum
CREATE TYPE public.kyc_status AS ENUM ('not_started', 'pending', 'approved', 'rejected', 'resubmission_required');

-- 2. KYC document type enum
CREATE TYPE public.kyc_document_type AS ENUM ('national_id', 'voter_card', 'passport', 'drivers_license');

-- 3. KYC verifications table
CREATE TABLE public.kyc_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status kyc_status NOT NULL DEFAULT 'pending',
  document_type kyc_document_type NOT NULL,
  document_front_url text NOT NULL,
  document_back_url text,
  selfie_url text NOT NULL,
  -- Address fields
  address_country text NOT NULL DEFAULT 'CD',
  address_city text NOT NULL,
  address_street text NOT NULL,
  address_district text,
  address_postal_code text,
  -- Review fields
  reviewed_by uuid,
  reviewed_at timestamptz,
  rejection_reason text,
  admin_notes text,
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for quick user lookup
CREATE INDEX idx_kyc_verifications_user_id ON public.kyc_verifications(user_id);
CREATE INDEX idx_kyc_verifications_status ON public.kyc_verifications(status);

-- 4. KYC audit log
CREATE TABLE public.kyc_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_id uuid NOT NULL REFERENCES public.kyc_verifications(id) ON DELETE CASCADE,
  action text NOT NULL,
  performed_by uuid NOT NULL,
  old_status kyc_status,
  new_status kyc_status,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Enable RLS
ALTER TABLE public.kyc_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kyc_audit_logs ENABLE ROW LEVEL SECURITY;

-- 6. RLS policies for kyc_verifications
-- Users can read their own KYC
CREATE POLICY "Users read own KYC" ON public.kyc_verifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own KYC
CREATE POLICY "Users insert own KYC" ON public.kyc_verifications
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own pending/resubmission KYC
CREATE POLICY "Users update own resubmission KYC" ON public.kyc_verifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status IN ('rejected', 'resubmission_required'));

-- Admins can read all KYC
CREATE POLICY "Admins read all KYC" ON public.kyc_verifications
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers read all KYC" ON public.kyc_verifications
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'manager'));

-- Admins can update KYC (approve/reject)
CREATE POLICY "Admins update KYC" ON public.kyc_verifications
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers update KYC" ON public.kyc_verifications
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'manager'));

-- 7. RLS for audit logs
CREATE POLICY "Admins read KYC audit logs" ON public.kyc_audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admins insert KYC audit logs" ON public.kyc_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- 8. Storage bucket for KYC documents (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-documents', 'kyc-documents', false);

-- Storage policies for kyc-documents
CREATE POLICY "Users upload own KYC docs" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users read own KYC docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'kyc-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Admins read all KYC docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'kyc-documents' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers read all KYC docs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'kyc-documents' AND public.has_role(auth.uid(), 'manager'));

-- 9. Trigger to notify user when KYC status changes
CREATE OR REPLACE FUNCTION public.notify_kyc_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_msg text;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  CASE NEW.status
    WHEN 'approved' THEN
      v_msg := 'Votre vérification d''identité a été approuvée ! Vous avez maintenant accès aux options de paiement avancées.';
    WHEN 'rejected' THEN
      v_msg := 'Votre vérification d''identité a été refusée. Raison : ' || COALESCE(NEW.rejection_reason, 'Non spécifiée');
    WHEN 'resubmission_required' THEN
      v_msg := 'Votre vérification d''identité nécessite une nouvelle soumission. ' || COALESCE(NEW.rejection_reason, '');
    ELSE
      RETURN NEW;
  END CASE;

  INSERT INTO public.notifications (user_id, type, title, message, link)
  VALUES (NEW.user_id, 'system', 'Vérification KYC', v_msg, '/dashboard');

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_kyc_status_change
  AFTER UPDATE ON public.kyc_verifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_kyc_status_change();

-- 10. Function to check if user needs KYC (completed orders >= threshold)
CREATE OR REPLACE FUNCTION public.check_kyc_required(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT (
    SELECT COUNT(*) FROM public.orders
    WHERE user_id = p_user_id AND status IN ('delivered', 'shipped', 'confirmed', 'processing')
  ) >= COALESCE(
    (SELECT (value->>'kyc_activation_orders')::int FROM public.platform_settings WHERE key = 'kyc_settings'),
    2
  )
$$;

-- 11. Function to check if user is KYC verified
CREATE OR REPLACE FUNCTION public.is_kyc_verified(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.kyc_verifications
    WHERE user_id = p_user_id AND status = 'approved'
  )
$$;

-- 12. Function to check if user has exceeded order limit without KYC
CREATE OR REPLACE FUNCTION public.is_kyc_order_blocked(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT (
    NOT public.is_kyc_verified(p_user_id)
    AND (
      SELECT COUNT(*) FROM public.orders
      WHERE user_id = p_user_id AND status NOT IN ('cancelled', 'returned')
    ) >= COALESCE(
      (SELECT (value->>'kyc_order_limit')::int FROM public.platform_settings WHERE key = 'kyc_settings'),
      10
    )
  )
$$;

-- 13. Trigger to notify user about KYC after order threshold
CREATE OR REPLACE FUNCTION public.notify_kyc_required_after_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order_count int;
  v_threshold int;
  v_already_verified boolean;
  v_already_notified boolean;
BEGIN
  -- Only on new orders
  IF TG_OP != 'INSERT' THEN RETURN NEW; END IF;

  SELECT public.is_kyc_verified(NEW.user_id) INTO v_already_verified;
  IF v_already_verified THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_order_count
  FROM public.orders WHERE user_id = NEW.user_id AND status NOT IN ('cancelled', 'returned');

  SELECT COALESCE((value->>'kyc_activation_orders')::int, 2) INTO v_threshold
  FROM public.platform_settings WHERE key = 'kyc_settings';

  IF v_order_count >= v_threshold THEN
    -- Check if we already sent a KYC notification recently (last 3 days)
    SELECT EXISTS(
      SELECT 1 FROM public.notifications
      WHERE user_id = NEW.user_id AND type = 'system' AND title = 'Vérification requise'
      AND created_at > now() - interval '3 days'
    ) INTO v_already_notified;

    IF NOT v_already_notified THEN
      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (
        NEW.user_id,
        'system',
        'Vérification requise',
        'Complétez votre vérification d''identité pour débloquer les options de paiement avancées et la livraison à domicile.',
        '/dashboard'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_kyc_on_order
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_kyc_required_after_order();
