
# Refonte Layout : Sidebar verticale pour les dashboards Client & Vendeur (Desktop)

## Résumé

Transformer les onglets horizontaux (pills/boutons) des espaces Client (`/dashboard`) et Vendeur (`/vendor`) en un **menu latéral gauche vertical** sur desktop, tout en gardant les **onglets horizontaux scrollables** sur mobile. Les KPI cards restent **figés en haut** de la zone de contenu, indépendamment de l'onglet actif.

## Changements structurels

### Architecture Desktop (≥ 1024px)

```text
┌──────────────────────────────────────────────────┐
│  Header (inchangé)                               │
├──────────┬───────────────────────────────────────┤
│          │  Photo + Nom + Bienvenue              │
│  Menu    ├───────────────────────────────────────┤
│ vertical │  KPI Cards (figés, toujours visibles) │
│  gauche  ├───────────────────────────────────────┤
│          │  Contenu de l'onglet actif            │
│  (icons  │                                       │
│  + label)│                                       │
├──────────┴───────────────────────────────────────┤
│  Footer (inchangé)                               │
└──────────────────────────────────────────────────┘
```

### Architecture Mobile (< 1024px)

```text
┌──────────────────────────┐
│  Header                  │
├──────────────────────────┤
│  Photo + Nom             │
├──────────────────────────┤
│  KPI Cards               │
├──────────────────────────┤
│  [Onglets scrollables ►] │
├──────────────────────────┤
│  Contenu onglet actif    │
├──────────────────────────┤
│  Footer                  │
└──────────────────────────┘
```

## Fichiers modifiés

| Fichier | Action |
|---------|--------|
| `frontend/src/pages/DashboardPage.tsx` | Extraire les KPI (OverviewTab) vers le haut permanent, ajouter sidebar verticale desktop, garder pills mobiles |
| `frontend/src/pages/VendorDashboardPage.tsx` | Même refonte : sidebar verticale desktop avec VendorSummaryWidgets toujours visibles, pills mobiles |

## Détail technique

### 1. DashboardPage (Client)

**Sidebar gauche (desktop)** :
- Largeur fixe ~220px, fond `bg-card`, bordure droite
- En haut : avatar + prénom/nom (au lieu de l'email) + "Bienvenue"
- Liste des onglets TABS avec icône + label, style actif en `bg-primary/10 text-primary`
- Visuellement proche du style AdminSidebar mais plus léger

**Zone principale** :
- **Toujours visible en haut** : les 6 KPI cards (Bienvenue/nom, En cours, Total commandes, Total dépensé, Annulées, Retournées) — extraits de `OverviewTab` et affichés indépendamment de l'onglet actif
- **En dessous** : le contenu de l'onglet sélectionné (sauf "overview" qui n'affichera que le LoyaltyProgress puisque les KPIs sont déjà visibles)

**Mobile (< lg)** :
- Pas de sidebar, les onglets restent en `flex overflow-x-auto` horizontal scrollable (comportement actuel)
- KPI cards au-dessus des onglets

### 2. VendorDashboardPage (Vendeur)

**Sidebar gauche (desktop)** :
- Avatar/logo de la boutique + nom de la boutique + badge tier
- Liste des onglets (Catalogue, Commandes, Livraisons, Promos, etc.) avec icônes
- Badge "non lu" sur Messages

**Zone principale** :
- **Toujours visible en haut** : VendorSummaryWidgets (Boutique, Produits, Commandes, Messages) — déjà existant, reste figé
- **En dessous** : contenu de l'onglet actif

**Mobile** : même logique — pills horizontales scrollables, widgets au-dessus

### 3. Implémentation CSS

- Utilisation de classes Tailwind responsive : `hidden lg:flex` pour la sidebar, `flex lg:hidden` pour les pills mobiles
- Layout principal : `flex` horizontal sur desktop, `flex-col` sur mobile
- Sidebar : `w-56 shrink-0 border-r border-border bg-card` sticky avec `sticky top-0 h-[calc(100vh-4rem)] overflow-y-auto`
- Pas de composant Shadcn Sidebar (trop lourd pour ce cas) — simple `nav` avec des `button` stylisés

### 4. Affichage du nom au lieu de l'email

- Côté client : charger `first_name`/`last_name` depuis le profil, afficher "Bienvenue, {prénom}" au lieu de l'email brut
- Côté vendeur : déjà affiché via le nom de la boutique

## Ce qui ne change PAS

- Header et Footer restent identiques
- Toute la logique métier (chargement commandes, realtime, etc.) reste inchangée
- Les composants enfants (VendorProductManager, OrdersTab, etc.) ne sont pas modifiés
- Le design mobile reste quasiment identique (juste ajout des KPI permanents au-dessus des pills)
