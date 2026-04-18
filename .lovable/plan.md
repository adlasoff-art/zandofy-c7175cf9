

L'utilisateur veut les 3 options : walkthrough visuel + activation popups + moteur d'envoi email/push. Je structure le plan en 3 phases claires.

## Plan complet — Activation de l'automation marketing

### Phase 1 — Walkthrough visuel (Option C, immédiat, 0 dev)

Je te guide pas à pas pour trouver et utiliser l'écran admin :

**Accès :**
1. Connecte-toi sur `https://zandofy.com` avec ton compte admin
2. Va dans **Admin** (sidebar de gauche) → **Popups & Cookies**
3. URL directe : `https://zandofy.com/admin/popups`
4. Clique sur l'onglet **"Automations"** (icône éclair ⚡, entre "Annonces commerciales" et "Gestion cookies")

**Ce que tu verras :**
- Liste des 13 workflows pré-créés (J0 Bienvenue, J1 Découverte, J3 Premier achat, J7 Relance, J14, J21, J30, etc.)
- Chaque ligne avec : nom, déclencheur, canal (popup/push/email), délai, statut (toggle on/off)
- Flèche pour déplier et voir/éditer le contenu (titre, image, CTA, sujet email, message push)
- Bouton "+ Nouveau workflow" en haut à droite

### Phase 2 — Activation popups (Option A, 0 dev)

Pour tes ~50 nouveaux clients de la semaine :

1. **Identifier les workflows pertinents** pour leur ancienneté (≤ 7 jours) :
   - "J0 - Bienvenue après inscription"
   - "J1 - Découverte catalogue"
   - "J3 - Premier achat - Code promo"
   - "J7 - Relance pas encore commandé"

2. **Pour chaque workflow** : déplier → vérifier le contenu (titre, image, lien CTA) → ajuster si besoin → activer le toggle

3. **Effet immédiat** : dès la prochaine visite des clients éligibles, le popup s'affiche selon les conditions (anti-spam : 1x/session ou 1x total selon `display_frequency`)

**Aucun risque** : le système exclut automatiquement les utilisateurs déjà ciblés (table `automation_user_progress`).

### Phase 3 — Moteur d'envoi email/push (Option B, dev nécessaire)

Pour que les workflows avec canal `email`, `push`, `popup_push`, `push_email` ou `all` envoient réellement les notifications (et pas seulement les popups) :

#### Nouveau edge function : `process-automation-workflows`

**Fonction** : Cron job déclenché toutes les heures qui :
1. Liste les workflows actifs avec channel ≠ `popup`
2. Pour chaque workflow, identifie les utilisateurs éligibles :
   - Conditions remplies (`condition_has_account`, `condition_has_order`, `condition_max_days_since_signup`)
   - Délai écoulé (`delay_days` depuis signup ou trigger)
   - Pas encore traité (vérification dans `automation_user_progress`)
   - Respect de `display_frequency` et `max_displays`
3. Pour chaque utilisateur éligible :
   - Si canal inclut `email` → appel `send-transactional-email` avec template du workflow
   - Si canal inclut `push` → appel `push-notifications` avec titre/message du workflow
   - Insert dans `automation_user_progress` (status `sent`)

#### Planification pg_cron

Job SQL toutes les heures :
```sql
SELECT cron.schedule(
  'process-automation-hourly',
  '0 * * * *',
  $$ SELECT net.http_post(
    url := 'https://vpttoqojmiqxgudknyxf.supabase.co/functions/v1/process-automation-workflows',
    headers := '{"Authorization": "Bearer <ANON_KEY>"}'::jsonb
  ) $$
);
```

#### Sécurités intégrées

- **Idempotence** : un utilisateur ne reçoit jamais 2x le même workflow (clé unique `(user_id, workflow_id)` dans `automation_user_progress`)
- **Rate limit SMTP** : batching 10 emails / 20 min (déjà géré par `send-transactional-email`)
- **Logs** : chaque envoi est tracé dans `automation_user_progress` avec `status` et `last_displayed_at`
- **Désactivation propre** : suffit de couper le toggle d'un workflow → le cron l'ignore

#### Fichiers à créer/modifier

- `frontend/supabase/functions/process-automation-workflows/index.ts` (nouveau, ~250 lignes)
- `frontend/supabase/config.toml` : ajouter bloc `[functions.process-automation-workflows]` avec `verify_jwt = false`
- Migration SQL : création du cron job pg_cron (à appliquer une seule fois en prod)

### Ordre d'exécution proposé

1. **Aujourd'hui** : tu suis le walkthrough Phase 1, tu actives les popups Phase 2 → effet immédiat sur tes 50 clients
2. **Cette semaine** : je code Phase 3, tu pushes via GitHub Actions, tu actives le cron en prod → les emails/push partent automatiquement

### Ce que je NE ferai pas

- Aucune modification des 13 workflows existants (contenu, conditions)
- Aucune nouvelle table en base
- Aucun changement sur Lovable Cloud
- Aucune modification du hook `useAutomation` (popups continuent de marcher en parallèle)

### Décision attendue

Confirme et je passe en exécution mode default :
1. Création de `process-automation-workflows/index.ts`
2. Ajout du bloc dans `config.toml`
3. Création de la migration `cron.schedule` (à appliquer après push via Actions)
4. Je te donne les instructions précises pour activer les workflows côté admin

