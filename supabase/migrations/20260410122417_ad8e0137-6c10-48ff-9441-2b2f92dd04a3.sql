
-- Add token_hash column
ALTER TABLE public.impersonation_tokens ADD COLUMN IF NOT EXISTS token_hash TEXT;

-- Make token nullable only if the legacy column still exists (may already be dropped in prod)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'impersonation_tokens'
      AND column_name = 'token'
  ) THEN
    ALTER TABLE public.impersonation_tokens ALTER COLUMN token DROP NOT NULL;
    UPDATE public.impersonation_tokens SET token = NULL WHERE token IS NOT NULL;
  END IF;
END $$;

-- Create unique index on token_hash
CREATE UNIQUE INDEX IF NOT EXISTS idx_impersonation_tokens_hash ON public.impersonation_tokens (token_hash) WHERE token_hash IS NOT NULL;
