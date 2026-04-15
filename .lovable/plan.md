

# Automation Marketing — Plan prudent pour Production

## Contexte critique
- 33+ utilisateurs actifs, plateforme en production sur Vercel
- Pas de branche staging pour le moment, push direct en production
- Infrastructure existante : `cms_popups`, `scheduled_campaigns`, `push-notifications`, `run-campaign`, SMTP via Hostinger

## Strategie de securite

**Principe** : tout est inactif par defaut. Les nouvelles tables et le nouveau code ne declenchent rien tant que l'admin n'active pas explicitement un workflow. Les 33 utilisateurs existants ne verront aucun changement immediatement apres le deploiement.

---

## Phase 1 — Migration SQL (fichier telechargeble fourni)

### Table `automation_workflows`
Configuration des sequences, creee par l'admin :
- `trigger_type` : enum (`visit_no_account`, `account_created`, `visit_no_order`, `product_viewed_no_order`, `no_order_delay`, `referral_prompt`, `custom`)
- `delay_days`, `delay_minutes` : quand declencher apres le trigger
- `channel` : enum (`popup`, `push`, `email`, `popup_push`, `push_email`, `all`)
- Conditions : `condition_has_account`, `condition_has_order`, `condition_max_days_since_signup`
- Contenu popup : `popup_title`, `popup_content`, `popup_image_url`, `popup_cta_label`, `popup_cta_link`
- Contenu push : `push_title`, `push_body`
- Contenu email : `email_subject`, `email_html_content`
- `display_frequency` : `every_visit`, `once`, `daily`, `once_per_session`
- `is_active` default **false** — rien ne se declenche sans activation manuelle
- RLS : admin full CRUD, lecture publique SELECT pour les popups actifs uniquement

### Table `automation_user_progress`
Suivi individuel par utilisateur :
- `user_id` (nullable pour visiteurs anonymes)
- `anon_id` (text, pour tracking localStorage des visiteurs)
- `workflow_id` FK
- `display_count`, `last_displayed_at`, `status`
- RLS : users voient leurs propres entrees, service role pour l'Edge Function

**Impact sur les utilisateurs existants** : zero. Les tables sont vides au deploiement.

---

## Phase 2 — Frontend : `AutomationPopup.tsx`

Nouveau composant monte dans `App.tsx` a cote de `AnnouncementPopup` :
- Au chargement, recupere les workflows actifs de type popup
- Evalue les conditions cote client :
  - Utilisateur connecte ? → verifie `condition_has_account`
  - A passe commande ? → verifie via query legere sur `orders`
  - Jours depuis inscription ? → calcule depuis `profiles.created_at`
  - Visiteur anonyme ? → `localStorage` pour `anon_id` et tracking
- Respecte `display_frequency` et `max_displays`
- Enregistre les affichages dans `automation_user_progress`
- Design coherent avec `AnnouncementPopup` existant (Dialog, image, CTA)

**Garde-fou** : si aucun workflow popup actif, le composant ne fait aucune requete supplementaire (early return).

---

## Phase 3 — Edge Function : `process-automation`

- Declenchee par pg_cron toutes les 5 minutes
- Traite les workflows push/email avec delay :
  1. Identifie les utilisateurs eligibles (date de creation du compte, commandes, produits vus)
  2. Exclut ceux deja traites via `automation_user_progress`
  3. Envoie push via `push_subscriptions` existantes
  4. Envoie email via SMTP existant (Hostinger)
  5. **Stagger de 2-3 min entre chaque email** pour proteger la reputation du domaine
  6. Enregistre dans `automation_user_progress`

**Impact** : la function ne fait rien tant qu'aucun workflow n'est active par l'admin.

---

## Phase 4 — Admin : onglet Automations

Ajout dans la page existante `AdminPopupsPage` (nouvel onglet "Automations") plutot qu'une nouvelle page, pour minimiser les changements de routing :
- Liste des workflows avec toggle on/off
- Formulaire : trigger, delai, canaux, conditions, contenu par canal
- Upload image pour popup (bucket existant)
- Stats basiques (envoyes, affiches) depuis `automation_user_progress`

---

## Plan d'onboarding 30 jours pre-configure

Les workflows suivants seront crees en base comme **inactifs** — l'admin les active quand il est pret :

| Jour | Trigger | Canal | Message type |
|------|---------|-------|-------------|
| J0 | Visite sans compte | Popup | Creez votre compte, -10% |
| J0+5min | Creation compte | Popup+Push | Bienvenue, achetez dans 30min |
| J0 recurrent | Visite sans commande | Popup | Vous allez rater -10% |
| J2 | Produit vu sans achat | Push+Email | Le produit est encore dispo |
| J4 | Pas de commande | Push+Email | Parrainez, gagnez des points |
| J6 | Pas de commande | Email | Derniere chance -10% |
| J9 | Pas de commande | Push | Best-sellers de la semaine |
| J12 | Pas de commande | Email+Push | Reduction expire bientot |
| J15 | Pas de commande | Push | Nouveautes pour vous |
| J18 | Pas de commande | Email | On vous manque |
| J22 | Pas de commande | Push | Installez l'app |
| J26 | Pas de commande | Email+Push | Derniers jours cadeau bienvenue |
| J30 | Fin periode | Email | Merci, voici la suite |

---

## Fichiers concernes

| Action | Fichier |
|--------|---------|
| Migration SQL | `automation_workflows`, `automation_user_progress` + fichier .sql telechargeble |
| Edge Function | `frontend/supabase/functions/process-automation/index.ts` |
| Composant | `frontend/src/components/AutomationPopup.tsx` |
| Hook | `frontend/src/hooks/use-automation.ts` |
| Admin | `frontend/src/pages/admin/AdminPopupsPage.tsx` (nouvel onglet) |
| App | `frontend/src/App.tsx` (import AutomationPopup) |
| Config | `frontend/supabase/config.toml` (process-automation, verify_jwt=false) |

## Garanties de securite

1. **Zero impact au deploiement** : toutes les tables sont vides, tous les workflows inactifs
2. **Pas de nouvelle route admin** : onglet dans la page Popups existante
3. **Fichier SQL fourni** : pour synchronisation manuelle staging/production
4. **Stagger email** : protection reputation domaine Hostinger
5. **Pas de modification** des tables existantes (`cms_popups`, `scheduled_campaigns`, `profiles`, `orders`)
6. **RLS stricte** : admin seul peut CRUD les workflows

