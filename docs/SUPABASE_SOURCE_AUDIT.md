# Audit source Supabase (2026-05)

## Source de vérité

| Chemin | Rôle |
|--------|------|
| [`supabase/migrations/`](../supabase/migrations/) | Migrations SQL officielles |
| [`supabase/functions/`](../supabase/functions/) | Edge Functions officielles |
| [`frontend/supabase/`](../frontend/supabase/) | **Reliquat Lovable — ne pas déployer** |

## Migrations récentes (racine uniquement)

- `20260522120000_user_product_views.sql`
- `20260523120000_payment_proof_storage_rls.sql`

Copies identiques ou partielles peuvent exister sous `frontend/supabase/migrations/` — toujours appliquer la version **racine** en SQL Editor.

## Edge Functions

Comparer avant suppression de `frontend/supabase/functions/` :

```powershell
# Exemple : lister les dossiers présents seulement dans frontend/supabase/functions
```

Fonctions connues dupliquées (échantillon) : `kelpay-webhook`, `platform-bootstrap`, `generate-shipping-labels` — vérifier hash ou diff manuel avant archive.

## Types TypeScript

Après chaque migration appliquée en staging :

```bash
# Avec Supabase CLI pointant sur staging
supabase gen types typescript --project-id <STAGING_REF> > frontend/src/integrations/supabase/types.ts
```

En attendant : ajouts manuels documentés (ex. `user_product_views`).

## Checklist parité

- [ ] Toutes les migrations `frontend/supabase/migrations/` ont un équivalent dans `supabase/migrations/` ou sont obsolètes
- [ ] Aucun déploiement CI/CD depuis `frontend/supabase/`
- [ ] `frontend/supabase/DEPRECATED.md` lu par l’équipe
- [ ] Reliquat `src/integrations/supabase/types.ts` (racine repo) non importé par `frontend/`
