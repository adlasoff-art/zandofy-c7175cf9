
-- Add token_hash column
ALTER TABLE public.impersonation_tokens ADD COLUMN IF NOT EXISTS token_hash TEXT;

-- Make token nullable (we'll stop storing plaintext)
ALTER TABLE public.impersonation_tokens ALTER COLUMN token DROP NOT NULL;

-- Create unique index on token_hash
CREATE UNIQUE INDEX IF NOT EXISTS idx_impersonation_tokens_hash ON public.impersonation_tokens (token_hash) WHERE token_hash IS NOT NULL;

-- Clear any existing plaintext tokens for security
UPDATE public.impersonation_tokens SET token = NULL WHERE token IS NOT NULL;
