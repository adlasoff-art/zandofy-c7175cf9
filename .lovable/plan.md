

# Plan — Protection financiere anti-perte + reduction commissions affiliation

## Etat actuel de la base de donnees

| Systeme | Valeurs actuelles |
|---|---|
| **Fidelite** | Client 0% → Junior 1% → Senior 2% → Pro 3% → Business 5% → Elite 7% → Angel 10% |
| **Affiliation** | Starter 3% → Bronze 4% → Silver 5% → Gold 6% → Platinum 7% |
| **Parrainage** | 3% commission, 3 commandes max |
| **Bulk discount** | 0% / 5% / 12% / 15% (par quantite) |
| **Plafond global** | AUCUN — pas de cap dans le code ni en DB |

## Analyse du risque avec la marge de 30%

La marge exploitable est de 30% (sur les 45% de markup). Voici le pire cas actuel :
- Fidelite Angel : **10%**
- Bulk 1000+ : **15%**
- Coupon : **variable**
- Total possible : **25%+** → ne reste que 5% pour couvrir parrainage/affiliation → **PERTE**

## 1. Reduire les commissions d'affiliation

Les affilies (influenceurs) generent des ventes via un lien. La commission doit etre attractive mais pas destructrice.

**Nouvelles valeurs proposees** :

| Palier | Filleuls min | Commission actuelle | Commission proposee | Bonus pts |
|---|---|---|---|---|
| Starter | 0 | 3% | **1.5%** | 0 |
| Bronze | 10 | 4% | **2%** | 25 |
| Silver | 30 | 5% | **2.5%** | 75 |
| Gold | 75 | 6% | **3%** | 150 |
| Platinum | 200 | 7% | **3.5%** | 300 |

**Justification** : Meme au palier Platinum (3.5%), combine avec Angel (10%) et bulk (15%), le plafond global (voir point 2) garantit que la somme ne depasse jamais 20%.

## 2. Plafond global de reductions au checkout

Ajouter dans `CheckoutPage.tsx` un cap dur sur le cumul de toutes les reductions :

```text
totalDiscountPct = loyaltyPct + couponPct + bulkPct
Si totalDiscountPct > max_total_discount_pct (defaut 20%) :
  → Reduire proportionnellement chaque composante
  → Afficher message au client

pointsDiscount plafonné séparément à max_points_discount_pct (defaut 10%) du subtotal
```

**Valeur recommandee : 20%** → Sur les 30% exploitables, il reste toujours 10% minimum pour l'entreprise.

**Impact pire cas** :
```text
Produit coût $4.99
Prix de vente ≈ $7.60 (formule ×1.5225)
Reduction max 20% : -$1.52
Points max 10% : -$0.76
Revenu net : $5.32
Coût reel : $5.24 (avec 5% transaction)
Marge nette : $0.08 minimum → JAMAIS EN PERTE ✓

Cas typique (Senior 2% + pas de bulk + pas de coupon) :
Reduction : 2% = -$0.15
Revenu net : $7.45
Marge nette : $2.21 → CONFORTABLE ✓
```

## 3. Section admin "Plafond de reductions"

**Fichier** : `AdminSettingsPage.tsx`

Ajouter une nouvelle section avec :
- **Plafond global reductions** : input (defaut 20%)
- **Plafond points** : input (defaut 10%)
- **Toggle bonus points affiliation** : desactive par defaut — controle si les bonus points des paliers d'affiliation sont credites automatiquement

## 4. Logique affiliation vs parrainage

Le systeme actuel distingue deja les deux :
- **Parrainage** = table `referrals` (referrer_id → referee_id), commission sur 3 premieres commandes livrees
- **Affiliation** = table `affiliate_links` (liens partageables), tracking clics/conversions

**Clarification** : Quand un achat vient d'un lien d'affiliation, c'est la commission d'affiliation qui s'applique (palier de l'affilie). Le parrainage ne s'applique PAS en plus. Le code actuel gere deja cette separation.

## 5. Donnees a inserer en DB

```sql
-- Plafond de reductions (nouvelle cle platform_settings)
INSERT INTO platform_settings (key, value) VALUES (
  'max_discount_settings',
  '{"max_total_discount_pct": 20, "max_points_discount_pct": 10}'::jsonb
) ON CONFLICT (key) DO NOTHING;

-- Toggle bonus affiliation dans referral_settings
UPDATE platform_settings
SET value = value || '{"affiliate_bonus_enabled": false}'::jsonb
WHERE key = 'referral_settings';

-- Reduire les commissions d'affiliation
UPDATE affiliate_tiers SET commission_pct = 1.5 WHERE tier_name = 'Starter';
UPDATE affiliate_tiers SET commission_pct = 2 WHERE tier_name = 'Bronze';
UPDATE affiliate_tiers SET commission_pct = 2.5 WHERE tier_name = 'Silver';
UPDATE affiliate_tiers SET commission_pct = 3 WHERE tier_name = 'Gold';
UPDATE affiliate_tiers SET commission_pct = 3.5 WHERE tier_name = 'Platinum';
```

**Aucune migration de schema requise** — ce sont uniquement des mises a jour de donnees existantes.

## Fichiers modifies

| Fichier | Action |
|---|---|
| `CheckoutPage.tsx` | Charger `max_discount_settings`, appliquer le cap sur cumul reductions + points |
| `AdminSettingsPage.tsx` | Ajouter section plafond + toggle bonus affiliation |
| `AffiliateDashboard.tsx` | Conditionner affichage bonus points sur `affiliate_bonus_enabled` |

## Resume de la protection

```text
┌─────────────────────────────────────────────────┐
│           MARGE TOTALE : 45% du coût            │
├─────────────────────────────────────────────────┤
│ 15% → Marge incompressible entreprise     🔒    │
│ 30% → Marge exploitable                        │
│   ├─ Fidelite : 0-10% (plafonné à 20% cumul)   │
│   ├─ Coupon : 0-10% (plafonné à 20% cumul)     │
│   ├─ Bulk : 0-15% (plafonné à 20% cumul)       │
│   ├─ Points : 0-10% du subtotal (cap séparé)   │
│   ├─ Parrainage : 3% × 3 commandes seulement   │
│   ├─ Affiliation : 1.5-3.5% (réduit)           │
│   └─ Reste minimum garanti : ≥ 6.5%      ✓     │
└─────────────────────────────────────────────────┘
```

