

# Plan : Gestion Admin Tendances, Footer, Badge Promo, QR Code App

## Résumé

5 chantiers : (1) Interface admin pour gérer les produits "Top Tendances", (2) Liens Trends + Populaires dans le footer, (3) Toggle admin + traduction du badge "Get 20% OFF" (désactivé par défaut), (4) Refonte du popup App Download avec QR code réel et promo configurable, (5) Installation d'une librairie QR code.

---

## 1. Admin : Gestionnaire de produits Top Tendances

**Fichier** : `frontend/src/components/admin/cms/TrendingProductsManager.tsx` (nouveau)

La table `trending_products` existe déjà (colonnes : `id`, `product_id`, `sort_order`, `created_at`). Il manque uniquement l'interface admin.

Composant avec :
- Recherche de produits (par nom) dans la table `products`
- Pour chaque produit affiché : nom, image, nombre de ventes (`sales_count`), note (`rating`), nombre d'avis (`review_count`)
- Bouton "Ajouter aux tendances" qui insère dans `trending_products`
- Liste des produits sélectionnés avec drag-and-drop pour l'ordre, bouton supprimer
- Limite visuelle de 12 produits recommandée

**Fichier** : `frontend/src/pages/admin/AdminCMSPage.tsx`
- Intégrer le composant dans l'onglet "Tendances" (tab `trends`), en dessous ou à la place du `TrendTagsTab` existant (les deux coexisteront : tags + sélection de produits)

---

## 2. Footer : Liens Trends et Populaires

**Fichier** : `frontend/src/components/Footer.tsx`

Ajouter dans la section "Aide & Support" ou une section existante :
- `{ label: "Top Tendances", to: "/trends" }`
- `{ label: "Plus Populaires", to: "/popular" }`

---

## 3. Badge "Get 20% OFF" — Toggle admin + désactivé par défaut

**Fichier** : `frontend/src/contexts/UIConfigContext.tsx`
- Charger la valeur `showDiscountBadge` depuis `platform_settings` (clé `ui_config`)
- Défaut : `false` (désactivé)

**Fichier** : `frontend/src/components/FloatingActions.tsx`
- Remplacer le texte en dur "Get 20% OFF" par une valeur traduisible (i18n ou configurable admin)

**Admin** : Ajouter un toggle dans la section "Sections" ou un emplacement pertinent du CMS pour activer/désactiver le badge et configurer son texte.

---

## 4. Popup App Download — QR Code réel + Promo configurable

**Dépendance** : Installer `qrcode.react` pour générer un QR code côté client.

**Fichier** : `frontend/src/components/FloatingActions.tsx`

Refonte du popup :
- Remplacer le placeholder par un vrai QR code (via `qrcode.react`) pointant vers l'URL du site
- QR code avec le logo Zandofy (icône panier) au centre (option `imageSettings` de `qrcode.react`)
- Supprimer les boutons Android/iOS, remplacer par un texte "Android & iOS"
- Texte "Scannez le QR code pour installer l'application"
- Section promo : code, pourcentage et seuil minimum configurables par l'admin

**Persistance admin** : Stocker dans `platform_settings` (clé `app_promo`) :
```json
{
  "code": "APP20",
  "discount_pct": 20,
  "min_order_amount": 100,
  "enabled": true
}
```

**Admin UI** : Ajouter une section dans le CMS (onglet "Sections" ou dédié) pour configurer :
- Code promo
- Pourcentage de réduction
- Montant minimum de commande
- Toggle activation

---

## 5. Pas de migration SQL

Toutes les données sont stockées dans `platform_settings` (JSONB existant). La table `trending_products` existe déjà.

---

## Fichiers modifiés/créés

- `frontend/src/components/admin/cms/TrendingProductsManager.tsx` — nouveau
- `frontend/src/pages/admin/AdminCMSPage.tsx` — intégration onglet tendances
- `frontend/src/components/Footer.tsx` — liens trends + popular
- `frontend/src/contexts/UIConfigContext.tsx` — badge désactivé par défaut, chargement DB
- `frontend/src/components/FloatingActions.tsx` — QR code, refonte popup, promo configurable
- `frontend/package.json` — ajout `qrcode.react`

