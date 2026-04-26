## Phase 10 — Finalisation UX Multi-opérateurs & Transitaires

### 🎯 Objectifs
1. Corriger le bug du loader infini sur `/admin/operators-performance`.
2. Rendre **visibles** les parcours « Devenir opérateur » et « Devenir transitaire » côté public.
3. Permettre à l'**admin de créer manuellement** un opérateur (en parallèle du flux public auto-déclaratif).
4. Créer la **page publique transitaire** (`/become-forwarder`) sur le même modèle que `/become-operator`.
5. Garantir que les **tarifs s'affichent dans la devise active** du visiteur (USD par défaut, conversion via le moteur global existant).

---

### 1) 🐛 Bugfix — Loader infini Suspension auto

**Fichier** : `frontend/src/pages/admin/AdminOperatorsPerformancePage.tsx`

**Cause** : un `useMemo` est utilisé pour faire `setForm(...)` (side effect), ce qui déclenche un re-render en boucle et bloque le spinner.

**Correctif** :
- Remplacer le `useMemo` problématique par un `useEffect` avec dépendance sur les seuils chargés.
- Initialiser `form` avec `useState` à partir des valeurs par défaut, puis sync via `useEffect` quand la query résout.
- Ajouter un état `isLoading` propre (skeleton plutôt que spinner infini si la query échoue).
- S'assurer qu'un `enabled: !!session` est présent sur la query pour respecter la règle RBAC (cf. mem://auth/rbac-implementation).

---

### 2) 🧭 Navigation publique — Ajouter les entrées « Devenir opérateur / transitaire »

#### 2.1 Header desktop — menu utilisateur (icône user)
**Fichier** : `frontend/src/components/Header.tsx` (popover du bouton utilisateur, là où se trouvent « Espace vendeur » + « Devenir vendeur »)

Ajouter, après les entrées vendeur :
- `Espace opérateur` → `/operator` (visible si `roles.includes('operator')`)
- `Devenir opérateur de livraison` → `/become-operator` (visible sinon)
- `Espace transitaire` → `/forwarder` (visible si `roles.includes('forwarder')` — sinon masqué)
- `Devenir transitaire` → `/become-forwarder` (visible sinon)

Utiliser `t("nav.becomeOperator")`, `t("nav.operatorSpace")`, `t("nav.becomeForwarder")`, `t("nav.forwarderSpace")` (cf. mem://features/centralized-i18n-refactor-logic — pas de hardcoding).

#### 2.2 Mobile Account Menu
**Fichier** : `frontend/src/components/MobileAccountMenu.tsx`

Mêmes 4 entrées, regroupées dans une section « Logistique & livraison » avec icônes `Truck` (opérateur) et `Ship` (transitaire).

#### 2.3 Footer — colonne du milieu (À propos)
**Fichier** : `frontend/src/components/Footer.tsx`

Ajouter dans la colonne du milieu (à côté de « Vendre sur Zandofy ») :
- `Devenir opérateur de livraison` → `/become-operator`
- `Devenir transitaire` → `/become-forwarder`

---

### 3) 👤 Création manuelle d'opérateur côté admin

**Fichier** : `frontend/src/components/admin/operators/CreateOperatorDialog.tsx` (nouveau)

Dialog déclenché depuis `frontend/src/pages/admin/AdminOperatorsPage.tsx` (bouton « Créer un opérateur » dans le header de la liste).

**Champs** (mêmes que le formulaire public + extras admin) :
- Recherche utilisateur existant (autocomplete sur `profiles.email` / `profiles.full_name`) → `owner_user_id`
- `company_name`, `legal_name`, `registration_number`, `tax_id`
- `contact_email`, `contact_phone`
- `headquarters_country`, `headquarters_city`, `headquarters_address`
- `vehicle_types` (array typé), `declared_riders_count`, `max_riders`
- `cities` (multi-villes de couverture)
- **Toggle admin-only** : `status` directement à `approved` + `is_active=true` (pas de modération, l'admin certifie sur place)
- **Toggle admin-only** : `is_platform_owned` (booléen, à ajouter dans la migration ci-dessous si absent — pour distinguer opérateurs internes Zandofy des opérateurs tiers)

**Edge Function nouvelle** : `admin-create-operator`
- `verify_jwt = true`
- Vérifie `has_role(auth.uid(), 'admin')`
- Insère dans `delivery_operators`, `delivery_operator_cities`
- Donne le rôle `operator` au `owner_user_id`
- Notifie l'utilisateur ciblé (in-app + email) qu'il a été enregistré comme opérateur
- Retourne l'ID de l'opérateur créé

**Migration éventuelle** :
- Ajouter colonne `is_platform_owned BOOLEAN NOT NULL DEFAULT false` sur `delivery_operators` si absente.
- Mettre à jour la vue `v_active_operators_by_city` pour exposer ce flag (utile pour la priorisation au checkout — cf. règle « plateforme prioritaire » dans mem://features/multi-operator-delivery-system).

---

### 4) 🚢 Page publique « Devenir transitaire »

#### 4.1 Page React
**Fichier** : `frontend/src/pages/BecomeForwarderPage.tsx` (nouveau)

Inspirée de `BecomeOperatorPage.tsx`. Sections :
- Hero (pitch + bénéfices : commission, accès volumes Zandofy, dashboard tracking)
- Comment ça marche (3 étapes : compte → KYB → activation)
- Formulaire multi-step :
  - **Étape 1** : Société (raison sociale, RCCM, NIF, SIRET)
  - **Étape 2** : Contact (email, téléphone, siège pays/ville/adresse)
  - **Étape 3** : Capacités (modes : Air / Sea / Road / Rail — cf. mem://features/shipping-engine-logic), routes desservies (origine → destination), volumes mensuels estimés
  - **Étape 4** : Documents (upload registre commerce, agrément transitaire, attestation TVA — bucket `forwarder-documents` à créer si absent, RLS owner-only)
  - **Étape 5** : Récap + soumission

#### 4.2 Edge Function
**Fichier** : `frontend/supabase/functions/become-forwarder-submit/index.ts`

Pattern identique à `become-operator-submit` :
- Auth requise (JWT en code)
- Anti-doublon (1 demande active par user)
- Insert dans `forwarders` (table existante — vérifier schéma) avec `status='pending'`
- Insert routes dans `forwarder_routes` (table existante)
- Donne rôle `forwarder` au user
- Notifie admins (in-app)
- Email accusé réception au demandeur (template SMTP Hostinger)

#### 4.3 Routing
- Ajouter route `/become-forwarder` dans `frontend/src/App.tsx` (lazy load)
- Vérifier que la page de modération admin existante (`/admin/forwarders`) gère déjà les statuts `pending` (sinon ajouter onglet « Demandes en attente »)

#### 4.4 i18n
Ajouter ~15 clés dans `I18nContext.tsx` (FR + EN) : `becomeForwarder.hero.title`, `becomeForwarder.steps.*`, etc.

---

### 5) 💱 Affichage devise pour les tarifs

**Vérification + ajustements** sur :
- `frontend/src/pages/operator/OperatorRatesPage.tsx` (saisie tarifs en USD, libellé clair « Montants en USD »)
- `frontend/src/components/checkout/OperatorSelector.tsx` (affichage du prix livraison via `formatPrice(amount, 'USD')` qui convertit selon la devise active du `CurrencyContext`)
- `frontend/src/pages/forwarder/ForwarderRatesPage.tsx` (même règle)
- Affichage admin dans `/admin/operators-performance` et `/admin/forwarders` : montants formatés via le hook global

**Aucune migration** — la conversion utilise déjà le moteur existant (cf. mem://features/currency-conversion-engine).

---

### 6) 🗂️ AdminSidebar — regroupement logistique

**Fichier** : `frontend/src/components/admin/AdminSidebar.tsx`

Regrouper sous un `SidebarGroup` « Logistique » (collapsible, ouvert par défaut si la route active commence par `/admin/operator` ou `/admin/forwarder` ou `/admin/logistics`) :
- Logistique (existant)
- Transitaires
- Opérateurs livraison
- Performance opérateurs
- Quotas opérateurs

---

### 📦 Récap fichiers

**Créés**
- `frontend/src/pages/BecomeForwarderPage.tsx`
- `frontend/src/components/admin/operators/CreateOperatorDialog.tsx`
- `frontend/supabase/functions/become-forwarder-submit/index.ts`
- `frontend/supabase/functions/admin-create-operator/index.ts`
- Migration : `is_platform_owned` sur `delivery_operators` (si absent) + refresh vue `v_active_operators_by_city` + bucket `forwarder-documents` + RLS

**Modifiés**
- `frontend/src/pages/admin/AdminOperatorsPerformancePage.tsx` (bugfix)
- `frontend/src/pages/admin/AdminOperatorsPage.tsx` (bouton + dialog)
- `frontend/src/components/Header.tsx`
- `frontend/src/components/MobileAccountMenu.tsx`
- `frontend/src/components/Footer.tsx`
- `frontend/src/components/admin/AdminSidebar.tsx`
- `frontend/src/App.tsx` (route `/become-forwarder`)
- `frontend/src/contexts/I18nContext.tsx` (clés FR/EN)
- `frontend/src/pages/operator/OperatorRatesPage.tsx` + `OperatorSelector.tsx` + équivalents transitaires (formatage devise)

### ⚠️ Hors périmètre (volontairement)
- Pas de seed Very Speed Kinshasa (tu créeras les tarifs à la main).
- Pas de modification du moteur de pricing existant.
- Pas de refonte de la page `/become-operator` existante (juste exposition dans la nav).
- Pas de cron — déjà fait Phase 9.

### ✅ Critères de succès
- `/admin/operators-performance` affiche les seuils sans loader infini.
- Un visiteur connecté voit « Devenir opérateur » et « Devenir transitaire » dans son menu utilisateur + footer.
- Un admin peut créer un opérateur depuis `/admin/operators` en quelques clics, avec choix `is_platform_owned`.
- `/become-forwarder` accessible publiquement, soumission fonctionnelle, demande visible dans `/admin/forwarders`.
- Tarifs affichés dans la devise du visiteur (USD par défaut, conversion automatique).
