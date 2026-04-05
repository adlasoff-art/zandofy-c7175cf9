

# Plan — Corrections PricingPage + Multi-boutique vendeur + Attribution admin

## Changements demandés

### 1. PricingPage — Corrections texte et UX

**Fichier** : `frontend/src/pages/PricingPage.tsx`

- **Ligne 67** : Retirer "indépendantes" → "pour les boutiques"
- **Lignes 81-94** : Remplacer les deux boutons mensuel/annuel par un **Switch toggle** (composant `Switch` existant) avec labels "Mensuel" / "Annuel" de chaque côté
- **Ligne 206** : Changer `$0,59/jour par kg` → `$0,25/jour par kg`
- **Ligne 208** : Supprimer la ligne "Pénalités prélevées automatiquement" — déplacer cette info dans `TermsPage.tsx`

### 2. TermsPage — Ajout section pénalités Hub

**Fichier** : `frontend/src/pages/TermsPage.tsx`

- Ajouter une section "Stockage Hub & Pénalités" dans les CGV par défaut (FR + EN) expliquant la règle des 14 jours gratuits et la pénalité de $0,25/jour/kg prélevée automatiquement sur le solde vendeur

### 3. AdminDeliveryPlansPage — Mise à jour fallback

**Fichier** : `frontend/src/pages/admin/AdminDeliveryPlansPage.tsx`

- Changer le fallback `daily_rate` de `0.59` à `0.25`

### 4. VendorDashboardPage — Multi-boutique + Store Switcher

**Fichier** : `frontend/src/pages/VendorDashboardPage.tsx`

- **Fetch multi-store** : Remplacer `.maybeSingle()` (ligne 134) par une requête qui récupère **toutes** les boutiques du vendeur (`owner_id = user.id`)
- **State** : Ajouter `stores: VendorStore[]` et `activeStoreIndex` pour gérer la boutique active
- **Store Switcher** : Dans le sidebar desktop et le header mobile, afficher un dropdown de sélection de boutique si le vendeur en a plusieurs. Si une seule boutique, pas de switcher affiché
- Le reste du dashboard fonctionne sur `stores[activeStoreIndex]`

### 5. BecomeVendorPage — Guard multi-boutique avec exemption plateforme

**Fichier** : `frontend/src/pages/BecomeVendorPage.tsx`

- Si l'utilisateur possède déjà une boutique :
  - **Boutique plateforme** (`is_platform_owned = true`) : pas de restriction, il peut créer autant de boutiques que nécessaire (agent plateforme)
  - **Boutique indépendante** : vérifier l'ancienneté de la première boutique (`created_at + 3 mois`) et le `sales_count` (seuil configurable). Si non éligible, afficher un message explicatif bloquant la soumission

### 6. Attribution admin — Créer et assigner une boutique

**Fichier existant** : Les admins peuvent déjà créer des boutiques via la politique RLS "Staff can insert stores". Il faut s'assurer que l'interface admin permet de :

- **Créer une boutique** en spécifiant un `owner_id` (utilisateur existant)
- **Assigner le rôle vendeur** automatiquement à l'utilisateur ciblé (insert dans `user_roles` si absent)
- Cela sera ajouté dans la page admin existante de gestion des boutiques ou via `AdminVendorPricingPage.tsx`

**Nouveau** : Ajouter un bouton "Créer une boutique pour un utilisateur" dans l'espace admin (page stores ou vendor pricing) avec un formulaire permettant de :
  - Chercher un utilisateur par email
  - Nommer la boutique
  - Définir `is_platform_owned` (oui/non)
  - Soumettre → insert dans `stores` + insert dans `user_roles` (role=vendor si absent)
  - Pas de restriction d'éligibilité puisque c'est l'admin qui décide

## Règle métier clé

```text
Eligibilité multi-boutique :
├── Boutique plateforme (is_platform_owned=true) → aucune limite, l'admin contrôle
├── Vendeur indépendant avec 1ère boutique < 3 mois → bloqué
├── Vendeur indépendant avec 1ère boutique ≥ 3 mois + seuil ventes → autorisé
```

## Fichiers impactés

| Fichier | Action |
|---|---|
| `PricingPage.tsx` | Texte, toggle, tarif hub, retrait pénalité |
| `TermsPage.tsx` | Section pénalités Hub |
| `AdminDeliveryPlansPage.tsx` | Fallback 0.59 → 0.25 |
| `VendorDashboardPage.tsx` | Multi-store fetch + store switcher |
| `BecomeVendorPage.tsx` | Guard multi-boutique + exemption plateforme |
| Page admin (stores/pricing) | Bouton création boutique + assignation utilisateur |

## Pas de migration DB requise

La table `stores` supporte déjà `owner_id` et `is_platform_owned`. La table `user_roles` existe. Aucune modification de schéma nécessaire.

