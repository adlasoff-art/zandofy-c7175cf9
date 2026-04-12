
ALTER TABLE public.pwa_installs ADD COLUMN IF NOT EXISTS device_id TEXT;
ALTER TABLE public.pwa_installs ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_pwa_installs_device_id ON public.pwa_installs (device_id) WHERE device_id IS NOT NULL;
