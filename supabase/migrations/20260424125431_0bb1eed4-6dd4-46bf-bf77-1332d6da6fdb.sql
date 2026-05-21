ALTER TABLE public.forwarder_handoffs
  ADD COLUMN IF NOT EXISTS tracking_number text,
  ADD COLUMN IF NOT EXISTS tracking_carrier text,
  ADD COLUMN IF NOT EXISTS tracking_url text;

COMMENT ON COLUMN public.forwarder_handoffs.tracking_number IS 'Lot 4M — N° de suivi externe (AWB aérien, BL maritime, conteneur, etc.)';
COMMENT ON COLUMN public.forwarder_handoffs.tracking_carrier IS 'Lot 4M — Compagnie de transport (ex: DHL, Maersk, China Post)';
COMMENT ON COLUMN public.forwarder_handoffs.tracking_url IS 'Lot 4M — URL publique de suivi auprès du transporteur';