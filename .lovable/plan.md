

# Plan — Tarification vendeur dans le sidebar + page publique + UX scroll sidebar

## Problème identifié

1. **Pas d'onglet "Tarification" dans le sidebar vendeur** : les services payants (plans, abonnements livraison) ne sont pas accessibles depuis l'espace vendeur.
2. **Le sidebar vendeur (desktop) utilise `sticky top-20`** avec une hauteur non contrainte : sur les petits écrans (< 14"), les derniers items (Messages, Paramètres) sont coupés et inaccessibles.
3. **Pas de page publique de tarification** : les visiteurs non-connectés ne peuvent pas consulter les tarifs des services de la plateforme.

## Modifications prévues

### 1. Ajouter l'onglet "Tarification" dans le sidebar vendeur

**Fichier** : `frontend/src/pages/VendorDashboardPage.tsx`

- Ajouter `"pricing"` au type `activeTab` et à `VENDOR_TABS` (icône `DollarSign`, label "Tarification"), positionné avant "Statistiques".
- Créer le composant `VendorPricingTab.tsx` qui affiche :
  - Les plans de services disponibles (`platform_service_plans` actifs) avec prix mensuel/annuel
  - Les plans de livraison (`delivery_subscriptions` config)
  - Les abonnements actuels du vendeur
  - Bouton "Souscrire" / "Gérer" pour chaque plan (accessible uniquement aux vendeurs vérifiés KYC)
- Ajouter le rendu `{activeTab === "pricing" && <VendorPricingTab storeId={store!.id} />}` dans `renderTabContent`.

### 2. Corriger le scroll du sidebar vendeur (petits écrans)

**Fichier** : `frontend/src/pages/VendorDashboardPage.tsx`

- Remplacer le style du sidebar desktop `sticky top-20 space-y-4` par un conteneur scrollable :
  ```
  sticky top-20 max-h-[calc(100vh-5rem)] overflow-y-auto scrollbar-thin
  ```
- Cela permet de scroller dans le sidebar sur les écrans < 14" pour atteindre tous les éléments jusqu'à "Paramètres".

### 3. Page publique de tarification

**Nouveau fichier** : `frontend/src/pages/PricingPage.tsx`

- Page accessible sans authentification à `/pricing`
- Affiche les plans de services (`platform_service_plans` actifs) et plans de livraison en lecture seule
- Grille tarifaire claire avec prix mensuel/annuel
- Détail des plans vendeurs (5/10/20/50/100 livraisons, Standard/Pro/Premium)
- Détail des plans clients (abonnement livraison à domicile)
- Section stockage Hub (14 jours gratuits, 0.59$/jour après)
- Commission plateforme (10% par défaut)
- CTA "Devenir vendeur" renvoyant vers `/become-vendor` pour les non-connectés
- CTA "Souscrire" renvoyant vers `/vendor` pour les vendeurs connectés
- Message informatif : "Pour souscrire, vous devez avoir un compte vérifié et être vendeur approuvé."

**Fichier** : `frontend/src/App.tsx`
- Ajouter la route `/pricing` (lazy-loaded)

**Fichier** : `frontend/src/components/Footer.tsx`
- Ajouter le lien "Tarification" dans la section "À propos" ou "Aide & Support"

### 4. Nouveau composant VendorPricingTab

**Nouveau fichier** : `frontend/src/components/vendor/VendorPricingTab.tsx`

- Lecture des `platform_service_plans` actifs via Supabase
- Lecture des abonnements en cours du vendeur (si table `vendor_service_subscriptions` existe)
- Affichage en cards/accordéons avec statut actif/inactif par service
- Actions conditionnelles (KYC vérifié, boutique non suspendue)

## Pas de migration DB requise

Toutes les tables nécessaires (`platform_service_plans`, `delivery_subscriptions`) existent déjà. Aucune modification de schéma.

## Fichiers impactés

| Fichier | Action |
|---|---|
| `frontend/src/pages/VendorDashboardPage.tsx` | Ajout onglet pricing + fix scroll sidebar |
| `frontend/src/components/vendor/VendorPricingTab.tsx` | Nouveau |
| `frontend/src/pages/PricingPage.tsx` | Nouveau |
| `frontend/src/App.tsx` | Route `/pricing` |
| `frontend/src/components/Footer.tsx` | Lien tarification |

