# Plan final v2 — Multi-opérateurs : consolidation, KYB & gestion admin

## Décisions validées (récap)

1. Recherche par email : **admin only** (RPC SECURITY DEFINER)
2. Tarifs commune/quartier saisissables par admin au nom d'un opérateur (auto-approbation)
3. Legacy tarification (`communes.delivery_fee`, `quartiers.delivery_surcharge`) : **renommée `*_legacy_deprecated`** + champs retirés de l'UI Zone Géographique
4. UX checkout : message clair + CTAs (demander couverture, retrait hub) si aucun opérateur
5. **Migration legacy → opérateur** : option (a) — auto-injection des anciens prix dans `delivery_operator_rates` du Very Speed conservé
6. **Doublon Very Speed Delivery** : garder celui à commission 15% / max 10 riders / 3 riders déclarés. Archiver l'autre.
7. **KYB upload (RCCM, NIF, statuts, etc.)** : nouveau module documents pour opérateurs
8. **Gestion admin opérateurs** : édition + suppression (archivage logique)

---

## Fix 1 — Recherche propriétaire par email (admin only)

- RPC `search_users_admin(term text)` SECURITY DEFINER, vérifie `has_role(auth.uid(), 'admin')`, jointure `profiles` ⨝ `auth.users`, retourne `user_id, first_name, last_name, email, city, is_kyc_verified, created_at`, limite 8.
- `OperatorOwnerSearch.tsx` → utilise la RPC, affiche email, placeholder mis à jour.

## Fix 2 — Page admin de gestion des tarifs au nom d'un opérateur

- Route `/admin/operators/:operatorId/rates` → `AdminOperatorRatesPage.tsx`
- Edge function `admin-create-operator-rate` (verify_jwt=true) : vérifie `has_role(admin)`, insert avec `status='approved'`, `approved_by=auth.uid()`, valide `delivery_operator_city_caps`.
- Bouton "Gérer les tarifs" sur `AdminOperatorsPage`.

## Fix 3 — Nettoyage legacy + migration des prix vers l'opérateur conservé

### A. Migration des prix legacy → tarifs opérateur (option a)

Migration SQL idempotente :
- Boucle sur `communes` ayant `delivery_fee > 0` : insert dans `delivery_operator_rates` (operator_id = Very Speed conservé, status='approved', city_id, commune_id, base_price = delivery_fee, surcharge=0).
- Boucle sur `quartiers` ayant `delivery_surcharge > 0` : insert avec `quartier_id`, `surcharge = delivery_surcharge`, base = commune parent.
- ON CONFLICT DO NOTHING (clé : operator_id + scope géo).

> ⚠️ L'ID du Very Speed conservé doit être passé en paramètre du script SQL (cf. action utilisateur ci-dessous).

### B. Renommage colonnes legacy

```sql
ALTER TABLE communes RENAME COLUMN delivery_fee TO delivery_fee_legacy_deprecated;
ALTER TABLE quartiers RENAME COLUMN delivery_surcharge TO delivery_surcharge_legacy_deprecated;
```

### C. UI Admin Zone Géographique
Retrait des champs/colonnes `delivery_fee` et `delivery_surcharge`. Garder `is_restricted`. Ajouter notice : « La tarification est désormais gérée par opérateur. »

### D. Code legacy
`frontend/src/lib/last-mile-fee.ts` → JSDoc `@deprecated`, suppression imports résiduels.

## Fix 4 — UX checkout amélioré

- Composant checkout (consommateur de `useOperatorQuotes`) : message « Aucun livreur ne dessert [quartier], [commune] » + CTAs « Demander une couverture » et « Retrait au hub ».
- Edge function `request-delivery-coverage` (verify_jwt=true) → insert dans nouvelle table `coverage_requests(user_id, country, city, commune_id, quartier_id, requested_at, fulfilled_at)` + notif admins.
- Migration `coverage_requests` avec RLS (user voit les siens, admin voit tout).

---

## Fix 5 — Doublon Very Speed Delivery (action ciblée prod)

- L'utilisateur fournit l'ID du Very Speed à **conserver** (commission 15%, max_riders 10, 3 riders déclarés).
- Script SQL d'archivage de l'autre : `UPDATE delivery_operators SET archived_at = now(), archive_reason = 'doublon — conservé l''opérateur configuré par owner', is_active = false, status = 'archived' WHERE id = '<id_doublon>';`
- Vérifier qu'aucune commande active n'est rattachée au doublon avant archivage (warning si `delivery_assignments` non terminés).

> **Action utilisateur requise** : me fournir les **deux IDs** (`id_a_conserver` et `id_a_archiver`) depuis la prod (`SELECT id, company_name, platform_commission_pct, max_riders, declared_riders_count FROM delivery_operators WHERE company_name ILIKE '%very speed%';`).

---

## Fix 6 — KYB Documents pour opérateurs (NOUVEAU)

### A. Storage
Bucket privé `operator-kyb-documents` (RLS : owner peut upload/lire ses docs ; admin peut tout lire).

### B. Schéma DB
Table `operator_kyb_documents` :
- `id`, `operator_id` (FK), `doc_type` (`rccm` | `nif` | `id_card` | `business_license` | `insurance` | `other`), `file_path`, `file_name`, `mime_type`, `size_bytes`, `uploaded_by`, `uploaded_at`, `verified_at`, `verified_by`, `rejection_reason`, `status` (`pending`|`approved`|`rejected`).
- RLS : owner CRUD ses docs (status pending uniquement), admin/manager lecture + update verification.

### C. UI Opérateur (`OperatorSettingsPage.tsx`)
Nouvelle section "Documents légaux" : drag&drop par type de document, statut affiché, possibilité de remplacer si `rejected`.

### D. UI Admin (`AdminOperatorsPage.tsx` — drawer détail)
Nouvel onglet "Documents KYB" : liste, prévisualisation, boutons Approuver / Rejeter (avec motif).

### E. Edge functions
- `operator-upload-kyb-document` (verify_jwt=true, owner-only) : valide MIME (pdf/jpg/png), taille ≤ 10MB, insert ligne.
- `admin-review-kyb-document` (verify_jwt=true, admin-only) : update status + notif owner (in-app + email).

---

## Fix 7 — Édition & suppression opérateur (admin)

### A. Édition (drawer `AdminOperatorsPage`)
Champs éditables : `company_name`, `legal_name`, `registration_number`, `tax_id`, `contact_email`, `contact_phone`, `headquarters_*`, `platform_commission_pct`, `max_riders`, `is_active`, `status`.
- Edge function `admin-update-operator` (verify_jwt=true, admin-only) : audit log dans `activity_logs`.

### B. Suppression (archivage logique)
- Bouton "Archiver l'opérateur" (rouge, confirmation modale).
- Edge function `admin-archive-operator` :
  - Vérifie qu'aucun `delivery_assignments` actif (statut ≠ delivered/cancelled) → sinon refuse avec liste.
  - Set `archived_at`, `archive_reason`, `is_active=false`, `status='archived'`.
  - Désactive automatiquement tous les tarifs (`delivery_operator_rates.status='archived'`).
  - Notifie owner.
- Pas de DELETE physique (préserve historique commandes).

---

## Fichiers impactés (résumé)

**Migrations SQL** (frontend/supabase/migrations/) :
- `*_add_search_users_admin_rpc.sql`
- `*_migrate_legacy_fees_to_operator_rates.sql` (paramétré sur l'ID Very Speed conservé)
- `*_rename_legacy_delivery_fees.sql`
- `*_create_coverage_requests.sql`
- `*_create_operator_kyb_documents.sql` (table + storage bucket + RLS)
- `*_archive_duplicate_operator.sql` (à exécuter après confirmation des IDs)

**Edge Functions** :
- `admin-create-operator-rate/`
- `request-delivery-coverage/`
- `operator-upload-kyb-document/`
- `admin-review-kyb-document/`
- `admin-update-operator/`
- `admin-archive-operator/`

**Frontend** :
- `OperatorOwnerSearch.tsx` (RPC + email)
- `pages/admin/AdminOperatorRatesPage.tsx` (nouveau)
- `pages/admin/AdminOperatorsPage.tsx` (édition + archivage + onglet KYB)
- `pages/operator/OperatorSettingsPage.tsx` (section documents)
- `App.tsx` (routes)
- pages Géographie admin (retrait champs prix)
- composants checkout (message + CTAs)
- `lib/last-mile-fee.ts` (deprecated)

---

## Workflow déploiement (rappel)

1. Branch `feature/operators-consolidation-v2` depuis `develop`.
2. SQL migrations + EF + frontend dans la même PR.
3. Push → preview Lovable Cloud (test rapide structure).
4. PR → `develop` → staging (tests fonctionnels).
5. Migration legacy → opérateur **rejouée manuellement sur prod** (vpt...yxf) après validation staging, avec ID Very Speed conservé fourni par vous.
6. Archivage du doublon **uniquement après** confirmation explicite.
7. PR `develop` → `main` → prod (Vercel + GitHub Actions deploy edge functions).

---

## Action utilisateur requise avant exécution

Fournir depuis la prod :

```sql
SELECT id, company_name, platform_commission_pct, max_riders,
       declared_riders_count, owner_user_id, contact_email, created_at
FROM delivery_operators
WHERE company_name ILIKE '%very speed%';
```

Puis indiquer :
- **ID à conserver** : (celui à 15% / 10 max / 3 riders)
- **ID à archiver** : (l'autre)

Dès réception, je passe en build (toutes les fixes 1→7 en une PR).
