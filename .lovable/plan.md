
# Lot 9 — Audit & Réconciliation RLS Production (héritage du split staging/prod)

## 🎯 Objectif

Les données `order_items` existent en prod (confirmé pour ZND-MO5HHBED) mais ne s'affichent pas dans l'admin. Hypothèse : **policies RLS admin/manager manquantes** sur la prod, conséquence du split historique d'un projet unique en deux projets séparés.

## 🔍 Contexte historique

- Au départ : 1 seul projet Supabase + 1 seul projet Vercel (branche `main` directe).
- Plus tard : split en `develop` (staging) + `main` (prod), avec création d'un **nouveau projet Supabase** pour la prod.
- Conséquence probable : certaines migrations appliquées sur l'ancien projet (devenu staging) **n'ont pas été rejouées intégralement** sur le nouveau projet prod.

## 📋 Étapes

### Étape 1 — Audit RLS comparatif (READ ONLY)

Exécuter sur **PROD** (Supabase perso `vpt...yxf`) ET **STAGING** :

```sql
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('orders', 'order_items', 'payment_transactions', 'reviews')
ORDER BY tablename, policyname;
```

Comparer les deux listes pour identifier les policies présentes en staging mais absentes en prod (et inversement).

### Étape 2 — Migration corrective ciblée

Créer `frontend/supabase/migrations/YYYYMMDD_rls_reconciliation_prod.sql` qui ajoute en `IF NOT EXISTS` (via `DROP POLICY IF EXISTS` + `CREATE POLICY`) les policies manquantes pour permettre aux **admins et managers** de lire :
- `order_items` (toutes commandes)
- `orders` (toutes commandes — déjà probablement OK)
- `payment_transactions`
- Tout ce qui ressort de la comparaison

Modèle prévu (à ajuster selon résultat de l'étape 1) :

```sql
DROP POLICY IF EXISTS "Admins read all order items" ON public.order_items;
CREATE POLICY "Admins read all order items"
ON public.order_items FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Managers read all order items" ON public.order_items;
CREATE POLICY "Managers read all order items"
ON public.order_items FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'manager'));
```

### Étape 3 — Validation

1. Re-tester la commande **ZND-MO5HHBED** dans l'admin → l'éponge doit apparaître.
2. Vérifier 2-3 autres commandes historiques.
3. Confirmer que les vendeurs continuent de voir uniquement leurs propres `order_items` (non-régression).

### Étape 4 — Documentation mémoire

Ajouter une mémoire `mem://architecture/rls-staging-prod-divergence` documentant :
- Le split historique projet unique → staging+prod.
- L'obligation systématique de **rejouer toutes les migrations RLS sur prod** lors d'un futur fix RLS.
- La procédure d'audit comparatif `pg_policies` à exécuter périodiquement.

## ✅ Livrables

- Résultat audit comparatif (collé en réponse).
- Migration `rls_reconciliation_prod.sql` (générée après audit).
- Mémoire architecturale ajoutée.
- Confirmation visuelle dans l'admin que ZND-MO5HHBED affiche son article.

## ⚠️ Garde-fous

- **Aucune modification** des policies existantes restrictives (vendeurs/clients).
- **Uniquement ajouts** de policies admin/manager via `DROP IF EXISTS` + `CREATE`.
- Migration testée d'abord en staging, puis appliquée en prod via GitHub Actions (`deploy-edge-functions.yml` ou équivalent migrations).
