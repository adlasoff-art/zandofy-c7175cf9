

# Tarifs transitaires — Paliers CBM, tarifs par pièce, règles & restrictions

## 1. Comment ça marche AUJOURD'HUI (réponse à ta question)

Le système actuel des transitaires (`/admin/forwarders`) a **3 onglets par transitaire** :

| Bouton | Fonction | État actuel |
|---|---|---|
| 📍 **Couverture** | Pays + ville desservis (ex: CD-Kinshasa, CI-Abidjan) | OK |
| 💲 **Tarifs** | **Multiplicateur** appliqué sur le prix de base du Shipping Engine (ex: ×1.0 standard, ×1.3 express) | ⚠️ trop simpliste |
| ✏️ **Modifier** | Nom, logo, contact | OK |

**Où est renseigné le prix au CBM ?** → Nulle part directement sur le transitaire. Le **prix de base** vient de la table `shipping_routes` (par mode + zone d'origine→destination, ex: 430 $/CBM Chine→Kinshasa). Le transitaire applique ensuite **un multiplicateur unique** sur ce prix.

**Limites bloquantes pour ton use case** :
- ❌ Pas de **paliers par volume** (< 1 CBM, 1-5, 6-15, 16+)
- ❌ Pas de **tarifs par pièce** (téléphone 15 $/pc, ordinateur min 5pc à 20 $)
- ❌ Pas de **tarifs spécifiques par catégorie** côté transitaire (moto, voiture)
- ❌ Pas de **règles affichées au client** (acompte 30 % > 10 CBM, colis interdits, licences)
- ❌ Multiplicateur global → impossible d'avoir Kinshasa à 430 $ et Abidjan à 380 $ pour le même transitaire

## 2. Nouveau modèle de tarification (multi-villes, multi-paliers)

```text
Forwarder "TransGlobal Maritime"
├─ Coverage: CD/Kinshasa, CI/Abidjan
└─ Pricing Profiles (un par ville desservie)
   │
   ├─ Profile #1: Chine → Kinshasa (mode: sea)
   │  ├─ CBM Tiers (paliers volume)
   │  │   ├─ < 1 CBM      → 430 $/CBM
   │  │   ├─ 1 → 5 CBM    → 410 $/CBM
   │  │   ├─ 6 → 15 CBM   → 400 $/CBM
   │  │   └─ 16+ CBM      → "Sur devis" (négociable)
   │  ├─ Per-Piece Tiers (tarifs par pièce, par catégorie)
   │  │   ├─ Téléphone     → 15 $/pc, min 1
   │  │   ├─ Ordinateur    → 20 $/pc, min 5
   │  │   ├─ Moto          → 450 $/CBM (override CBM)
   │  │   └─ Voiture       → 500 $/CBM (dédouanement inclus)
   │  ├─ Rules
   │  │   ├─ Acompte 30 % si volume > 10 CBM
   │  │   └─ Délai: 35–45 jours
   │  └─ Restrictions (affichées au checkout)
   │      ├─ Interdits: armes, poudre, pétards, drogues
   │      └─ Sous licence: fer / acier inoxydable
   │
   └─ Profile #2: Chine → Abidjan (mode: sea)
      └─ … paliers/règles propres à Abidjan
```

## 3. Schéma DB (4 nouvelles tables + 1 modification)

### `forwarder_pricing_profiles` (1 par couple ville×mode)
```sql
id uuid PK
forwarder_id uuid FK
mode text        -- 'sea' | 'air' | 'road' | 'rail'
country_code text
city_id uuid NULL  -- NULL = tout le pays
currency text default 'USD'
transit_min_days int, transit_max_days int
deposit_pct numeric DEFAULT 0          -- 30 si > deposit_threshold_cbm
deposit_threshold_cbm numeric DEFAULT NULL  -- 10
notes text
is_active bool
unique(forwarder_id, mode, country_code, city_id)
```

### `forwarder_cbm_tiers` (paliers CBM)
```sql
id uuid PK
profile_id uuid FK
min_cbm numeric         -- 0, 1, 6, 16
max_cbm numeric NULL    -- 1, 5, 15, NULL=infini
price_per_cbm numeric NULL   -- NULL = "sur devis"
is_quote_only bool DEFAULT false
```

### `forwarder_piece_tiers` (tarifs par pièce et/ou catégorie)
```sql
id uuid PK
profile_id uuid FK
category_id uuid NULL   -- réutilise catégories existantes
custom_label text NULL  -- si pas de catégorie ("Téléphone", "Moto")
pricing_unit text       -- 'piece' | 'cbm' (override)
price numeric
min_quantity int DEFAULT 1
includes_customs bool DEFAULT false
```

### `forwarder_restrictions` (interdictions / licences)
```sql
id uuid PK
profile_id uuid FK   -- ou forwarder_id global
restriction_type text  -- 'forbidden' | 'license_required' | 'info'
label text             -- "Armes à feu", "Acier inoxydable (licence fournisseur)"
icon text NULL         -- 'warning' | 'ban' | 'info'
```

### Modification `forwarder_service_tiers`
Le multiplicateur global devient **optionnel** (pour rétrocompat). Les nouveaux profils prennent priorité.

## 4. UI Admin — Nouveau dialog "Profils tarifaires"

Remplace le dialog `$` actuel par un dialog plus riche organisé en accordéon :

```
[Modal] Tarifs — TransGlobal Maritime
┌──────────────────────────────────────────┐
│ + Nouveau profil                         │
├──────────────────────────────────────────┤
│ ▼ 🇨🇩 Kinshasa · Maritime · 35-45j       │
│   ┌─ Paliers CBM ─────────────────────┐ │
│   │ < 1 CBM        430 $    [×]      │ │
│   │ 1 → 5 CBM      410 $    [×]      │ │
│   │ 6 → 15 CBM     400 $    [×]      │ │
│   │ 16+ CBM        sur devis [×]     │ │
│   │ + Ajouter palier                 │ │
│   └──────────────────────────────────┘ │
│   ┌─ Tarifs par pièce / catégorie ───┐ │
│   │ Téléphone     15 $/pc  min 1 [×] │ │
│   │ Ordinateur    20 $/pc  min 5 [×] │ │
│   │ Moto          450 $/CBM      [×] │ │
│   │ Voiture       500 $/CBM ✓dédouan│ │
│   │ + Ajouter tarif                  │ │
│   └──────────────────────────────────┘ │
│   ┌─ Règles & restrictions ──────────┐ │
│   │ ⚠ Acompte 30% si volume > 10 CBM│ │
│   │ 🚫 Armes, poudre, drogues       │ │
│   │ 📋 Acier inox (licence fourn.)  │ │
│   │ + Ajouter règle                  │ │
│   └──────────────────────────────────┘ │
│ ▶ 🇨🇮 Abidjan · Maritime · 40-50j       │
└──────────────────────────────────────────┘
```

## 5. Calcul côté client (checkout)

```text
Volume cart = 3 CBM (sea, Chine→Kinshasa)
Catégories: 2× téléphone, 1× moto

Profil = "TransGlobal · Kinshasa · sea"
1. Tarifs par pièce d'abord (priorité catégorie):
   - 2 téléphones × 15 $ = 30 $
   - 1 moto → tarif CBM override: 0.6 CBM × 450 = 270 $
2. Volume restant non catégorisé: 2.4 CBM
   - Tier "1 → 5 CBM" → 2.4 × 410 = 984 $
3. Total transport = 30 + 270 + 984 = 1 284 $
4. Affichage règles:
   ⚠ Pas d'acompte (3 CBM < 10)
   🚫 Colis interdits: armes, poudre, drogues
   📋 Sous licence: acier inox
```

Un nouveau service `frontend/src/services/forwarder-pricing.ts` exposera `quoteForwarder({ profileId, items })` qui retourne `{ total, breakdown, deposit_required, restrictions }`.

## 6. Périmètre exact de l'implémentation

### Backend (1 migration prod, 1 RPC)
- ➕ `frontend/supabase/migrations/<ts>_forwarder_pricing_profiles.sql` — 4 tables ci-dessus, RLS admin/manager + read public actif
- ➕ RPC `quote_forwarder(profile_id, items_jsonb, total_cbm)` SECURITY DEFINER pour calcul autoritatif

### Frontend Admin
- ➕ `ForwarderPricingProfilesDialog.tsx` (remplace le dialog `$` actuel)
- ➕ Sous-composants : `CbmTiersEditor.tsx`, `PieceTiersEditor.tsx`, `RestrictionsEditor.tsx`
- ✏️ `ForwardersList.tsx` — bouton `$` ouvre le nouveau dialog

### Frontend Checkout (préparé, désactivé tant que `forwarders_config.enabled = false`)
- ➕ `frontend/src/services/forwarder-pricing.ts` — calcul + appel RPC
- ➕ `ForwarderRestrictionsBanner.tsx` (affichage règles + acompte)
- ✏️ Intégration dans le sélecteur de transitaire existant (composant déjà prévu côté checkout, on étend juste l'affichage)

### i18n
- Clés `forwarder.pricing.*` (FR/EN) ajoutées à `I18nContext.tsx`

## Détails techniques

- **Migration prod** : fournie en artifact téléchargeable + commit dans `frontend/supabase/migrations/` (auto-déploiement via GitHub Actions, conforme `deployment-workflow-sop`).
- **RLS** : INSERT/UPDATE/DELETE = `has_role('admin')` ou `has_role('manager')` ; SELECT public sur les profils actifs (via vue `v_forwarder_profiles_public` masquant notes internes).
- **Rétrocompat** : `forwarder_service_tiers` (multiplicateur) reste utilisé en fallback si aucun `forwarder_pricing_profiles` n'existe pour la route demandée → activation progressive sans casse.
- **Toggle de sécurité** : `forwarders_config.enabled` (existant) reste `false` en prod jusqu'à validation. Le checkout actuel n'est pas impacté.
- **Aucune action sur** : `shipping_routes`, `shipping_zones`, `shipping_defaults`, calcul Shipping Engine actuel — tout coexiste.

