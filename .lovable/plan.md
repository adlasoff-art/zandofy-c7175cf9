

# Plan : Correction impersonation — Option A (Admin seul)

## Problème
1. `tokenStr` n'est jamais déclaré → ReferenceError immédiat
2. `token: null` référence une colonne supprimée
3. Les managers peuvent encore déclencher l'impersonation

## Corrections dans `frontend/supabase/functions/impersonate-user/index.ts`

| Ligne | Changement |
|-------|-----------|
| ~104 | Ajouter `const tokenStr = crypto.randomUUID();` avant `sha256Hex(tokenStr)` |
| ~108 | Retirer `token: null,` de l'insert (colonne supprimée) |
| ~73-80 | Retirer la vérification `isManager` — seul `isAdmin` autorise l'action `start` |
| ~82-90 | Retirer le bloc "Manager cannot impersonate admin" (devenu inutile) |

## Résultat
- Seuls les utilisateurs avec le rôle `admin` peuvent impersonner
- Le token est généré, hashé, et seul le hash est stocké
- Aucune migration SQL nécessaire
- Score sécurité inchangé (99/100)

