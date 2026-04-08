-- Add province_id to profiles for cascading geo combobox
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS residence_province_id uuid;

-- Create address change requests table
CREATE TABLE IF NOT EXISTS public.address_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  new_country text,
  new_province text,
  new_province_id uuid,
  new_city text,
  new_commune text,
  new_quartier text,
  new_address text,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.address_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own address change requests"
  ON public.address_change_requests FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create own address change requests"
  ON public.address_change_requests FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update address change requests"
  ON public.address_change_requests FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger to prevent deleting default addresses
CREATE OR REPLACE FUNCTION public.prevent_default_address_deletion()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.is_default = true THEN
    RAISE EXCEPTION 'Cannot delete default address. Change default first.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_default_address_deletion ON public.saved_addresses;
CREATE TRIGGER trg_prevent_default_address_deletion
  BEFORE DELETE ON public.saved_addresses
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_default_address_deletion();