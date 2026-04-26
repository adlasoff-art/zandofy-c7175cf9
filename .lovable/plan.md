# Plan Lot 11B — Phase B2 : Onboarding & Dashboard Opérateur

## 🎯 Objectif

Mettre en service l'écosystème complet permettant à toute entreprise de livraison du dernier kilomètre de :
1. S'enregistrer en tant qu'opérateur (parcours KYB)
2. Gérer sa flotte de livreurs, ses tarifs, sa couverture géographique
3. Recevoir, assigner et exécuter les commandes
4. Suivre sa facturation et la commission plateforme (25%)

**Périmètre validé** :
- ✅ Option A : tout B2 livré d'un coup
- ✅ Layout `OperatorLayout` dédié (distinct visuellement du dashboard vendeur)
- ✅ Template email Hostinger dédié "Invitation livreur — [Nom Opérateur]"

---

## 📐 1. Architecture Layout dédié `OperatorLayout`

**Fichier** : `frontend/src/layouts/OperatorLayout.tsx`

**Identité visuelle distincte** :
- **Couleur d'accent** : bleu nuit / cyan logistique (différent du vert vendeur) — défini en tokens HSL dans `index.css` sous `--operator-primary`, `--operator-accent`
- **Sidebar verticale** type "fleet management" (icônes Truck, Map, Users, Wallet, Settings) avec badge live count des courses en cours
- **Header dédié** : logo opérateur + nom entreprise + ville active + indicateur "X livreurs actifs / quota Y"
- **Mobile** : bottom nav 5 items (Dashboard, Courses, Flotte, Tarifs, Compte)
- **Composants partagés** : Card, Button, Badge réutilisés (design system préservé)

**Différenciation** : palette froide (bleu/cyan/slate) vs palette chaude vendeur (vert tamisé), typographie monospace pour IDs de courses, métaphore "centre de contrôle flotte".

---

## 📄 2. Pages livrées (8 au total)

### Public
1. **`/become-operator`** (`pages/BecomeOperatorPage.tsx`)
   - Vérification préalable : user logged in + KYC validé (sinon redirect)
   - Wizard 4 étapes :
     - Étape 1 : Identité entreprise (raison sociale, RCCM, NIF, contact)
     - Étape 2 : Adresse siège + sélection multi-villes de couverture
     - Étape 3 : Déclaration flotte (types véhicules : moto/voiture/camionnette/tricycle, quantité par type)
     - Étape 4 : Quota initial riders (défaut 1, max demandable 5 au lancement) + récap + soumission
   - Validation Zod stricte
   - Appel edge function `become-operator-submit` → statut `pending`
   - Page de confirmation "Demande envoyée, validation sous 48h"

### Dashboard `/operator/*` (RoleGuard role=`operator`)
2. **`/operator`** — `OperatorDashboardPage.tsx`
   - KPIs : courses du jour / mois, revenu net, commission retenue, taux de succès, rating moyen, quota riders utilisé
   - Graphique : évolution courses 30j
   - Liste 5 dernières courses avec statut

3. **`/operator/orders`** — `OperatorOrdersPage.tsx`
   - Tabs : À assigner / En cours / Livrées / Échouées
   - Filtres : ville, période, mode paiement (COD vs prépayé)
   - Action principale : assigner à un rider de la flotte
   - PII client masquée après livraison (RLS B1)

4. **`/operator/fleet`** — `OperatorFleetPage.tsx`
   - Liste riders actifs / inactifs
   - Bouton "Inviter un livreur" → modal email + nom (rate-limited 5/jour)
   - Bouton "Demander augmentation quota" si quota atteint → crée `operator_quota_requests`
   - Actions : suspendre / réactiver / retirer un rider (avec confirmation)

5. **`/operator/coverage`** — `OperatorCoveragePage.tsx`
   - Toggle activation/désactivation par ville
   - Multi-pays supporté (entreprise présente dans plusieurs villes)
   - Vue carte simple (liste villes + statut)

6. **`/operator/rates`** — `OperatorRatesPage.tsx`
   - CRUD `delivery_operator_rates` : zone (ville → commune → quartier optionnel)
   - Champs : prix de base, prix au km, surcharge nuit, surcharge week-end
   - Validation : rates ≥ 0, devise héritée de la ville

7. **`/operator/billing`** — `OperatorBillingPage.tsx`
   - Lecture seule `operator_commission_ledger`
   - Tableau : date, course ID, montant brut, commission 25%, net opérateur
   - Export CSV mensuel
   - Section "Payouts" (historique virements plateforme → opérateur)

8. **`/operator/settings`** — `OperatorSettingsPage.tsx`
   - Profil entreprise (modifiable, mais champs sensibles type RCCM passent par `sensitive_change_requests` cf. mémoire existante)
   - Coordonnées bancaires / mobile money pour payouts
   - Bouton "Demander augmentation quota" (formulaire justification)
   - Lecture seule : statut KYB, taux commission appliqué, date d'activation

---

## 🔐 3. Sécurité & Hooks

### Nouveau hook `useOperatorContext`
**Fichier** : `frontend/src/hooks/use-operator-context.ts`
- Récupère l'`operator_id` du user connecté via `delivery_operators` (owner_id = auth.uid)
- Cache via React Query
- Retourne : `{ operator, loading, isOwner, isApproved }`

### RoleGuard
- Toutes les routes `/operator/*` protégées par `RoleGuard allowedRoles={["operator"]}`
- Redirect `/auth` si non logué, `/` si non opérateur

### PII masking
- Déjà géré côté RLS Phase B1 (vue `v_operator_orders_active` expose adresse complète, vue `v_operator_orders_history` masque après livraison)
- Frontend consomme la bonne vue selon le statut

---

## ⚡ 4. Edge Functions (4 nouvelles)

Toutes avec : `verify_jwt=true`, validation Zod, CORS standard, rate limiting, logs.

1. **`become-operator-submit`**
   - Input : payload KYB complet (Zod)
   - Vérifie : user KYC validé, pas déjà opérateur
   - Crée `delivery_operators` statut `pending`
   - Crée `delivery_operator_cities` pour chaque ville déclarée
   - Notifie admins via `notifications` (canal in-app + email)

2. **`operator-invite-rider`**
   - Input : `{ email, full_name }` + auth opérateur
   - Vérifie : opérateur approuvé + quota non atteint + email pas déjà rider
   - Si user existe déjà : crée `delivery_operator_riders` statut `pending_acceptance` + notification
   - Si user n'existe pas : envoie email invitation via SMTP Hostinger avec lien magic d'inscription
   - Rate limit : 5 invitations / opérateur / jour
   - **Template email Hostinger dédié** (cf. section 5)

3. **`operator-assign-rider-to-order`**
   - Input : `{ order_id, rider_id }`
   - Vérifie : opérateur owner de l'order + rider de sa flotte + rider actif + KYC OK
   - Update `orders.assigned_rider_id` + log dans `order_operator_assignments`
   - Notifie le rider (push + in-app)

4. **`operator-request-quota-increase`**
   - Input : `{ requested_max_riders, justification }`
   - Crée `operator_quota_requests` statut `pending`
   - Notifie admins
   - Limite : 1 demande active à la fois par opérateur

---

## 📧 5. Template Email "Invitation Livreur"

**Réutilisation de la stack existante** : SMTP Hostinger via la fonction `notify-order-status` (pattern existant cf. mémoire `architecture/email-provider-hostinger`).

**Nouveau template** dans `supabase/functions/_shared/email-templates/operator-rider-invitation.ts` :
- Sujet : `"Invitation livreur — {operator_name} sur Zandofy"`
- Corps HTML branded Zandofy avec :
  - Logo + nom de l'opérateur
  - Message de bienvenue personnalisé
  - Récap rôle livreur (KYC obligatoire, commission, etc.)
  - CTA "Accepter l'invitation" → lien magic vers `/auth?invite_token=xxx&operator=yyy`
  - Footer légal Zandofy
- Variables : `operator_name`, `operator_city`, `inviter_full_name`, `accept_url`, `recipient_name`

Appelé depuis `operator-invite-rider`.

---

## 🛣️ 6. Routing

**Fichier modifié** : `frontend/src/App.tsx` — ajout :
```tsx
<Route path="/become-operator" element={<BecomeOperatorPage />} />
<Route path="/operator" element={<RoleGuard allowedRoles={["operator"]}><OperatorLayout /></RoleGuard>}>
  <Route index element={<OperatorDashboardPage />} />
  <Route path="orders" element={<OperatorOrdersPage />} />
  <Route path="fleet" element={<OperatorFleetPage />} />
  <Route path="coverage" element={<OperatorCoveragePage />} />
  <Route path="rates" element={<OperatorRatesPage />} />
  <Route path="billing" element={<OperatorBillingPage />} />
  <Route path="settings" element={<OperatorSettingsPage />} />
</Route>
```

**Lien d'entrée public** : ajout dans le footer + page "Devenir vendeur" (mention "Vous êtes une entreprise de livraison ? [Devenez opérateur]")

---

## 🌍 7. i18n

Ajout d'environ 80 nouvelles clés dans `I18nContext.tsx` (FR + EN) sous le namespace `operator.*` :
- `operator.layout.*` (sidebar items)
- `operator.onboarding.*` (wizard, validations)
- `operator.dashboard.*` (KPIs)
- `operator.orders.*`, `operator.fleet.*`, `operator.rates.*`, `operator.billing.*`, `operator.settings.*`

Aucun texte hardcodé (cf. mémoire `centralized-i18n-refactor-logic`).

---

## 🧪 8. Tests / QA manuel

À tester après livraison :
1. Onboarding complet avec un user KYC validé → opérateur en `pending`
2. Approbation admin (utilisera B3 mais on peut tester via SQL direct entre temps)
3. Invitation rider à user existant + à nouvel email
4. Assignation course → rider
5. Vérification commission ledger après livraison fictive
6. RLS : un opérateur A ne voit AUCUNE donnée d'opérateur B (test cross-tenant)

---

## 📦 9. Livrables

**Fichiers créés** (~22) :
- 1 layout : `OperatorLayout.tsx`
- 8 pages : `BecomeOperatorPage` + 7 pages `/operator/*`
- 1 hook : `use-operator-context.ts`
- 4 edge functions : `become-operator-submit`, `operator-invite-rider`, `operator-assign-rider-to-order`, `operator-request-quota-increase`
- 1 template email : `operator-rider-invitation.ts`
- Tokens CSS opérateur dans `index.css`
- Mise à jour `App.tsx` + `I18nContext.tsx`
- Mémoire `mem://features/delivery-operators-system.md`

**Aucune migration SQL** dans cette phase (toutes les tables sont déjà créées en B1).

---

## ⏭️ 10. Phases suivantes (hors B2)

- **B3** : outils admin (modération opérateurs, approbation KYB, override commission, validation quota requests)
- **B4** : intégration checkout (sélection opérateur par client) + UI hub (choix opérateur à l'arrivée pour COD/différé)
- **B5** : KPIs admin global + payouts automatisés

---

## ❓ Question avant lancement

**Une seule** : pour les tests E2E, je crée automatiquement **un 2ème opérateur de démo** (ex: "Kinshasa Express Logistics") en plus de Zandofy Kinshasa, ou tu préfères qu'on teste uniquement avec Zandofy Kinshasa et tu créeras les vrais opérateurs manuellement après validation ? Recommandation : **un seul opérateur de démo (Zandofy Kinshasa)** pour ne pas polluer la base.
