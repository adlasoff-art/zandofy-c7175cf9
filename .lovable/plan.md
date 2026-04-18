

## CAUSE RACINE CONFIRMÉE — enfin la vraie

Les logs prod sont sans ambiguïté :

```
ordersError= column orders.shipping_mode does not exist
```

L'edge function tape bien la **bonne base** prod (le user `6afbf0da...` et son rôle `admin,vendor` correspondent à ton compte). Mais la requête SQL plante car la colonne `shipping_mode` **n'existe pas dans la table `orders` en prod**.

Donc :
- ❌ Le `SELECT` échoue → `orders` retourne `[]`
- ❌ La fonction renvoie `ORDERS_NOT_FOUND` (faux positif, c'est en réalité une erreur de schéma)
- ✅ La commande `ZND-MN7F2J3P` existe bien

J'avais ajouté `shipping_mode` au SELECT lors d'une itération précédente sans vérifier qu'une migration existait pour cette colonne en prod.

## Plan de correction — 2 actions, fin du tunnel

### Action 1 — Retirer `shipping_mode` du SELECT (fix immédiat, 0 risque)

Dans `frontend/supabase/functions/generate-shipping-labels/index.ts`, retirer `shipping_mode` de la liste du `select(...)` et le remplacer par une valeur par défaut côté JS :

```ts
// AVANT
.select("id, order_ref, ..., shipping_mode")

// APRÈS
.select("id, order_ref, ...")  // sans shipping_mode

// Plus bas dans le map :
shippingMode: "",  // valeur par défaut, sera réactivée après migration
```

Idem pour `shipping_email` par précaution — je vérifie d'abord si la colonne existe (si l'erreur ne mentionne que `shipping_mode`, alors `shipping_email` est OK et je le garde).

### Action 2 — Créer la migration `shipping_mode` (à pousser séparément)

Créer `frontend/supabase/migrations/<timestamp>_add_shipping_mode_to_orders.sql` :

```sql
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS shipping_mode TEXT;
```

Cette migration sera appliquée sur prod via ton workflow GitHub Actions habituel. Une fois appliquée, je pourrai réintégrer `shipping_mode` dans le SELECT.

### Action 3 — Garde-fou logs

Garder les logs `[v2]` actuels et le log `[v3] SUPABASE_URL=...` (déjà en place) pour que la prochaine erreur de schéma soit diagnostiquée en 1 lecture de log au lieu de 5 itérations.

## Ce que je NE ferai pas

- Aucun changement CORS (déjà OK, logs le confirment)
- Aucun changement `config.toml`, `client.ts`, `.env`, `types.ts`
- Pas de modification Lovable Cloud

## Pourquoi cette fois c'est définitif

Les logs prod montrent **textuellement** l'erreur PostgreSQL : `column orders.shipping_mode does not exist`. Ce n'est plus une hypothèse — c'est la base de données prod qui parle. Le fix retire la cause exacte de cette erreur.

## Décision attendue

Confirme et je passe en exécution mode default :
1. Patch edge function : retrait de `shipping_mode` du SELECT (+ valeur par défaut côté JS)
2. Création de la migration SQL `ADD COLUMN IF NOT EXISTS shipping_mode`
3. Tu pushes → la fonction marche immédiatement (avant même que la migration soit appliquée)
4. Quand tu appliques la migration, on réactivera `shipping_mode` dans une PR séparée

