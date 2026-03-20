

# Nettoyage doublons + Optimisation financière du système de fidélité/parrainage

## État actuel de la base de données

### Doublons identifiés

**`affiliate_tiers`** — 9 lignes, 2 jeux en doublon :
- Ancien jeu (français) : Bronze(0), Argent(5), Or(15), Platine(50)
- Nouveau jeu (anglais) : Starter(0), Bronze(10), Silver(50), Gold(150), Platinum(500)

**`customer_tiers`** — 14 lignes, 2 jeux en doublon :
- Ancien jeu (minuscule) : client, junior, senior, professionnel, business, elite, angel
- Nouveau jeu (emoji) : Client, Junior, Senior, Pro, Business, Elite, Angel

### Paramètres actuels trop généreux

| Paramètre | Valeur actuelle | Problème |
|-----------|----------------|----------|
| `commission_pct` | **10%** | Trop élevé — sur $100, parrain gagne 10 pts = $0.20 (au taux 50:1) mais c'est 10% du subtotal en points |
| `welcome_discount_pct` | **10%** | Le filleul reçoit 10% de réduction immédiate |
| `max_rewarded_orders` | 5 | 5 commandes récompensées par filleul |
| `points_expiry_months` | 12 | Acceptable mais réductible |
| `points_per_dollar` | 50 | Correct |
| Palier Platine commission | **15%** | Beaucoup trop généreux |
| Palier Business discount | **10%** | Coûteux |
| Palier Angel discount | **15%** | Très coûteux |

## Valeurs recommandées (approche "magnat de la finance")

### Paramètres de parrainage (`referral_settings`)

```text
Paramètre                Avant    Après     Économie
──────────────────────────────────────────────────────
commission_pct           10%      3%        -70%
welcome_discount_pct     10%      5%        -50%
max_rewarded_orders      5        3         -40%
points_expiry_months     12       6         Points expirent 2x plus vite
points_per_dollar        50       100       Coût réel divisé par 2
```

**Exemple concret avec les nouvelles valeurs :**
- Filleul passe une commande de $100
- Parrain gagne : 3% × $100 = 3 points
- Valeur réelle : 3 pts ÷ 100 = **$0.03** (au lieu de $0.20 avant)
- Sur 3 commandes max : $0.09 total par filleul (au lieu de $1.00)
- Le filleul reçoit 5% de réduction sur sa 1ère commande = $5 (au lieu de $10)
- **Coût total par parrainage actif : ~$5.09** (au lieu de ~$11.00)

### Paliers d'affiliation (5 niveaux, nettoyés)

```text
Nom        Min filleuls   Commission   Bonus pts   Coût réel bonus
─────────────────────────────────────────────────────────────────────
Starter    0              3%           0            $0.00
Bronze     10             4%           25           $0.25
Silver     30             5%           75           $0.75
Gold       75             6%           150          $1.50
Platinum   200            7%           300          $3.00
```

Commissions plafonnées à 7% (au lieu de 15%). Bonus points réduits drastiquement (max 300 pts = $3 au lieu de 2000 pts = $20).

### Paliers client (7 niveaux, nettoyés)

```text
Nom        Min cmd   Min dépensé   Réduction   Avant
─────────────────────────────────────────────────────────
Client     0         $0            0%           0% ✓
Junior     20        $500          1%           1% ✓
Senior     100       $2000         2%           3% → 2%
Pro        250       $5000         3%           5% → 3%
Business   500       $10000        5%           10% → 5%
Elite      1000      $50000        7%           12% → 7%
Angel      1500      $100000       10%          15% → 10%
```

Les réductions sont progressives mais plafonnées à **10%** au lieu de 15%.

## Plan d'implémentation

### 1. SQL de nettoyage + mise à jour des valeurs

Fournir un script SQL idempotent qui :
- Supprime les doublons anciens (jeu français) des `affiliate_tiers`
- Supprime les doublons anciens (jeu minuscule) des `customer_tiers`
- Met à jour les paliers restants avec les nouvelles commissions/bonus réduits
- Met à jour `referral_settings` avec les valeurs optimisées
- Script prêt à coller dans le SQL Editor de Supabase

### 2. Mise à jour du code frontend

- `AdminSettingsPage.tsx` : Valeurs par défaut alignées sur les nouvelles (3%, 5%, 3 commandes, 6 mois, 100 pts/$1)
- Vérifier que `ReferralDashboard.tsx` et `CheckoutPage.tsx` lisent bien `points_per_dollar` dynamiquement (déjà fait)

### 3. Mise à jour du trigger `create_pending_referral_points`

Le trigger SQL utilise `referral.commission_pct` (issu de la table `referrals`), pas du `platform_settings`. Le `commission_pct` par défaut sur la table `referrals` est déjà 5 — il faudra le passer à 3 via une migration ALTER DEFAULT.

### Fichiers modifiés

| Fichier | Action |
|---------|--------|
| SQL (fourni + migration) | Nettoyage doublons, mise à jour paliers, mise à jour referral_settings, ALTER DEFAULT referrals |
| `AdminSettingsPage.tsx` | Valeurs par défaut frontend alignées |

