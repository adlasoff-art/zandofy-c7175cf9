
-- Table pour la tokenisation des cartes bancaires
CREATE TABLE IF NOT EXISTS public.saved_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider text NOT NULL DEFAULT 'keccel',
  card_token text NOT NULL,
  last_four text NOT NULL,
  card_brand text,
  expiry_month int,
  expiry_year int,
  is_default boolean DEFAULT false,
  label text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.saved_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own cards" ON public.saved_cards;
CREATE POLICY "Users read own cards" ON public.saved_cards FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users insert own cards" ON public.saved_cards;
CREATE POLICY "Users insert own cards" ON public.saved_cards FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users update own cards" ON public.saved_cards;
CREATE POLICY "Users update own cards" ON public.saved_cards FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users delete own cards" ON public.saved_cards;
CREATE POLICY "Users delete own cards" ON public.saved_cards FOR DELETE USING (user_id = auth.uid());

-- Trigger updated_at
CREATE TRIGGER update_saved_cards_updated_at
BEFORE UPDATE ON public.saved_cards
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Colonne card_token_id sur payment_transactions
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS card_token_id uuid REFERENCES public.saved_cards(id);

-- Colonne payment_type sur payment_transactions (si absente)
ALTER TABLE public.payment_transactions ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'order';
