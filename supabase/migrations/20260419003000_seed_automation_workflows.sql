-- Seed 13 pre-defined automation workflows (J0 → J30)
-- Idempotent: uses ON CONFLICT (name) DO NOTHING. All workflows are_active = false by default.

-- Ensure name is unique to support ON CONFLICT
CREATE UNIQUE INDEX IF NOT EXISTS automation_workflows_name_unique
  ON public.automation_workflows (name);

INSERT INTO public.automation_workflows (
  name, trigger_type, channel, delay_days, delay_minutes,
  condition_has_account, condition_has_order, condition_max_days_since_signup,
  display_frequency, max_displays, is_active, sort_order,
  popup_title, popup_content, popup_image_url, popup_cta_label, popup_cta_link,
  push_title, push_body,
  email_subject, email_html_content
) VALUES
-- 1. J0 — Bienvenue visite (popup)
('J0 - Bienvenue visite', 'visit_no_account', 'popup', 0, 0,
  false, null, null, 'once_per_session', 1, false, 10,
  'Bienvenue chez Zandofy 👋', 'Découvrez la marketplace sino-africaine premium. Inscrivez-vous et recevez 5% sur votre 1ère commande.', null, 'Créer mon compte', '/auth',
  null, null, null, null),

-- 2. J0 — Bienvenue inscription (email)
('J0 - Bienvenue inscription', 'account_created', 'email', 0, 5,
  true, null, 1, 'once', 1, false, 20,
  null, null, null, null, null,
  null, null,
  'Bienvenue chez Zandofy 🎉',
  '<h2>Bienvenue !</h2><p>Merci d''avoir rejoint Zandofy. Découvrez nos produits sélectionnés depuis la Chine, la Turquie et Dubaï.</p><p><a href="https://zandofy.com/products">Explorer le catalogue</a></p>'),

-- 3. J1 — Découverte catalogue (push)
('J1 - Découverte catalogue', 'visit_no_order', 'push', 1, 0,
  true, false, 7, 'once', 1, false, 30,
  null, null, null, null, null,
  'Avez-vous vu nos nouveautés ?', 'Plus de 1000 produits livrables chez vous cette semaine.',
  null, null),

-- 4. J3 — Premier achat code promo (popup + email)
('J3 - Premier achat -5%', 'no_order_delay', 'popup_push', 3, 0,
  true, false, 7, 'once', 1, false, 40,
  'Code promo BIENVENUE5 🎁', 'Profitez de -5% sur votre première commande. Code valable 48h.', null, 'Utiliser mon code', '/products',
  'BIENVENUE5 : -5% sur votre 1ère commande', 'Code valable 48h. À utiliser au checkout.',
  null, null),

-- 5. J5 — Relance produits vus (push)
('J5 - Produits vus', 'product_viewed_no_order', 'push', 5, 0,
  true, false, 14, 'once', 1, false, 50,
  null, null, null, null, null,
  'Vos produits favoris attendent', 'Revenez finaliser votre sélection sur Zandofy.',
  null, null),

-- 6. J7 — Pas encore commandé (email)
('J7 - Relance pas commandé', 'no_order_delay', 'email', 7, 0,
  true, false, 14, 'once', 1, false, 60,
  null, null, null, null, null,
  null, null,
  'Toujours indécis ? On vous aide 🛍️',
  '<h2>Besoin d''un coup de pouce ?</h2><p>Nos meilleurs articles du moment vous attendent. Frais de livraison locale offerts dès $50.</p><p><a href="https://zandofy.com/products">Voir les bestsellers</a></p>'),

-- 7. J10 — Témoignages clients (popup)
('J10 - Témoignages', 'no_order_delay', 'popup', 10, 0,
  true, false, 21, 'once', 1, false, 70,
  'Ils nous font confiance ⭐', 'Plus de 500 clients satisfaits en RDC. Lisez leurs avis vérifiés.', null, 'Voir les avis', '/about',
  null, null,
  null, null),

-- 8. J14 — Relance forte avec offre (email + push)
('J14 - Offre forte', 'no_order_delay', 'push_email', 14, 0,
  true, false, 30, 'once', 1, false, 80,
  null, null, null, null, null,
  '-10% pendant 24h ⏰', 'Code FLASH10 sur tout le catalogue. Aujourd''hui seulement.',
  '⏰ Dernière chance : -10% sur tout',
  '<h2>Offre flash 24h</h2><p>Code <strong>FLASH10</strong> à utiliser au checkout. Valable jusqu''à minuit.</p><p><a href="https://zandofy.com/products">J''en profite</a></p>'),

-- 9. J18 — Quartier livré (push)
('J18 - Quartier livré', 'no_order_delay', 'push', 18, 0,
  true, false, 30, 'once', 1, false, 90,
  null, null, null, null, null,
  'Livraison disponible chez vous 🏠', 'Nos livreurs couvrent maintenant votre quartier. Commandez sereinement.',
  null, null),

-- 10. J21 — Dernière chance offre (email)
('J21 - Dernière chance', 'no_order_delay', 'email', 21, 0,
  true, false, 30, 'once', 1, false, 100,
  null, null, null, null, null,
  null, null,
  'Dernière chance avant fermeture du compte 💌',
  '<h2>On ne veut pas vous perdre</h2><p>Profitez de -15% avec le code <strong>RESTEZ15</strong>. Offre personnelle valable 7 jours.</p><p><a href="https://zandofy.com/products">Profiter de l''offre</a></p>'),

-- 11. J25 — Sondage motivations (popup)
('J25 - Sondage', 'no_order_delay', 'popup', 25, 0,
  true, false, 30, 'once', 1, false, 110,
  'Aidez-nous à nous améliorer 💬', 'Pourquoi n''avez-vous pas encore commandé ? 30 secondes pour répondre.', null, 'Donner mon avis', '/contact',
  null, null,
  null, null),

-- 12. J30 — Désabonnement soft (email)
('J30 - Désabonnement soft', 'no_order_delay', 'email', 30, 0,
  true, false, 45, 'once', 1, false, 120,
  null, null, null, null, null,
  null, null,
  'On se reverra bientôt ? 👋',
  '<h2>Au revoir (provisoire)</h2><p>Nous arrêtons les emails marketing pour ne pas vous déranger. Votre compte reste actif.</p><p><a href="https://zandofy.com">Revenir quand vous voulez</a></p>'),

-- 13. J7 événementiel — Compte sans 1ère commande
('J7 événementiel - Compte sans achat', 'account_created', 'email', 7, 0,
  true, false, 7, 'once', 1, false, 130,
  null, null, null, null, null,
  null, null,
  'Votre compte Zandofy vous attend 🎁',
  '<h2>Bonjour !</h2><p>Vous avez créé votre compte il y a 7 jours. Pour vous remercier, voici un code <strong>WELCOME7</strong> de -7% sur votre 1ère commande.</p><p><a href="https://zandofy.com/products">Découvrir le catalogue</a></p>')

ON CONFLICT (name) DO NOTHING;
