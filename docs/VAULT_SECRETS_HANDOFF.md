# Configuration des secrets Vault — Notifications transitaire (Lot 4L)

Pour que la fonction Edge `notify-handoff-status-customer` puisse être invoquée
automatiquement par le trigger SQL `trg_notify_customer_handoff_status` (via `pg_net`),
deux secrets doivent être présents dans la **Supabase Vault** de chaque environnement.

## Secrets requis

| Nom              | Valeur                                                                 |
|------------------|------------------------------------------------------------------------|
| `project_url`    | URL du projet Supabase (ex. `https://uogkklwfvwoxkifpkzpu.supabase.co`) |
| `service_role_key` | Clé `service_role` du projet (Settings → API → `service_role`)        |

> ⚠️ Conformément à `SAFETY_POLICY.md`, ces valeurs **doivent être dupliquées**
> sur les deux environnements (Staging `zandofy-production` et Production `zandofy-live`).
> Ne jamais mélanger les clés entre les deux instances.

## Procédure (par environnement)

1. Ouvrir le projet Supabase visé (Staging ou Production).
2. Aller dans **Project Settings → Vault → Secrets**.
3. Cliquer sur **Add new secret** et créer :
   - `project_url` → coller l'URL complète du projet (sans `/` final).
4. Recliquer sur **Add new secret** et créer :
   - `service_role_key` → coller la clé `service_role` depuis **Settings → API**.
5. Vérifier la présence des deux secrets dans la liste (les valeurs restent masquées).

## Vérification

Une fois les secrets ajoutés, déclencher manuellement une transition de statut
sur un handoff (ex. `pending → acknowledged`) depuis l'espace transitaire :

- ✅ Une notification in-app doit apparaître pour le client (créée par le trigger SQL).
- ✅ Un email doit être envoyé via SMTP Hostinger (logs visibles dans
  **Edge Functions → notify-handoff-status-customer → Logs**).

Si l'email n'est pas envoyé :
- Vérifier les logs `pg_net` (`select * from net.http_response_collect();`).
- Vérifier que `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_EMAIL` sont
  également définis dans **Edge Functions → Secrets**.
- Sans ces deux secrets Vault, **les notifications in-app fonctionnent toujours**,
  seul l'email est ignoré.

## Rappel sécurité

- Ne jamais committer ces valeurs dans le dépôt.
- Ne jamais exposer `service_role_key` côté frontend ou dans les logs.
- En cas de rotation de la clé, mettre à jour le secret Vault correspondant
  dans chaque environnement.
