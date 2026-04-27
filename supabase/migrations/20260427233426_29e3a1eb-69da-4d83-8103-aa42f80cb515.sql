-- Planification automatique des rapports analytics
SELECT cron.schedule(
  'process-vendor-analytics-emails-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://uogkklwfvwoxkifpkzpu.supabase.co/functions/v1/process-vendor-analytics-emails',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZ2trbHdmdndveGtpZnBrenB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4ODY0MzcsImV4cCI6MjA4NzQ2MjQzN30.9NhIOytfsQ7Gdufs0goV6Lk97IyMkda362jh3IGMVi4'),
    body := jsonb_build_object('triggered_at', now())
  );
  $$
)
WHERE NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-vendor-analytics-emails-hourly');