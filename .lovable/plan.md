# Plan final — Multi-opérateurs : finalisation et nettoyage legacy

## Décisions validées

1. **Recherche par email** : admin uniquement (PII-safe via RPC SECURITY DEFINER)
2. **Tarifs commune/quartier saisissables par admin** au nom d'un opérateur (auto-approbation)
3. **Legacy tarification** : suppression des champs prix dans Zone Géographique. Conservation de la Zone Géographique comme **référentiel d'adresses** uniquement
4. **UX checkout** : message clair + alternatives (zone proche, retrait hub) quand aucun opérateur ne couvre

---

## Fix 1 — Recherche propriétaire par email (admin only)

**Backend** : nouvelle RPC `search_users_admin(term text)` SECURITY DEFINER
- Vérifie `has_role(auth.uid(), 'admin')` au tout début, sinon `RAISE EXCEPTION`
- Retourne : `user_id, first_name, last_name, email, city, is_kyc_verified, created_at`
- Cherche dans `profiles.first_name`, `profiles.last_name`, ET `auth.users.email` (jointure)
- Limite 8 résultats

**Frontend** : `OperatorOwnerSearch.tsx`
- Remplacer la requête directe `profiles` par appel `supabase.rpc('search_users_admin', { term })`
- Afficher l'email dans les résultats (admin only — composant déjà admin-only)
- Mettre à jour placeholder : "Ex: Jean, Dupont ou jean@email.com"
- Mettre à jour le message d'aide en bas

---

## Fix 2 — Page admin de gestion des tarifs au nom d'un opérateur

**Nouvelle route** : `/admin/operators/:operatorId/rates`

**UI** : Réutilise les composants de `OperatorRatesPage.tsx` (formulaire ville/commune/quartier + base/surcharge/ETA), encapsulés dans `AdminOperatorRatesPage.tsx`.
- En-tête : nom de l'opérateur, lien retour
- Formulaire identique avec tous les champs déjà en place
- Bouton "Enregistrer (auto-approuvé)"

**Backend** : nouvelle Edge Function `admin-create-operator-rate` (verify_jwt=true)
- Vérifie `has_role(admin)`
- Insert dans `delivery_operator_rates` avec `status='approved'` et `approved_by=auth.uid()`
- Vérifie le respect des `delivery_operator_city_caps` (sinon erreur 400 explicite)

**Lien d'accès** : ajouter bouton "Gérer les tarifs" sur la page de détail/liste des opérateurs admin.

---

## Fix 3 — Nettoyage legacy tarification (Zone Géographique)

### A. Migration SQL — retirer les champs de tarification

```sql
-- Backup defensive (optionnel : on garde 30j puis on drop)
ALTER TABLE communes RENAME COLUMN delivery_fee TO delivery_fee_legacy_deprecated;
ALTER TABLE quartiers RENAME COLUMN delivery_surcharge TO delivery_surcharge_legacy_deprecated;
-- (drop dans une migration future après validation)
```

> Renommage plutôt que DROP immédiat pour permettre rollback rapide. Drop définitif planifié dans 30 jours.

### B. UI Admin Zone Géographique
Page : `/admin/geography` (ou équivalent — onglets Pays/Provinces/Villes/Communes/Quartiers)

- **Communes** : retirer la colonne et le champ `delivery_fee` du formulaire
- **Quartiers** : retirer la colonne et le champ `delivery_surcharge` du formulaire
- Garder `is_restricted` (info utile : zone non desservie / dangereuse)
- Ajouter une notice : "La tarification est désormais gérée par chaque opérateur depuis son espace ou par l'admin via /admin/operators/:id/rates"

### C. Code legacy
- `frontend/src/lib/last-mile-fee.ts` : marquer `@deprecated` en JSDoc, garder le fichier 30j puis suppression
- Vérifier qu'aucun composant ne l'importe encore (rg sur `last-mile-fee`) — supprimer les imports résiduels

---

## Fix 4 — Message UX checkout amélioré

`useOperatorQuotes.ts` retourne déjà 0 quotes quand non couvert. Améliorer le composant qui affiche le message :

```
"Aucun livreur ne dessert encore [quartier], [commune]"
[CTA] Demander une livraison sur ma zone  → notifie admin
[CTA] Choisir le retrait au hub le plus proche  → bascule sur pickup
[Info] Zones proches couvertes : commune A, commune B  (suggestion automatique)
```

**Backend** : Edge function `request-delivery-coverage` (verify_jwt=true)
- Reçoit : `{ commune_id, quartier_id, country, city }`
- Insert dans nouvelle table `coverage_requests(user_id, location, requested_at, fulfilled)`
- Notifie admins via le canal notifications existant

**Migration** : créer `coverage_requests` avec RLS (user voit les siennes, admin voit tout).

---

## Fichiers impactés (résumé)

**Migrations SQL** :
- `*_add_search_users_admin_rpc.sql`
- `*_rename_legacy_delivery_fees.sql`
- `*_create_coverage_requests.sql`

**Edge Functions** :
- `admin-create-operator-rate/` (nouveau)
- `request-delivery-coverage/` (nouveau)

**Frontend** :
- `OperatorOwnerSearch.tsx` (modifié — RPC + email)
- `AdminOperatorRatesPage.tsx` (nouveau)
- `App.tsx` (route)
- `pages/admin/operators/...` (lien "Gérer les tarifs")
- `pages/admin/geography/*` (retrait champs tarification)
- `useOperatorQuotes.ts` consumers (composant checkout — message + CTAs)
- `lib/last-mile-fee.ts` (deprecated)

---

## Hors-scope (à confirmer plus tard)
- Suppression définitive (DROP) des colonnes legacy → dans 30j si tout va bien
- Suggestion automatique "zones proches couvertes" : algorithme à affiner (proximité géographique vs. même ville)
- Migration de données : doit-on convertir les anciens `delivery_fee` en tarifs initiaux pour les opérateurs existants ? **Question pour vous** ci-dessous.

---

## Une dernière question avant exécution

Pour les opérateurs déjà créés (Very Speed Delivery + autres), souhaitez-vous :

**(a)** Que je migre automatiquement les anciennes valeurs `communes.delivery_fee` / `quartiers.delivery_surcharge` en tarifs `delivery_operator_rates` pour Very Speed Delivery (l'opérateur plateforme), pour qu'il couvre immédiatement toutes les communes/quartiers historiques avec les anciens prix ?

**(b)** Ou je laisse Very Speed Delivery avec uniquement le tarif Kinshasa déjà seedé ($5), et vous compléterez manuellement via la nouvelle page admin ?

L'option (a) garantit une continuité de service immédiate sur tout le territoire historique. L'option (b) est plus propre mais nécessite que vous saisissiez chaque commune/quartier.

**Validez le plan + répondez (a) ou (b), et je passe en mode build.**
