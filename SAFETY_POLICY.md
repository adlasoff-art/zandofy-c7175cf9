# Zandofy Safety Policy v2.0

## Environnements

| Env | Projet | Domaine | Branche |
|-----|--------|---------|---------|
| Staging | zandofy-production | studio.zandofy.com | `develop` |
| Production | zandofy-live | zandofy.com | `main` |

## Règles de sécurité

1. **Pas de push direct sur `main`** — toute modification passe par `develop` puis PR.
2. **Parité des Edge Functions** — déploiement simultané staging + production.
3. **Callbacks de production** — toujours valider vers `https://zandofy.com` via `SITE_BASE_URL`.
4. **Authentification** — exclusivement Google OAuth.
5. **Stabilité du domaine principal** — priorité absolue.

## Règles de migration de base de données

6. **Export SQL obligatoire** — À chaque modification de la structure de la base de données (création de table, ajout/suppression de colonne, modification de politique RLS, création de fonction/trigger, etc.), un fichier SQL téléchargeable contenant la migration complète doit être fourni à l'utilisateur. Ce fichier permet la synchronisation manuelle avec les environnements Staging et Production via le SQL Editor.

## Règles générales

- Ne jamais modifier les fichiers sensibles sans approbation explicite (voir `AGENTS.md`).
- Ne jamais mélanger les variables staging et production.
- Traiter le code généré par Lovable comme du code brouillon jusqu'à revue.
