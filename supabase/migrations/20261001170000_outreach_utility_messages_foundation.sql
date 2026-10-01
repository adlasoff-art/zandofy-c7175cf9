-- Purpose: Outreach multi-canal foundation — utility message templates, send log,
--          profile WhatsApp opt-in, outreach_config, automation template_id link.
-- Additive only. WhatsApp Cloud stays OFF until Meta number + secrets configured.
-- Staging → production: apply after commit; smoke /admin/notifications + /admin/users.
-- Rollback: DROP tables/columns below (prefer keep).

-- ---------------------------------------------------------------------------
-- 1) utility_message_templates
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.utility_message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  label text NOT NULL,
  audience text NOT NULL DEFAULT 'all'
    CHECK (audience IN ('customer', 'vendor', 'all')),
  category text NOT NULL DEFAULT 'utility'
    CHECK (category IN ('utility', 'marketing', 'auth')),
  channels text[] NOT NULL DEFAULT ARRAY['email', 'push', 'in_app', 'whatsapp_me']::text[],
  email_subject text,
  email_html text,
  push_title text,
  push_body text,
  in_app_title text,
  in_app_message text,
  whatsapp_body text,
  whatsapp_cloud_template_name text,
  whatsapp_cloud_language text DEFAULT 'fr',
  variables jsonb NOT NULL DEFAULT '["name","cta_url"]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT utility_message_templates_slug_unique UNIQUE (slug)
);

COMMENT ON TABLE public.utility_message_templates IS
  'Reusable utility/marketing message bodies for email, push, in-app, wa.me, WhatsApp Cloud templates.';

CREATE INDEX IF NOT EXISTS idx_utility_message_templates_active
  ON public.utility_message_templates (is_active, sort_order);

ALTER TABLE public.utility_message_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage utility message templates" ON public.utility_message_templates;
CREATE POLICY "Staff manage utility message templates"
  ON public.utility_message_templates
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.utility_message_templates TO authenticated;
GRANT ALL ON public.utility_message_templates TO service_role;

-- ---------------------------------------------------------------------------
-- 2) outreach_send_log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.outreach_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  template_id uuid REFERENCES public.utility_message_templates(id) ON DELETE SET NULL,
  channel text NOT NULL
    CHECK (channel IN ('email', 'push', 'in_app', 'whatsapp_me', 'whatsapp_cloud')),
  status text NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'opened', 'failed', 'skipped', 'disabled')),
  actor_admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_send_log_user_created
  ON public.outreach_send_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outreach_send_log_actor_created
  ON public.outreach_send_log (actor_admin_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outreach_send_log_template
  ON public.outreach_send_log (template_id, created_at DESC);

ALTER TABLE public.outreach_send_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read outreach send log" ON public.outreach_send_log;
CREATE POLICY "Staff read outreach send log"
  ON public.outreach_send_log
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  );

DROP POLICY IF EXISTS "Staff insert outreach send log" ON public.outreach_send_log;
CREATE POLICY "Staff insert outreach send log"
  ON public.outreach_send_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  );

GRANT SELECT, INSERT ON public.outreach_send_log TO authenticated;
GRANT ALL ON public.outreach_send_log TO service_role;

-- ---------------------------------------------------------------------------
-- 3) profiles: WhatsApp opt-in + E.164 phone (nullable)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone_e164 text,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in_at timestamptz;

COMMENT ON COLUMN public.profiles.phone_e164 IS
  'Normalized WhatsApp digits (country code, no +). Optional; may be derived from phone.';
COMMENT ON COLUMN public.profiles.whatsapp_opt_in IS
  'Explicit opt-in for WhatsApp Cloud marketing templates.';

-- ---------------------------------------------------------------------------
-- 4) automation_workflows: optional template link + send-window override
-- ---------------------------------------------------------------------------
ALTER TABLE public.automation_workflows
  ADD COLUMN IF NOT EXISTS template_id uuid
    REFERENCES public.utility_message_templates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ignore_send_window boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_automation_workflows_template_id
  ON public.automation_workflows (template_id)
  WHERE template_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 5) outreach_config platform setting
-- ---------------------------------------------------------------------------
INSERT INTO public.platform_settings (key, value)
VALUES (
  'outreach_config',
  jsonb_build_object(
    'whatsapp_cloud_enabled', false,
    'default_send_window', jsonb_build_object(
      'start_hour', 18,
      'end_hour', 19,
      'timezone', 'Africa/Kinshasa'
    ),
    'whatsapp_me_rate_limit_per_admin_hour', 30
  )
)
ON CONFLICT (key) DO UPDATE
SET value = COALESCE(public.platform_settings.value, '{}'::jsonb)
  || EXCLUDED.value;

-- ---------------------------------------------------------------------------
-- 6) Seed utility templates (idempotent on slug)
-- ---------------------------------------------------------------------------
INSERT INTO public.utility_message_templates (
  slug, label, audience, category, channels,
  email_subject, email_html,
  push_title, push_body,
  in_app_title, in_app_message,
  whatsapp_body,
  whatsapp_cloud_template_name, whatsapp_cloud_language,
  variables, is_active, sort_order
) VALUES
(
  'welcome_signup',
  'Bienvenue inscription',
  'customer',
  'utility',
  ARRAY['email', 'push', 'in_app', 'whatsapp_me', 'whatsapp_cloud']::text[],
  'Bienvenue chez Zandofy 🎉',
  '<h2>Bienvenue {{name}} !</h2><p>Merci d''avoir rejoint Zandofy. Explorez le catalogue et trouvez vos prochaines trouvailles.</p><p><a href="{{cta_url}}">Découvrir Zandofy</a></p>',
  'Bienvenue chez Zandofy',
  'Votre compte est prêt. Explorez le catalogue dès maintenant.',
  'Bienvenue !',
  'Votre compte Zandofy est actif. Parcourez les nouveautés et trouvez ce qu''il vous faut.',
  'Bonjour {{name}} 👋 Bienvenue sur Zandofy ! Découvrez le catalogue ici : {{cta_url}}',
  'welcome_signup',
  'fr',
  '["name","cta_url"]'::jsonb,
  true,
  10
),
(
  'welcome_no_email_push',
  'Bienvenue sans email (push)',
  'customer',
  'utility',
  ARRAY['push', 'in_app', 'whatsapp_me']::text[],
  NULL,
  NULL,
  'Bienvenue sur Zandofy',
  'Activez votre exploration : nouveautés et offres vous attendent.',
  'Bienvenue',
  'Pas d''email renseigné — voici un rappel pour revenir sur Zandofy et découvrir les produits.',
  'Bonjour {{name}}, bienvenue sur Zandofy ! Ouvrez l''app : {{cta_url}}',
  NULL,
  'fr',
  '["name","cta_url"]'::jsonb,
  true,
  20
),
(
  'inactive_j2',
  'Relance inactivité J+2',
  'all',
  'marketing',
  ARRAY['email', 'push', 'in_app', 'whatsapp_me', 'whatsapp_cloud']::text[],
  'On vous a manqué sur Zandofy',
  '<h2>Rebonjour {{name}}</h2><p>Cela fait un moment. Voici une sélection pour vous relancer.</p><p><a href="{{cta_url}}">Revenir sur Zandofy</a></p>',
  'Revenez sur Zandofy',
  'De nouveaux articles vous attendent. Jetez un œil aujourd''hui.',
  'Vous nous manquez',
  'Passez voir les nouveautés — votre espace Zandofy vous attend.',
  'Bonjour {{name}}, cela fait 2 jours. Revenez voir Zandofy : {{cta_url}}',
  'inactive_j2',
  'fr',
  '["name","cta_url"]'::jsonb,
  true,
  30
),
(
  'browse_promo',
  'Promo / nouveautés',
  'customer',
  'marketing',
  ARRAY['email', 'push', 'in_app', 'whatsapp_me', 'whatsapp_cloud']::text[],
  'Nouveautés & offres Zandofy',
  '<h2>Nouveautés pour vous</h2><p>Découvrez les arrivages et promotions du moment.</p><p><a href="{{cta_url}}">Voir les offres</a></p>',
  'Nouveautés Zandofy',
  'Des articles frais viennent d''arriver. À découvrir.',
  'Nouveautés',
  'Des promotions et arrivages viennent d''être publiés.',
  'Bonjour {{name}}, nouveautés & promos sur Zandofy : {{cta_url}}',
  'browse_promo',
  'fr',
  '["name","cta_url"]'::jsonb,
  true,
  40
),
(
  'cart_nudge',
  'Rappel panier (préparé, trigger plus tard)',
  'customer',
  'marketing',
  ARRAY['email', 'push', 'in_app', 'whatsapp_me']::text[],
  'Votre panier vous attend',
  '<h2>{{name}}, votre panier est prêt</h2><p>Finalisez quand vous voulez — les articles peuvent partir vite.</p><p><a href="{{cta_url}}">Reprendre mon panier</a></p>',
  'Panier en attente',
  'Des articles sont encore dans votre panier. Terminez la commande en un clic.',
  'Panier abandonné',
  'Vous avez laissé des articles dans le panier. Reprenez là où vous en étiez.',
  'Bonjour {{name}}, votre panier Zandofy vous attend : {{cta_url}}',
  NULL,
  'fr',
  '["name","cta_url"]'::jsonb,
  true,
  50
)
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  audience = EXCLUDED.audience,
  category = EXCLUDED.category,
  channels = EXCLUDED.channels,
  email_subject = EXCLUDED.email_subject,
  email_html = EXCLUDED.email_html,
  push_title = EXCLUDED.push_title,
  push_body = EXCLUDED.push_body,
  in_app_title = EXCLUDED.in_app_title,
  in_app_message = EXCLUDED.in_app_message,
  whatsapp_body = EXCLUDED.whatsapp_body,
  whatsapp_cloud_template_name = COALESCE(EXCLUDED.whatsapp_cloud_template_name, public.utility_message_templates.whatsapp_cloud_template_name),
  whatsapp_cloud_language = EXCLUDED.whatsapp_cloud_language,
  variables = EXCLUDED.variables,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
