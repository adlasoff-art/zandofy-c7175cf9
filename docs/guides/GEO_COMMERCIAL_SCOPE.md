# Geo commercial scope (Zandofy)

## Glossaire

| Terme | Signification | Exemple |
|-------|---------------|---------|
| **Localisation** | Où se trouve la boutique / le compte | `stores.city_id`, `profiles.home_city_id` |
| **shop_type** | Capacité **opérationnelle** (KYB, flows legacy, Discovery local-first) | `local` \| `international` |
| **default_commercial_scope** | Où la boutique accepte de **vendre** par défaut | `city` \| `country` \| `international` (défaut SQL = `country`, pas `inherit_ops`) |
| **commercial_scope** (produit) | Override produit | `inherit` \| `city` \| `country` \| `international` \| `custom` |
| **Destination mode** | Règle villes d’un pays | `whole_country` \| `selected_cities` \| **`except_cities`** |
| **purchase_scope** (Discovery) | Préférence **ranking** acheteur | `city` \| `country` \| `any_country` |
| **geo_relation** | Relation store ↔ shipping | `same_city` \| `same_country_other_city` \| `cross_border` |

## Feature flag

`platform_settings.geo_eligibility_enforced` (défaut `false`).

- **false** : soft (RPC toujours eligible)
- **true** : feed filtré + checkout fail-closed + trigger `order_items`

## Migrations (ordre)

1. `…130000` → `…138000` (déjà appliquées côté staging si vous l’avez fait)
2. **`20260926139000_geo_destination_except_cities.sql`** ← à exécuter maintenant (exclusions villes)

## Exclusions « pays sauf… » (livré)

- Mode `except_cities` : liste = villes **exclues** (deny-list).
- Disponible pour scope **country** (ex. RDC nationale sauf villes inaccessibles) et **international**.
- Produits `custom` : même mode.
- Si `city_id` destination inconnu (feed pays seul) → encore éligible ; le refus se joue quand la ville est connue (checkout / prefs ville).

## Checklist smoke (flag on)

1. Vendeur scope **country**, destination CD mode **except_cities**, exclure ville A
2. Checkout vers ville A → bloqué (toast + éventuel erreur SQL `GEO_ELIGIBILITY`)
3. Checkout vers ville B → OK ; `orders.geo_relation` + `shipping_city_id` renseignés
4. Discovery prefs ville A → produit absent du feed ; ville B → présent

## Encore reporté (ne pas coder maintenant)

| Sujet | Pourquoi plus tard |
|-------|-------------------|
| PostGIS / distance | Pas requis pour V1 commercial scope |
| `shipping_responsibility` | Logistique assistée Zandofy |
| Assisted shipping Zandofy | Produit à part |
| Table `countries` UUID | ISO2 suffit en V1 |

## Risques résiduels & statut

| Risque | Statut |
|--------|--------|
| Migrations 370/380 non appliquées | ✅ Vous les avez exécutées |
| Migration **390** except_cities | ⚠️ À exécuter sur staging |
| Boutique sans `country_code` ISO2 + flag on | Surveiller ; renseigner géo boutique |
| Tracking snake | Aligné sur `getCustomerTrackingSteps` |
| `types.ts` partiel | Colonnes géo orders/stores ajoutées manuellement |
| Latence RPC sous charge | À mesurer en staging |
| Embeds PostgREST après recreate view | Smoke listing produit après 340 |

## Rollout

1. SQL 390 staging → smoke exclusions
2. Deploy frontend (flag **off**)
3. Pilotes : configurer except_cities
4. Flag on staging → valider
5. Même SQL prod → flag off → monitor → flag on
