
**Objectif** : Compléter 3 manques identifiés dans la chaîne logistique sans toucher au moteur de pricing existant ni au checkout fonctionnel.

---

### 🟢 Lot 1 — Vue détaillée par commande dans Hub Logistique

**Problème** : Aujourd'hui la carte est fleet-wide. Impossible de cliquer sur une commande pour voir UNIQUEMENT son rider + son client en temps réel.

**Implémentation** :
- Nouveau composant `frontend/src/components/admin/logistics/OrderTrackingDrawer.tsx`
  - Ouvert quand l'admin clique sur une carte de `activeDeliveries`
  - Affiche `<DeliveryMap>` filtré sur le rider de cette delivery + le customer_location lié à `order_id`
  - Polyline rider→client + ETA si Haversine < 5km
  - Timeline statuts (pending → in_progress → delivered) avec timestamps
  - Boutons « Demander GPS rider » / « Demander GPS client » contextualisés
  - Lien « Voir la commande » → `/admin/orders/:id`
- Modification `AdminLogisticsPage.tsx` :
  - Cartes `activeDeliveries` (lignes 293-336) deviennent **cliquables** → ouvrent le drawer
  - Onglet existant inchangé pour la vue d'ensemble
- Ajout d'un onglet 4ème **« Suivi par commande »** listant TOUTES les commandes en `in_delivery` avec recherche par order_ref/téléphone/nom client

**Fichiers** : 1 nouveau composant + édition `AdminLogisticsPage.tsx`. Aucune migration DB (utilise `rider_locations` et `customer_locations` existants).

---

### 🟢 Lot 2 — Simulateur de devis vendeur (toggle admin)

**Spec** :
1. **Admin → Tarification boutique (`/admin/vendor-pricing`)** : ajouter un toggle global `freight_simulator_enabled` dans `platform_settings` (clé `vendor_features_config`)
2. **Vendor Dashboard → nouvel onglet « Simulateur fret »** (visible uniquement si toggle ON) :
   - Reproduit la logique de `QuoteCalculator` (Admin Shipping) MAIS en lecture seule
   - Source : profils transitaires NOUVEAUX (pas le legacy) → vendeur sélectionne destination + mode + items (qty + dimensions ou poids)
   - Affiche les offres éligibles (mêmes que celles vues par les clients) avec total + acompte + délai
   - Bouton « Copier le devis » → presse-papier formaté pour partage WhatsApp
   - **Aucune action commerciale** : c'est strictement un outil de calcul. Les tarifs et zones restent contrôlés par l'admin.

**Fichiers** :
- `frontend/src/components/admin/vendor-pricing/FreightSimulatorToggle.tsx` (nouveau)
- `frontend/src/components/vendor/VendorFreightSimulator.tsx` (nouveau)
- Édition `VendorDashboardPage.tsx` (ajout onglet conditionnel)
- 1 ligne dans `platform_settings` (insertion via tool — pas de migration de schéma)

**Aucune RLS à modifier** : `forwarder_pricing_profiles` est déjà accessible en lecture publique via `v_forwarder_profiles_public`.

---

### 🟢 Lot 3 — Documentation interne admin (mémoire vivante)

Création d'une fiche `mem://features/forwarders-and-logistics-system` documentant :
- Distinction LEGACY vs NEW pricing engines
- Workflow checkout avec fallbacks
- Procédure création transitaire en 4 étapes
- Mapping table → onglet UI
- Quel système utiliser pour quel scénario

**Aucune modif code** — uniquement mémoire pour les futurs prompts.

---

### ❌ Hors-scope (à ne pas faire dans ce lot)

- Dépréciation des onglets « Zones / Tarifs & Routes / Défauts » legacy → nécessite audit prod avant
- Refonte du modèle `deliveries` → trop risqué, fonctionnel actuel
- Ajout SMS push automatique sur changement statut handoff → déjà géré par `notify-forwarder-handoff`

---

### 📊 Checks post-implémentation

- Lot 1 : tester clic sur carte delivery active → drawer s'ouvre avec carte filtrée
- Lot 2 : activer toggle admin → vérifier que l'onglet apparaît côté vendeur, désactiver → disparaît
- Lot 3 : mémoire visible dans l'index

**Stack ciblée** : preview Lovable d'abord, puis PR `develop` → `main` → Vercel prod (zandofy.com). Aucune migration SQL requise.
