---
name: RLS staging/prod divergence after project split
description: Historical context — projet Supabase scindé en staging+prod après coup, donc les policies RLS doivent être systématiquement rejouées sur les deux environnements pour éviter les divergences invisibles.
type: constraint
---

Au démarrage du projet Zandofy, il existait UN SEUL projet Supabase + une seule branche `main` Vercel. Le split en `develop` (staging — projet `zandofy-production`) et `main` (production — projet `zandofy-live`) est intervenu plus tard, en créant un NOUVEAU projet Supabase pour la prod.

**Conséquence permanente** : certaines migrations appliquées avant le split ne sont présentes que dans l'ancien projet (devenu staging). Les divergences silencieuses les plus fréquentes :
- Policies RLS admin/manager manquantes côté prod (`Staff read all *`, `Staff update *`).
- Triggers de cohérence absents.
- Fonctions SQL (`has_role`, `can_access_store_orders`, etc.) potentiellement non rejouées.

**Symptôme typique** : une donnée existe en base (vérifiée via SQL Editor avec service role) mais n'apparaît pas dans l'UI admin parce que la policy SELECT pour `admin`/`manager` est absente.

**Procédure obligatoire pour TOUTE évolution RLS/SQL** :
1. Écrire la migration dans `frontend/supabase/migrations/` (idempotente : `DROP POLICY IF EXISTS` + `CREATE POLICY`).
2. Fournir le fichier SQL téléchargeable à l'utilisateur (cf. `SAFETY_POLICY.md` règle 6).
3. Appliquer en STAGING via SQL Editor → tester.
4. Appliquer en PROD via SQL Editor → tester.
5. Audit comparatif périodique avec `pg_policies` sur les deux projets pour détecter les divergences.

**Tables critiques à surveiller** : `orders`, `order_items`, `payment_transactions`, `reviews`, `shipments`, `order_status_history`, `cancellation_requests`, `forwarder_handoffs`, `vendor_wallets`.

**Référence** : migration `20260426011700_rls_reconciliation_staff_policies.sql`.
