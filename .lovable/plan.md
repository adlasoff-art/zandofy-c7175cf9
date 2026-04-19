

## Diagnostic

Le tab `AdminAutomationsTab` actuel a 3 limites :
1. **Pas d'édition** des workflows existants (uniquement toggle on/off + suppression). Les 13 workflows pré-créés J0-J30 contiennent des messages que tu ne peux ni voir en entier, ni modifier.
2. **Aucune visibilité** sur ce qui s'est passé : combien d'emails envoyés, ouverts, cliqués ; combien de popups affichés, cliqués, fermés ; quels users ont "obéi" (créé compte / commandé) après réception.
3. **Aucun onglet Analytics** dédié dans la page Marketing (`/admin/popups` ne contient que Popups, Cookies, Automations).

La table `automation_user_progress` capture déjà `display_count`, `last_displayed_at`, `status`, `sent_at` — c'est une bonne base mais il manque les événements de clic et de conversion.

## Ce que je propose — 3 chantiers

### Chantier 1 — Édition complète des workflows (priorité haute)

Transformer chaque carte workflow en mode "expand → edit inline" :
- Clic sur la carte → déplie le formulaire complet pré-rempli avec toutes les valeurs actuelles
- Bouton "Enregistrer" qui fait un `UPDATE` sur la ligne
- Bouton "Aperçu" qui montre le rendu popup/email tel qu'il sera affiché au client
- Tu pourras ainsi voir et modifier les 13 workflows pré-créés (titre, contenu, CTA, sujet email, HTML email, push body, délais, conditions)

Réutilise le composant `renderFormFields` qui existe déjà — pas de duplication de code.

### Chantier 2 — Tracking des événements (popup + email + conversion)

**Nouvelle table `automation_events`** :
```text
id | workflow_id | user_id | anon_id | event_type | metadata | created_at
```
Types d'événements captés :
- `delivered_popup` — popup affiché côté client
- `delivered_email` — email envoyé via SMTP (succès)
- `failed_email` — bounce / erreur SMTP
- `delivered_push` — push poussé au navigateur
- `clicked_popup_cta` — clic sur le bouton CTA du popup
- `clicked_email_link` — clic sur lien dans l'email (via redirect tracker)
- `dismissed_popup` — utilisateur ferme sans cliquer
- `converted_signup` — user a créé un compte dans les 7j après réception
- `converted_order` — user a passé commande dans les 14j après réception

**Instrumentation** :
- `AutomationPopup.tsx` : log `delivered_popup` à l'ouverture, `clicked_popup_cta` au clic, `dismissed_popup` à la fermeture
- `process-automation` edge function : log `delivered_email` / `failed_email` selon retour SMTP, `delivered_push` selon retour push
- Email tracking pixel + redirect : nouvelle edge `track-automation-click` qui log et redirige vers le vrai lien CTA
- Trigger SQL sur `profiles` (INSERT) et `orders` (INSERT) qui regarde si un workflow a été délivré récemment au user → log `converted_signup` / `converted_order`

### Chantier 3 — Nouvel onglet "Analytics" dans `/admin/popups`

Ajouter un 4ème onglet à côté de Popups / Cookies / Automations :

```text
┌────────────────────────────────────────────────────────────┐
│ Onglet : Analytics workflows                               │
├────────────────────────────────────────────────────────────┤
│ Filtres : [Workflow ▼] [Période 7j/30j/90j ▼]             │
│                                                            │
│ KPI cards (par workflow ou tous) :                        │
│  • Délivrés : 1240    • Taux clic : 8.4%                  │
│  • Ouverts : 612      • Conversions : 47                  │
│  • Échecs : 23        • Taux conversion : 3.8%            │
│                                                            │
│ Graphique ligne : événements par jour (delivered/clicked/ │
│ converted)                                                 │
│                                                            │
│ Tableau "Performance par workflow" :                      │
│ ┌──────────┬──────────┬───────┬───────┬──────────┐       │
│ │ Workflow │ Délivrés │ Clics │ Conv. │ Tx conv. │       │
│ ├──────────┼──────────┼───────┼───────┼──────────┤       │
│ │ J0 Bienv.│   523    │  47   │  12   │  2.3%    │       │
│ │ J7 Relan.│   210    │  31   │   8   │  3.8%    │       │
│ └──────────┴──────────┴───────┴───────┴──────────┘       │
│                                                            │
│ Tableau "Parcours utilisateur" (paginé 50/page) :         │
│ ┌────────────┬──────────┬────────────┬────────────┐      │
│ │ User/Anon  │ Workflow │ Reçu le    │ Action     │      │
│ ├────────────┼──────────┼────────────┼────────────┤      │
│ │ amina@...  │ J0 Bienv │ 12/04 14h  │ ✅ Compte  │      │
│ │ anon-a3f.. │ J0 Bienv │ 12/04 09h  │ ❌ Aucune  │      │
│ │ paul@...   │ J7 Relan │ 11/04 18h  │ ✅ Commande│      │
│ └────────────┴──────────┴────────────┴────────────┘      │
└────────────────────────────────────────────────────────────┘
```

Données alimentées par 2 RPC SQL côté Supabase (rapide, pas de N+1) :
- `get_automation_kpis(workflow_id?, since)` → un objet jsonb avec totaux
- `get_automation_user_journey(workflow_id?, since, limit, offset)` → liste paginée

## Comportement final en production

- Admin clique workflow "J0 Bienvenue" → la carte se déplie, tous les champs sont éditables, "Enregistrer" → mis à jour en 1 sec
- Client visite le site → popup s'affiche → événement `delivered_popup` loggé → si clic CTA → `clicked_popup_cta` loggé → si signup dans 7j → `converted_signup` loggé automatiquement par trigger
- Admin va dans onglet Analytics → voit en temps réel "523 popups délivrés, 47 clics (9%), 12 comptes créés (2.3% conversion)"
- Pour les emails : le lien CTA passe par `track-automation-click?to=...&w=workflow_id` qui log puis redirige

## Ce que je ne ferai pas

- Pas de refonte du moteur de matching `use-automation.ts` (déjà solide)
- Pas de modification des 13 workflows existants — tu les modifieras toi-même via la nouvelle UI d'édition
- Pas de tracking d'ouverture email (nécessite pixel + désanonymisation, RGPD complexe) — on se limite à `delivered` (envoi SMTP réussi) et `clicked` (clic réel sur lien)
- Pas de système A/B testing (à envisager dans une v2 si besoin)

## Fichiers à créer / modifier

**Nouveaux**
- Migration SQL : table `automation_events` + RLS + 2 fonctions RPC + 2 triggers conversion
- `frontend/supabase/functions/track-automation-click/index.ts` — log + redirect
- `frontend/src/components/admin/AdminAutomationAnalyticsTab.tsx` — nouvel onglet

**Modifiés**
- `frontend/src/components/admin/AdminAutomationsTab.tsx` — ajouter mode édition inline + aperçu
- `frontend/src/pages/admin/AdminPopupsPage.tsx` — ajouter le 4ème onglet "Analytics"
- `frontend/src/components/AutomationPopup.tsx` — log événements click/dismiss
- `frontend/src/hooks/use-automation.ts` — log `delivered_popup` (déplacer la logique de tracking ici)
- `frontend/supabase/functions/process-automation/index.ts` — log `delivered_email` / `failed_email` / `delivered_push` + remplacer les liens CTA email par le lien tracker

## Décision attendue

Confirme et je passe en default mode pour livrer les 3 chantiers ensemble (dans cet ordre : édition workflows → tracking → analytics). 

**Question rapide avant** : pour le tracking de conversion, tu veux quelle fenêtre d'attribution ?
- **A** : 7j signup / 14j commande (recommandé, standard marketing)
- **B** : 14j signup / 30j commande (plus généreux, attribue plus de conversions)
- **C** : configurable par workflow (plus flexible mais ajoute un champ à éditer)

