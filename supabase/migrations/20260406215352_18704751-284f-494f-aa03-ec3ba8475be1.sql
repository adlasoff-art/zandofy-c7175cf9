
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='service_packages' AND column_name='max_collaborators') THEN
    ALTER TABLE public.service_packages ADD COLUMN max_collaborators int DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='vendor_pricing_overrides' AND column_name='collaborator_limit_override') THEN
    ALTER TABLE public.vendor_pricing_overrides ADD COLUMN collaborator_limit_override int;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='store_collaborators' AND column_name='sub_role') THEN
    ALTER TABLE public.store_collaborators ADD COLUMN sub_role text DEFAULT 'orders';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='store_collaborators' AND column_name='permissions') THEN
    ALTER TABLE public.store_collaborators ADD COLUMN permissions text[] DEFAULT '{orders}';
  END IF;
END $$;
