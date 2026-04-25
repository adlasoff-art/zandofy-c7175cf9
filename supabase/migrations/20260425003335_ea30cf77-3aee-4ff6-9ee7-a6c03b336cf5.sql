-- Lot 5 — Fallback "tarif zone" pour le checkout transitaire
ALTER TABLE public.freight_quotes
  ADD COLUMN IF NOT EXISTS requires_manual_assignment boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS zone_fallback_amount numeric NULL;

-- Index partiel pour la vue admin "commandes en attente de transitaire"
CREATE INDEX IF NOT EXISTS idx_freight_quotes_manual_assignment
  ON public.freight_quotes (created_at DESC)
  WHERE requires_manual_assignment = true;