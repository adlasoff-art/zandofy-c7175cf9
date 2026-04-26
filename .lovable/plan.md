# Phase 10.1 — Stabilisation post-audit (multi-opérateurs + transitaires) ✅ TERMINÉE

## ✅ Livré
- Migration KYB transitaires relocalisée dans `frontend/supabase/migrations/` (déployable prod) + `forwarders.status DEFAULT 'pending'`.
- Route `/forwarder` + `ForwarderDashboardPage.tsx` (statut KYB, identité, couverture, documents signed URLs).
- `CreateOperatorDialog.tsx` branché dans `AdminOperatorsPage` (autocomplete profiles, flotte, villes, commission).
- `AdminSidebar.tsx` : ajout Plafonds tarifaires + Tarifs à modérer.
- `Header.tsx` + `MobileAccountMenu.tsx` : liens Espace conditionnels (operator/forwarder), masquage des "Devenir" si déjà rôle.
- `ErrorBoundary` / `error-reporter.ts` : filtre des chunk-load + null-context errors (notifications admin nettoyées).
- TypeScript build OK.

---

# (Archive) Plan initial

Objectif : corriger les 4 incohérences bloquantes prod identifiées et combler les manques UX/sécurité avant validation finale.

---

## 🔴 Bloquants prod (à exécuter en priorité)

### 1. Relocaliser la migration KYB transitaires
- **Action** : déplacer `supabase/migrations/20260426231512_*.sql` → `frontend/supabase/migrations/` (renommer avec timestamp courant si conflit).
- **Pourquoi** : seule `frontend/supabase/migrations/` est déployée par GitHub Actions vers la prod (`vpt...yxf`). En l'état, prod n'aura jamais le bucket `forwarder-documents`, ni `forwarders.owner_user_id/status/documents`.
- **Vérification** : `psql` sur prod après déploiement pour confirmer présence des colonnes.

### 2. Corriger `forwarders.status DEFAULT 'approved'`
- **Action** : nouvelle migration ALTER TABLE :
  - `ALTER COLUMN status SET DEFAULT 'pending'`
  - Ne pas toucher aux lignes existantes (forwarders legacy déjà en prod sont approved, normal).
- **Pourquoi** : faille KYB — toute insertion sans `status` explicite échappe à la modération.

### 3. Créer la route `/forwarder` (Espace transitaire minimal)
- **Action** : page `frontend/src/pages/forwarder/ForwarderDashboardPage.tsx` (lecture seule pour MVP) :
  - Affiche statut KYB (`pending/approved/suspended/rejected`) + `rejection_reason`.
  - Liste des routes couvertes + modes.
  - Liste des documents soumis (download via signed URL).
  - CTA `/forwarder/rates` (si déjà existant) ou message "à venir".
- **Route** : ajouter dans `App.tsx` sous `<Route path="/forwarder" element={<RoleGuard role="forwarder"><ForwarderDashboardPage /></RoleGuard>} />`.

### 4. Brancher `admin-create-operator` dans AdminOperatorsPage
- **Action** : ajouter bouton "Créer un opérateur" en haut de la page + Dialog `CreateOperatorDialog.tsx` :
  - Champs : owner_user_id (autocomplete users via `profiles` search par email), company_name, contact_email/phone, headquarters_city/country, vehicle_types, declared_riders_count, cities couvertes, `is_platform_owned`, `platform_commission_pct`.
  - Submit → `supabase.functions.invoke("admin-create-operator", { body })`.
  - Refresh liste après succès.

---

## 🟡 Améliorations qualité

### 5. Compléter la sidebar admin Logistique
- Ajouter dans `AdminSidebar.tsx` (sous-menu Logistique) :
  - `Caps tarifaires` → `/admin/operator-rate-caps`
  - `Tarifs à modérer` → `/admin/operator-rates-pending`

### 6. Liens "Espace opérateur / transitaire" pour les rôles existants
- **Header.tsx** + **MobileAccountMenu.tsx** : afficher conditionnellement
  - Si `roles.includes('operator')` → lien `/operator`
  - Si `roles.includes('forwarder')` → lien `/forwarder`
  - Cacher les liens "Devenir ..." correspondants si déjà le rôle.

### 7. Investiguer le flood d'erreurs `useState/useContext null`
- 30+ erreurs admin notifications entre 18h-22h aujourd'hui.
- Vérifier : `lazyRetry` ne bypass pas la racine React, AuthContext n'est pas importé en haut de chunks lazy avant que React soit prêt.
- Action : ajouter un ErrorBoundary plus haut (autour de `<Suspense>`) qui ne re-trigger PAS de notif admin pour les erreurs de chunk loading (filtrer `Failed to fetch dynamically imported module` et `Cannot read properties of null (reading 'useState'|'useContext')`).
- Bénéfice : nettoyer le bruit dans le centre de notifications.

### 8. Régénérer types Supabase
- Après application des migrations relocalisées, supprimer les `(supabase as any)` dans :
  - `AdminOperatorsPerformancePage.tsx`
  - `BecomeForwarderPage.tsx`
  - `become-forwarder-submit/index.ts` (types Deno auto)

---

## 🔒 Hors scope (à valider plus tard)
- Page admin `/admin/forwarders` : vérifier qu'elle gère bien le workflow KYB (pending/approve/reject) — l'edit de statut existe ?
- Edge function `admin-approve-forwarder` / `admin-reject-forwarder` : pas créées (équivalent opérateur). À ajouter dans une phase suivante.
- Onboarding email transactionnel transitaire (template + trigger) — Phase 11.

---

## 📦 Livrable attendu

- 2 nouvelles migrations dans `frontend/supabase/migrations/` (relocalisation + fix default status).
- 1 nouvelle page `ForwarderDashboardPage.tsx` + route.
- 1 nouveau composant `CreateOperatorDialog.tsx` + intégration dans `AdminOperatorsPage`.
- Patch `AdminSidebar.tsx`, `Header.tsx`, `MobileAccountMenu.tsx`.
- Patch ErrorBoundary pour filtrer les chunk-load errors.
- Validation : checklist en 6 points (migration prod OK, status default pending, /forwarder accessible, admin peut créer opérateur, sidebar complète, liens espace conditionnels).
