

User m'a donné le project URL staging : `wgidwyrdnboivfphwete.supabase.co`. Je dois générer le fichier SQL pré-rempli pour staging. Reste à obtenir la clé anon staging — soit je la demande, soit je laisse un placeholder clair.

Je vais générer le fichier avec l'URL staging hardcodée et un placeholder `<STAGING_ANON_KEY>` à remplacer (la clé anon est différente entre prod et staging et je ne dois pas la deviner). C'est cohérent avec l'approche déjà utilisée pour le fichier prod.

## Fichier à créer

`frontend/supabase/migrations/MANUAL_expire-pending-orders-cron-STAGING.sql` — copie identique de la version prod, mais avec :
- URL : `https://wgidwyrdnboivfphwete.supabase.co/functions/v1/expire-pending-orders`
- Placeholder `<STAGING_ANON_KEY>` à remplacer manuellement avant exécution
- Nom du job différent : `expire-pending-orders-every-min-staging` (pour éviter toute confusion si tu inspectes la table `cron.job` plus tard)

## Étapes côté toi (staging)

1. Ouvrir Supabase staging → Settings → API → copier la clé `anon public`
2. Télécharger le fichier généré
3. Remplacer `<STAGING_ANON_KEY>` par la vraie clé
4. Coller dans le SQL Editor staging → Run
5. Vérifier avec :
   ```sql
   SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'expire-pending-orders-every-min-staging';
   ```

## Test fonctionnel en staging

- Lancer une commande mobile money de test
- Ne pas valider, attendre 6-7 minutes
- Vérifier dans `cron.job_run_details` que le job a tourné sans erreur HTTP
- Vérifier que la commande est passée en `payment_failed`
- Si OK → tu pourras appliquer la version prod en confiance

## Ce que je NE ferai pas

- Pas de modification de l'edge function `expire-pending-orders` (déjà en place)
- Pas de hardcoding de la clé anon dans le fichier (sécurité)
- Pas d'exécution automatique du SQL (tu gardes le contrôle manuel sur staging et prod)

Approuve et je génère le fichier `MANUAL_expire-pending-orders-cron-STAGING.sql` téléchargeable.

