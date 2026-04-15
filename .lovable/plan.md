

# Toggle étiquettes admin + Localisation boutique + Interconnexions

## Résumé

3 problèmes identifiés :
1. **Pas de toggle admin** pour activer `shipping_labels_enabled` par boutique — la colonne existe en DB mais aucun switch dans l'interface admin
2. **Pas de champs localisation** sur la table `stores` (city, country, address) — l'edge function les référence mais ils n'existent pas
3. **Pas de section vendeur** pour renseigner l'adresse de la boutique

## Plan d'exécution

### 1. Migration SQL — Ajouter city, country, address à `stores`

```sql
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE public.stores ADD COLUMN IF NOT EXISTS country text;
```

Fichier export SQL téléchargeable dans `/mnt/documents/store_location_migration.sql`.

### 2. Admin — Toggle étiquettes dans AdminVendorPricingPage

Ajouter un switch "Étiquettes d'expédition" dans la page **Tarification par boutique** (`AdminVendorPricingPage.tsx`), entre le toggle "Gestion des fournisseurs" et le Webhook URL. Ce toggle contrôle `shipping_labels_enabled` dans `vendor_pricing_overrides`.

Ajouter aussi `shipping_labels_enabled` au payload `handleSave`.

### 3. Vendeur — Section localisation dans VendorSettings

Ajouter 3 champs (Adresse, Ville, Pays) dans la section **Paramètres** de l'espace vendeur (`VendorDashboardPage.tsx` → `VendorSettings`). Ces champs sont sauvegardés dans `stores.address`, `stores.city`, `stores.country`.

### 4. Interconnexions identifiées

Les champs `city`/`country`/`address` de la boutique serviront à :

| Fonctionnalité | Utilisation |
|---|---|
| **Étiquettes d'expédition** | Section FROM : nom boutique + ville + pays |
| **Page boutique publique** | Afficher la localisation sous le nom de la boutique (StorePage) |
| **Calcul shipping local** | Distance vendeur ↔ client pour le moteur logistique (haversine) — futur |
| **Filtres marketplace** | Filtrer les boutiques par ville/pays côté client — futur |
| **Factures / reçus** | Adresse de l'expéditeur dans les documents — futur |

Pour l'instant, seules les 2 premières seront implémentées (étiquettes + page boutique).

### 5. Page boutique publique — Afficher la localisation

Dans `StorePage.tsx`, afficher `📍 Ville, Pays` sous le nom de la boutique si ces champs sont renseignés.

### 6. Edge Function — Déjà OK

L'edge function `generate-shipping-labels` sélectionne déjà `stores.city` et `stores.country`. Une fois la migration appliquée, les données remonteront automatiquement.

## Fichiers modifiés/créés

| Fichier | Action |
|---|---|
| Migration SQL | `ALTER TABLE stores ADD city, country, address` |
| `/mnt/documents/store_location_migration.sql` | Export téléchargeable |
| `AdminVendorPricingPage.tsx` | Toggle `shipping_labels_enabled` |
| `VendorDashboardPage.tsx` (VendorSettings) | Champs adresse/ville/pays |
| `StorePage.tsx` | Affichage localisation boutique |

## Sécurité

Les colonnes `city`/`country`/`address` sont publiques (affichées sur la page boutique). Les RLS existantes sur `stores` couvrent déjà les permissions de lecture (public) et d'écriture (owner + admin). Aucune nouvelle politique nécessaire.

