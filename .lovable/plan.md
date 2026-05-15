## Cause

L'erreur `column forwarder_handoffs.deposit_required does not exist` provient de la prod (`vpt...yxf`) à laquelle il manque la migration **Lot 4O** (acompte / solde sur les handoffs transitaires).

En auditant la divergence entre `supabase/migrations/` (Lovable Cloud, à jour) et `frontend/supabase/migrations/` (source GitHub → prod), **7 migrations forwarder_handoffs n'ont jamais été copiées vers `frontend/`**, donc GitHub Actions ne les a jamais déployées en prod :

| # | Fichier | Contenu |
|---|---|---|
| 1 | `20260423183341_…` | Création initiale handoffs + RPC v1 |
| 2 | `20260423231921_…` | RPC quote v2 (deposit) |
| 3 | `20260424101513_…` | Ajustements coverage |
| 4 | `20260424130759_…` | **Lot 4O — colonnes deposit/balance/payment_status** ← cause du bug |
| 5 | `20260424130816_…` | RLS / policies handoffs |
| 6 | `20260424193202_…` | Réassignation forwarder (legs) |
| 7 | `20260428221831_…` | Vues / index |

Conformément à la mémoire `rls-staging-prod-divergence`, tout fix doit être **rejoué sur les deux** (staging + prod) en passant par `frontend/supabase/migrations/`.

## Plan

### 1. Correctif immédiat (fichier SQL téléchargeable)

Générer **un seul fichier SQL idempotent** pour la prod, à exécuter dans Supabase SQL Editor sur `vpt...yxf` :

- Tout le contenu de la migration **Lot 4O** (colonnes `deposit_required`, `deposit_amount`, `deposit_paid_amount`, `deposit_paid_at`, `balance_amount`, `balance_paid_amount`, `balance_paid_at`, `payment_status`, `payment_currency`)
- Backfill depuis `freight_quotes`
- Fonction + trigger `recompute_handoff_payment_status`

Toutes les opérations utilisent `IF NOT EXISTS` / `CREATE OR REPLACE` / `DROP TRIGGER IF EXISTS` → ré-exécution sûre.

Livré dans `/mnt/documents/fix_forwarder_handoffs_deposit_lot4o.sql`.

→ **Effet immédiat** : la page `/forwarder/handoffs` recharge sans erreur.

### 2. Synchronisation GitHub (pour pérenniser)

Copier les **7 migrations** de `supabase/migrations/` vers `frontend/supabase/migrations/` (mêmes timestamps, mêmes noms) afin que :
- Les prochains déploiements GitHub Actions appliquent automatiquement le Lot 4O sur tout nouvel environnement.
- Staging et prod restent alignées avec Lovable Cloud.

Aucune des 7 ne sera ré-exécutée en prod (timestamps déjà passés, ou idempotents) — c'est purement de la mise en conformité du repo.

### 3. À ne pas faire dans ce lot

- Aucun changement de code frontend (le code attend déjà ces colonnes, c'est la DB qui est en retard).
- Pas de modification de RLS, de RPC, ni de structure au-delà du Lot 4O.
- Pas de touche aux 6 autres migrations dont le contenu est déjà appliqué côté prod (à confirmer par toi : vois ci-dessous).

## Question avant exécution

Confirme un des deux scopes :

- **A.** Juste le fix Lot 4O (SQL téléchargeable + copier uniquement cette migration dans `frontend/`).
- **B.** Fix Lot 4O **+** copier les 7 migrations dans `frontend/` pour réaligner le repo (recommandé).