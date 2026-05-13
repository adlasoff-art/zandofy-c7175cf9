## Diagnostic — pourquoi le livreur n'apparaît pas

Symptômes observés :
- Invitation envoyée → toast OK + email reçu.
- Le livreur clique le lien → arrive sur `/rider` (donc son compte existait déjà → la fonction l'a inséré directement dans `delivery_operator_riders` avec `status = kyc_required`).
- Côté owner : la liste reste vide (« Aucun livreur dans la flotte »), aucune erreur visible.

La requête côté front (`OperatorFleetPage.tsx`) est :
```
fromTable("delivery_operator_riders")
  .select(...)
  .eq("operator_id", operator.id)
```
Pas de filtre sur `status` → la ligne `kyc_required` devrait s'afficher.

Quand le résultat est vide sans erreur, dans 95 % des cas en prod c'est **RLS** (silencieux) ou un **mismatch d'`operator_id`**. Vu le mémo `rls-staging-prod-divergence` (les RLS de Lot 11B / multi-operator n'ont jamais été rejouées sur la base prod `vpt…yxf`), c'est l'hypothèse n°1.

## Étape 1 — Vérifier sur la PROD (3 requêtes SQL à exécuter dans Supabase Studio prod)

```sql
-- (A) La ligne du livreur a-t-elle bien été insérée ?
select id, operator_id, rider_user_id, status, vehicle_type, invited_at
from public.delivery_operator_riders
order by invited_at desc
limit 10;

-- (B) Les RLS attendues existent-elles sur les 2 tables ?
select tablename, policyname, cmd
from pg_policies
where schemaname='public'
  and tablename in ('delivery_operator_riders','delivery_operator_rider_invites')
order by tablename, policyname;

-- (C) Helper is_operator_owner présent ?
select proname, pg_get_function_identity_arguments(oid) as args
from pg_proc
where proname='is_operator_owner';
```

Résultats attendus :
- (A) ≥ 1 ligne avec `operator_id` = celui de l'owner.
- (B) doit lister `op_riders_select_owner`, `op_riders_select_self`, `op_riders_select_staff`, `op_riders_insert_owner`, `op_riders_update_owner`, `op_riders_update_staff`, `op_riders_delete_owner` + 2 policies sur les invites.
- (C) une fonction `is_operator_owner(uuid, uuid)`.

Selon ce qui manque, on tombe sur l'un des cas suivants :

| Cas | Symptôme | Correctif |
|---|---|---|
| 1 | (A) vide | INSERT silencieusement bloqué côté edge (à investiguer dans les logs `operator-invite-rider`). |
| 2 | (A) OK, (B) ne contient pas `op_riders_select_owner` ou la table invites n'a pas de policy | **Rejouer la migration RLS sur prod** (SQL fourni étape 2). |
| 3 | (A) OK, (B) OK mais `operator_id` du rider ≠ `delivery_operators.id` lié à l'owner | Mismatch côté front (ex. owner possède 2 opérateurs → `useOperatorContext` n'en charge qu'un seul). Correctif app : afficher la flotte de **tous** les opérateurs détenus. |
| 4 | (C) absent | Recréer la fonction `is_operator_owner` (incluse dans le SQL étape 2). |

## Étape 2 — Migration idempotente prod (à appliquer si cas 2 ou 4)

Fichier à créer dans `frontend/supabase/migrations/` (la SOT prod) puis à exécuter sur la base prod :

```sql
-- Helper (no-op si déjà présent)
CREATE OR REPLACE FUNCTION public.is_operator_owner(_uid uuid, _operator_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.delivery_operators
    WHERE id=_operator_id AND owner_user_id=_uid
  );
$$;

-- Riders : RLS + policies idempotentes
ALTER TABLE public.delivery_operator_riders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "op_riders_select_owner" ON public.delivery_operator_riders;
DROP POLICY IF EXISTS "op_riders_select_self"  ON public.delivery_operator_riders;
DROP POLICY IF EXISTS "op_riders_select_staff" ON public.delivery_operator_riders;
DROP POLICY IF EXISTS "op_riders_update_owner" ON public.delivery_operator_riders;
DROP POLICY IF EXISTS "op_riders_update_staff" ON public.delivery_operator_riders;

CREATE POLICY "op_riders_select_owner" ON public.delivery_operator_riders
  FOR SELECT TO authenticated USING (public.is_operator_owner(auth.uid(),operator_id));
CREATE POLICY "op_riders_select_self" ON public.delivery_operator_riders
  FOR SELECT TO authenticated USING (rider_user_id=auth.uid());
CREATE POLICY "op_riders_select_staff" ON public.delivery_operator_riders
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "op_riders_update_owner" ON public.delivery_operator_riders
  FOR UPDATE TO authenticated USING (public.is_operator_owner(auth.uid(),operator_id));
CREATE POLICY "op_riders_update_staff" ON public.delivery_operator_riders
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

-- Invites : SELECT owner/staff + UPDATE owner (cancel depuis le front)
ALTER TABLE public.delivery_operator_rider_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rider_invites_select_owner" ON public.delivery_operator_rider_invites;
DROP POLICY IF EXISTS "rider_invites_select_staff" ON public.delivery_operator_rider_invites;
DROP POLICY IF EXISTS "rider_invites_update_owner" ON public.delivery_operator_rider_invites;
DROP POLICY IF EXISTS "rider_invites_update_staff" ON public.delivery_operator_rider_invites;

CREATE POLICY "rider_invites_select_owner" ON public.delivery_operator_rider_invites
  FOR SELECT TO authenticated USING (public.is_operator_owner(auth.uid(),operator_id));
CREATE POLICY "rider_invites_select_staff" ON public.delivery_operator_rider_invites
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
CREATE POLICY "rider_invites_update_owner" ON public.delivery_operator_rider_invites
  FOR UPDATE TO authenticated USING (public.is_operator_owner(auth.uid(),operator_id));
CREATE POLICY "rider_invites_update_staff" ON public.delivery_operator_rider_invites
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
```

À noter : j'ajoute **UPDATE owner** sur `delivery_operator_rider_invites` (manquant dans la migration actuelle), sinon le bouton « Annuler l'invitation » échoue silencieusement.

## Étape 3 — Robustesse front (toujours appliquée)

Dans `OperatorFleetPage.tsx`, je vais :
1. **Logguer / afficher** les erreurs de fetch riders & invites (au lieu de les avaler) → on saura tout de suite si c'est un 401/403/RLS.
2. **Ajouter un bouton « Rafraîchir »** à côté du compteur de la flotte (pour invalider le cache 30 s sans recharger la page).
3. **Refetch automatique** des deux queries après acceptation côté rider (déjà fait après invite, à compléter).

Aucun changement business : juste de la visibilité + UX.

## Livrables

- SQL de diagnostic (étape 1) — à coller dans Supabase Studio prod.
- Migration `frontend/supabase/migrations/<timestamp>_fix_operator_riders_rls.sql` (étape 2).
- Patch `OperatorFleetPage.tsx` : exposition des erreurs + bouton refresh (étape 3).

Une fois l'étape 1 exécutée, dis-moi ce que retournent (A), (B), (C) — je saurai exactement quelle case cocher et je n'aurai pas besoin de plusieurs itérations.