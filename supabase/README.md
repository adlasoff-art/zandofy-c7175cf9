# Supabase — source unique (Zandofy)

Tout le backend versionné vit ici. **Ne pas** recréer `frontend/supabase/`.

## Structure

| Dossier | Rôle |
|---------|------|
| `migrations/` | Fichiers SQL versionnés (un fichier par changement schema) |
| `functions/` | Edge Functions Deno déployées sur Supabase |

## Workflow humain (staging → production)

1. Nouveau fichier dans `migrations/` (commit GitHub).
2. Copier le SQL dans **Supabase SQL Editor — projet staging**.
3. Tester l'application (frontend Vercel preview ou env staging).
4. Exécuter le **même** SQL en **production**.
5. Déployer les Edge Functions modifiées (CLI ou Dashboard) staging puis prod.

## Agents IA (Lovable / Cursor)

- Créer les migrations **uniquement** sous `supabase/migrations/`.
- Créer les fonctions **uniquement** sous `supabase/functions/`.
- Migrations additives par défaut ; pas de `DROP` sans accord explicite.
- Voir `AGENTS.md` et `.cursor/rules/05-database-safety.mdc`.

## Projets Supabase

Deux projets distincts (bases séparées) : **staging** et **production**. Ne jamais mélanger les clés.
