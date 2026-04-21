

## Livraison des migrations SQL en fichiers téléchargeables

Pour chaque lot nécessitant une migration, je livrerai **d'abord** un fichier SQL téléchargeable dans `/mnt/documents/` que tu appliqueras **manuellement** sur :
1. Supabase **production** (`vpt...yxf` via `supabasa.zandofy.com`)
2. Supabase **staging** (via `supabasa-staging.zandofy.com`)

Je ne passe au code frontend qu'**après** ta confirmation que la migration est appliquée sur les deux environnements.

## Principe par lot

| Lot | Migration SQL ? | Livrable |
|---|---|---|
| **1** Fondations DB + Toggle | **OUI** | Fichier `.sql` téléchargeable (à appliquer manuellement staging + prod) |
| **2** Admin `/admin/forwarders` | Non | Code frontend uniquement |
| **3** Checkout client + Edge function | Probablement oui (snapshot `orders` + Edge) | Fichier `.sql` si besoin + code |
| **4** Dashboard transitaire | Non | Code frontend uniquement |
| **5** Demandes de changement | Non (tables déjà créées en lot 1) | Code frontend + Edge function |

## Lot 1 — Contenu du fichier SQL à livrer

Fichier : `20260421_forwarders_init.sql` — idempotent (`IF NOT EXISTS`, `OR REPLACE`) conforme memory `postgresql-migration-constraints-supabase`.

Contenu :

1. **Table `forwarders`** : identité (nom, slug, logo, owner_user_id → profiles, contact_email, contact_phone, origins TEXT[] ('china','turkey','dubai'), is_active, created_at)
2. **Table `forwarder_service_tiers`** : `(forwarder_id, mode 'air'|'sea', tier 'express'|'standard'|'vip', price_multiplier NUMERIC default 1.0, transit_min_days INT, transit_max_days INT, is_active BOOL)` + UNIQUE(forwarder_id, mode, tier)
3. **Table `forwarder_coverage`** : `(forwarder_id, country_code, city_id nullable, pickup_address, pickup_lat, pickup_lng, transit_days_override, is_active)` — city_id NULL = tout le pays
4. **Table `forwarder_rate_overrides`** : optionnelle, prix fixes par route/tier
5. **Table `shipment_assignments`** : `(order_id, forwarder_id, tier, mode, quoted_price, transit_days_min, transit_days_max, status, awb_bl, picked_up_at, arrived_at, created_at)`
6. **Table `forwarder_change_requests`** : demandes du transitaire (target_table, target_id, proposed_changes JSONB, status, admin_note)
7. **Extensions `orders`** : `ADD COLUMN IF NOT EXISTS forwarder_id uuid`, `forwarder_tier text`, `forwarder_quoted_price numeric`, `forwarder_unassigned boolean default false`
8. **Fonction SQL** `get_eligible_forwarders(p_country text, p_city_id uuid, p_mode text)` retournant forwarders + tiers + prix multiplicateur
9. **Insert `platform_settings`** clé `forwarders_config` avec `{ "enabled": false, "fallback_mode": "auto_calc", "require_selection": true }` → **OFF par défaut, zéro impact checkout actuel**
10. **RLS complet** :
    - `forwarders`, `forwarder_service_tiers`, `forwarder_coverage` : SELECT public (actifs), INSERT/UPDATE/DELETE admin+manager
    - `shipment_assignments` : SELECT (owner forwarder OU admin OU client de l'order), INSERT/UPDATE via Edge Function
    - `forwarder_change_requests` : INSERT owner forwarder, UPDATE admin
11. **Triggers** : `updated_at` standard, notification in-app au forwarder lors d'un `INSERT` dans `shipment_assignments`

## Question de fallback (rappel)

Avant de générer le SQL du Lot 1, choisis le comportement quand le toggle est ON mais qu'aucun transitaire ne couvre la destination :
- **A.** Silencieux → retombe sur calcul auto actuel + flag `forwarder_unassigned=true` (recommandé)
- **B.** Bloque le checkout
- **C.** Transitaire fictif "Zandofy Logistique"

## Workflow à partir d'ici

1. Tu réponds **A / B / C** + approuves ce plan
2. Je génère le fichier `.sql` du **Lot 1** et le dépose dans `/mnt/documents/` (tag `<lov-artifact>`)
3. Tu l'appliques manuellement sur staging puis production via Supabase SQL Editor
4. Tu confirmes → je passe au **Lot 2** (admin UI, sans migration)
5. Et ainsi de suite pour chaque lot

Aucune écriture de code frontend ne démarre avant ta confirmation d'application de la migration du lot correspondant.

