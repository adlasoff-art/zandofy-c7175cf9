
-- Remove sensitive tables from Realtime publication
-- products exposes: cost_real, cost_calc (commercial margins)
-- stores exposes: whatsapp_number (private contact)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'products'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.products;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'stores'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.stores;
  END IF;
END $$;
