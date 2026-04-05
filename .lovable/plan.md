

# Plan — Systeme de Packages de Services (Composition Admin + Paliers Vendeurs + Client)

## Contexte actuel

**Tables existantes :**
- `platform_service_plans` : services individuels (clé, label, prix mensuel/annuel)
- `delivery_subscriptions` : abonnements livraison (plan_type, tier, max_riders, hub_storage)
- `hub_storage_tracking` : suivi stockage hub (poids, pénalités)
- `vendor_subscriptions` : abonnement boutique (tier, max_products, whatsapp, self_deliver)
- `vendor_wallets` : solde vendeur (pending, available, retention_days)
- `platform_settings` : config clé/valeur (delivery_plans, pricing_defaults)

**Probleme :** Les services sont gérés individuellement. L'admin ne peut pas composer de "packs" regroupant services + logistique + règles financières. Les paliers (Standard/Pro/Premium/Entreprise) ne sont pas modélisés comme entités configurables.

## Architecture proposée

### 1. Nouvelle table `service_packages`

Table centrale pour les packs composés par l'admin :

```text
service_packages
├── id uuid PK
├── name text ("Standard", "Pro", "Premium", "Entreprise")
├── slug text unique ("standard", "pro", "premium", "enterprise")
├── description text
├── target text ("vendor" | "client")
├── price_monthly numeric
├── price_yearly numeric
├── included_services text[] (références aux service_keys de platform_service_plans)
├── max_deliveries_per_day int
├── max_riders int
├── hub_storage_free_kg numeric (0 = payant, 10, 50, 250)
├── withdrawal_delay_days int (30, 14, 7)
├── trust_threshold_months int (0, 3, 1, null=sur-mesure)
├── trust_threshold_sales numeric (montant minimum de ventes)
├── visibility_level text ("standard" | "badge_verified" | "homepage_promo" | "dedicated_manager")
├── rank int (ordre d'affichage / hiérarchie)
├── is_active boolean
├── features jsonb (détails supplémentaires libres)
├── created_at / updated_at
```

### 2. Nouvelle table `store_package_subscriptions`

Lie un pack à une boutique :

```text
store_package_subscriptions
├── id uuid PK
├── store_id uuid FK → stores
├── package_id uuid FK → service_packages
├── subscribed_at timestamptz
├── paid_until timestamptz
├── billing_cycle text ("monthly" | "yearly")
├── is_active boolean
├── trust_unlocked boolean (withdrawal réduit débloqué)
├── trust_unlocked_at timestamptz
├── created_at / updated_at
```

### 3. Modifications DB (migration)

- Creer `service_packages` + RLS (lecture publique, écriture admin)
- Creer `store_package_subscriptions` + RLS (vendeur lit les siennes, admin gère tout)
- Les tables existantes (`platform_service_plans`, `delivery_subscriptions`) restent intactes pour rétro-compatibilité
- Trigger : quand un `store_package_subscription` est activé, mettre à jour `vendor_wallets.retention_days` selon le pack

### 4. Interface Admin — Composition de Packs

**Fichier** : refonte de `AdminServicePlansPage.tsx` ou nouvelle page `/admin/service-packages`

L'admin pourra :
- **Creer un Pack** : nom, slug, description, cible (vendeur/client)
- **Sélectionner les services inclus** : checkbox parmi les `platform_service_plans` existants (WhatsApp, Coupons, COD, etc.)
- **Variables logistiques** : courses/jour, livreurs, poids gratuit Hub (kg)
- **Règles de retrait** : délai (30j/14j/7j), seuil de confiance (mois + montant ventes)
- **Visibilité** : Standard / Badge vérifié / Accueil & Promo / Gestionnaire dédié
- **Prix** : mensuel / annuel
- **Activation/désactivation**

### 5. Paliers vendeurs pré-configurés (seed data)

| | Standard | Pro | Premium | Entreprise |
|---|---|---|---|---|
| Retrait | 30j | 14j (après 3m + seuil) | 7j (après 1m + seuil) | Personnalisé |
| Courses/jour | 5 | 20 | 50 | 100 |
| Livreurs | 1 | 3 | 5 | 10 |
| Hub gratuit | 0 kg (payant) | 10 kg | 50 kg | 250 kg |
| Visibilité | Standard | Badge vérifié | Accueil & Promo | Gestionnaire dédié |
| Services | WhatsApp, Coupons | + Fournisseurs, COD, Retours | + Marge auto, Collaborateurs | Tout inclus + API |

### 6. Pages UI impactées

| Fichier | Action |
|---|---|
| `AdminServicePlansPage.tsx` | Ajouter onglet "Packages" ou le transformer en page de composition |
| `VendorPricingTab.tsx` | Afficher les packs au lieu des services individuels, bouton "Souscrire" par pack |
| `PricingPage.tsx` | Afficher les paliers vendeurs et clients en lecture seule |
| `AdminDeliveryPlansPage.tsx` | Lier les plans de livraison aux packs |
| `AdminSidebar.tsx` | Ajouter lien "Packages" si page séparée |

### 7. Logique métier

- **Hiérarchie** : un pack supérieur inclut tous les services des packs inférieurs (vérifié par `rank`)
- **Seuil de confiance** : le délai de retrait réduit (14j, 7j) ne s'active qu'après X mois d'activité + Y$ de ventes. Avant ça, le vendeur reste à 30j même s'il a le pack Pro/Premium
- **Hub** : le stockage gratuit du pack (ex: 10kg pour Pro) remplace la logique forfaitaire actuelle. Si le stock dépasse le quota gratuit, la pénalité 0.59$/jour s'applique sur l'excédent
- **Clients** : seuls les packs marqués `target = 'client'` sont visibles dans le dashboard client (forfaits livraison)

### 8. Runtime error fix

Le `QueryClient` error sur `Index.tsx` est un problème d'ordre de providers — sera corrigé silencieusement.

## Pas de perte de données

Les tables `platform_service_plans` et `delivery_subscriptions` restent en place. Les `service_packages` les référencent par `service_key`. La migration est additive et idempotente.

## Fichiers à créer/modifier

1. **Migration SQL** — `service_packages` + `store_package_subscriptions` + seed 4 paliers + trigger retrait
2. **`AdminServicePackagesPage.tsx`** (nouveau) — composition de packs
3. **`VendorPricingTab.tsx`** — affichage packs + souscription
4. **`PricingPage.tsx`** — paliers publics
5. **`AdminSidebar.tsx`** — lien navigation
6. **`App.tsx`** — route admin

