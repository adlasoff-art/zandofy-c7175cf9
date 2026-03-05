
-- Vendor applications table for multi-step registration
CREATE TABLE public.vendor_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  current_step integer NOT NULL DEFAULT 1,
  -- Step 1: Personal info
  full_name text,
  phone text,
  business_type text,
  -- Step 2: Store config
  store_name text,
  store_description text,
  store_logo_url text,
  store_banner_url text,
  -- Step 3: KYB info
  company_name text,
  company_address text,
  company_city text,
  company_country text DEFAULT 'Sénégal',
  -- Timestamps
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_applications ENABLE ROW LEVEL SECURITY;

-- Users can read/update their own applications
CREATE POLICY "Users read own applications" ON public.vendor_applications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users insert own applications" ON public.vendor_applications
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own applications" ON public.vendor_applications
  FOR UPDATE USING (user_id = auth.uid() AND status IN ('draft', 'revision_requested'));

-- Staff can read all and update status
CREATE POLICY "Staff read all applications" ON public.vendor_applications
  FOR SELECT USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Staff update applications" ON public.vendor_applications
  FOR UPDATE USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- Vendor documents for KYB
CREATE TABLE public.vendor_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.vendor_applications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  document_type text NOT NULL,
  document_url text NOT NULL,
  file_name text,
  status text NOT NULL DEFAULT 'pending',
  admin_comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vendor_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own documents" ON public.vendor_documents
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users insert own documents" ON public.vendor_documents
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own documents" ON public.vendor_documents
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "Staff read all documents" ON public.vendor_documents
  FOR SELECT USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

CREATE POLICY "Staff update documents" ON public.vendor_documents
  FOR UPDATE USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager'));

-- Storage bucket for vendor KYB documents
INSERT INTO storage.buckets (id, name, public) VALUES ('vendor-documents', 'vendor-documents', false);

CREATE POLICY "Users upload own vendor docs" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'vendor-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users read own vendor docs" ON storage.objects
  FOR SELECT USING (bucket_id = 'vendor-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Staff read all vendor docs" ON storage.objects
  FOR SELECT USING (bucket_id = 'vendor-documents' AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager')));

CREATE POLICY "Users delete own vendor docs" ON storage.objects
  FOR DELETE USING (bucket_id = 'vendor-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Trigger for updated_at
CREATE TRIGGER update_vendor_applications_updated_at
  BEFORE UPDATE ON public.vendor_applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
