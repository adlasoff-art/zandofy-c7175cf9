

User a déjà exécuté en staging le script PROD avec juste l'URL changée. Donc en staging il existe déjà un cron job nommé `expire-pending-orders-every-min` (nom prod) qui pointe vers l'URL staging. Le nouveau script staging utilise un nom différent : `expire-pending-orders-every-min-staging`.

Si on exécute le nouveau script tel quel → on aura DEUX jobs qui tournent en parallèle (l'ancien + le nouveau) = double appel chaque minute = doublons inutiles mais pas dangereux (l'edge function est idempotente, elle ne re-fail pas un ordre déjà failed).

Réponse claire : ce que tu as fait fonctionne, mais il faut nettoyer pour éviter les doublons. Deux options.

## Réponse rapide

**Oui, ce que tu as fait suffit fonctionnellement** — le cron tourne déjà en staging avec la bonne URL. La fonction est appelée chaque minute, elle expire bien les commandes après 6 min. Pas besoin d'urgence.

**Mais il y a un détail à régler** : le script staging que je viens de générer utilise un nom de job différent (`expire-pending-orders-every-min-staging` au lieu de `expire-pending-orders-every-min`). Si tu l'exécutes tel quel, tu te retrouves avec **2 jobs cron qui tournent en parallèle** chaque minute → doublons d'appels HTTP (sans danger, mais inutile).

## Tu as 3 options — choisis la plus simple

### Option A — Ne rien faire (recommandé si tout marche)
Ton cron staging actuel fonctionne. Ignore le nouveau fichier `MANUAL_expire-pending-orders-cron-STAGING.sql`. Tu gardes le job nommé `expire-pending-orders-every-min` en staging. Simple, zéro risque.

**Vérification rapide à faire** dans le SQL Editor staging :
```sql
SELECT jobname, schedule, active FROM cron.job;
```
Tu dois voir 1 ligne avec ton job actif.

### Option B — Renommer proprement (cosmétique)
Si tu veux distinguer clairement staging de prod dans `cron.job` (utile quand tu inspectes plusieurs environnements), exécute juste ces 2 commandes en staging :

```sql
-- Supprime l'ancien job (nom prod)
SELECT cron.unschedule((SELECT jobid FROM cron.job WHERE jobname = 'expire-pending-orders-every-min'));

-- Puis exécute le nouveau script MANUAL_expire-pending-orders-cron-STAGING.sql
```

### Option C — Re-exécuter le nouveau script tel quel (à éviter)
Tu te retrouverais avec 2 jobs simultanés. Pas de bug, juste du gaspillage (2 appels/minute au lieu d'1).

## Ma recommandation

**Option A** : laisse staging tel quel. Le nom du job n'a aucun impact technique. Concentre-toi maintenant sur le test fonctionnel :

1. Crée une commande mobile money de test en staging
2. Ne valide pas le paiement, attends ~7 minutes
3. Vérifie qu'elle est bien passée à `payment_failed` dans la table `orders`
4. Si OK → applique la version PROD avec confiance

Le fichier `MANUAL_expire-pending-orders-cron-STAGING.sql` reste utile uniquement comme référence/documentation pour un futur reset complet de l'environnement staging.

## Pas d'ALTER nécessaire

Pas besoin de `ALTER` quoi que ce soit. `pg_cron` n'expose pas de commande ALTER pour les jobs — la convention est `unschedule` puis `schedule` à nouveau (c'est ce que fait le bloc `DO $$` dans le script). Tu n'as donc rien à modifier sur le job existant tant que l'URL pointe correctement vers staging.

