

# Audit complet — Zandofy Production (Vercel + Supabase.com)

---

## BUG CRITIQUE #1 : L'admin ne peut pas approuver/rejeter les produits (RLS)

**Cause racine** : Il n'existe aucune politique RLS permettant aux admins/managers de faire un UPDATE sur la table `products`. Seuls les propriétaires de boutique peuvent modifier leurs propres produits (policy `Store owners update products`).

Quand l'admin clique "Approuver", l'UPDATE de `publish_status` est silencieusement bloqué par RLS → aucune ligne modifiée → le toast "Statut mis à jour" s'affiche quand même (pas d'erreur SQL retournée par Supabase quand 0 lignes affectées).

**Correction** :
1. Migration SQL : ajouter une politique admin UPDATE sur `products`
```sql
CREATE POLICY "Admins update products"
ON public.products FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));
```
2. Frontend : vérifier que l'UPDATE a bien modifié une ligne (le SDK Supabase ne lève pas d'erreur quand RLS bloque silencieusement). Ajouter un contrôle post-update.

---

## BUG #2 : L'autocomplete expose les produits non publiés

**Fichier** : `frontend/src/services/search.ts` ligne 124-128

La fonction `autocompleteProducts()` ne filtre PAS par `publish_status = 'published'`. Tout produit (brouillon, rejeté, en attente) apparaît dans les suggestions de recherche.

**Correction** : Ajouter `.eq("publish_status", "published")` à la requête.

---

## BUG #3 : Edge Function `visual-search` absente du `config.toml` production

**Fichier** : `frontend/supabase/config.toml`

La fonction `visual-search` n'est pas déclarée. Elle est déclarée uniquement dans `supabase/config.toml` (Lovable Cloud). En production, le déploiement via GitHub Actions utilise `frontend/supabase/config.toml`.

**Correction** : Ajouter `[functions.visual-search]` avec `verify_jwt = false` au fichier `frontend/supabase/config.toml`.

---

## BUG #4 : 12 migrations manquantes côté production

Les 12 migrations de `supabase/migrations/` (13-15 mars 2026) ne sont pas dans `frontend/supabase/migrations/`. Tables et fonctionnalités manquantes en production :
- Variantes produits (`variant_types`, `variant_type_options`, `product_variant_selections`)
- KYC complet (`kyc_verifications`, `kyc_audit_logs`, bucket `kyc-documents`)
- Support guest (fonctions RPC)
- `customer_locations` (GPS livraison)
- Colonnes CMS (`display_mode`, `target_page`, `bg_color`, `text_color`)
- `analytics_events`
- Trigger `on_auth_user_created` + `handle_new_user()` robuste

**Correction** : Copier les 12 fichiers SQL vers `frontend/supabase/migrations/`. Ajuster la migration #5 (`20260314181229`) pour ajouter `DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;` avant le CREATE.

---

## FAILLE SÉCURITAIRE #5 : `as any` bypass de types sur les mutations admin

**17 fichiers admin** utilisent `as any` pour contourner les types TypeScript lors des mutations Supabase. Cela masque les erreurs de colonne, les champs manquants, et empêche toute détection de régressions à la compilation.

**Correction** : Régénérer les types Supabase (`supabase gen types`) après la synchronisation des migrations, puis remplacer les `as any` par les types corrects. Priorité moyenne — à traiter après la stabilisation.

---

## PROBLÈME #6 : Toast "succès" même si l'UPDATE échoue silencieusement

**Fichier** : `AdminProductModerationPage.tsx` lignes 56-69

Le `onSuccess` de la mutation se déclenche même quand RLS bloque l'UPDATE (0 lignes modifiées, aucune erreur retournée). L'admin voit "Statut du produit mis à jour" alors que rien n'a changé.

**Correction** : Utiliser `.select()` après `.update()` pour vérifier que la ligne retournée a bien le nouveau statut, ou compter les lignes affectées.

---

## PROBLÈME #7 : Pas de pagination sur la modération produits

**Fichier** : `AdminProductModerationPage.tsx`

La requête récupère TOUS les produits sans limite. Avec la croissance (objectif 10M utilisateurs), cette page sera inutilisable.

**Correction** : Ajouter `.range()` avec pagination côté serveur et un composant de pagination.

---

## PROBLÈME #8 : `visual-search` n'applique pas le filtre `publish_status = 'published'`

**Fichier** : `frontend/supabase/functions/visual-search/index.ts` ligne 175

Le filtre est `.neq("publish_status", "archived")` — ce qui retourne aussi les brouillons, rejetés et en attente d'approbation.

**Correction** : Remplacer par `.eq("publish_status", "published")`.

---

## Résumé des corrections par priorité

| Priorité | # | Problème | Impact |
|----------|---|----------|--------|
| CRITIQUE | 1 | RLS admin UPDATE products manquante | Admin ne peut pas modérer |
| CRITIQUE | 4 | 12 migrations manquantes en prod | Features entières absentes |
| HAUTE | 6 | Toast succès trompeur | UX admin trompeuse |
| HAUTE | 2 | Autocomplete expose produits non publiés | Fuite données |
| HAUTE | 8 | visual-search retourne produits non publiés | Fuite données |
| HAUTE | 3 | visual-search absent du config.toml prod | Feature cassée en prod |
| MOYENNE | 7 | Pas de pagination modération | Scalabilité |
| BASSE | 5 | `as any` massif dans les pages admin | Maintenabilité |

---

## Plan d'exécution

### Étape 1 — Migration SQL (résout #1)
Créer une migration ajoutant la politique RLS admin UPDATE sur `products`.

### Étape 2 — Fix frontend modération (résout #6)
Modifier `AdminProductModerationPage.tsx` pour vérifier que l'UPDATE a bien pris effet et afficher une erreur sinon.

### Étape 3 — Fix autocomplete (résout #2)
Ajouter le filtre `publish_status` dans `search.ts` → `autocompleteProducts()`.

### Étape 4 — Fix visual-search (résout #3 + #8)
- Ajouter `[functions.visual-search]` au `frontend/supabase/config.toml`
- Changer `.neq("publish_status", "archived")` → `.eq("publish_status", "published")` dans l'Edge Function

### Étape 5 — Synchroniser les 12 migrations (résout #4)
Copier les fichiers SQL vers `frontend/supabase/migrations/` avec le fix d'idempotence sur le trigger.

### Étape 6 — Pagination modération (résout #7)
Ajouter pagination côté serveur à `AdminProductModerationPage`.

