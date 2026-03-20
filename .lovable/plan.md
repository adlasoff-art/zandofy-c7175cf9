

# Taux de conversion ZandoPoints → Dollars (configurable par l'admin)

## Problème actuel

Le système est codé en dur sur **1 point = $1**, ce qui est extrêmement coûteux pour la plateforme. Quand un parrain gagne 5% de commission sur une commande de $100, il reçoit 5 points = **$5** utilisables immédiatement. Aucun levier de contrôle.

## Recommandation stratégique

Voici une grille de taux analysée pour l'avantage plateforme :

```text
Taux              Coût réel        Exemple (100 pts)    Analyse
─────────────────────────────────────────────────────────────────
1 pt = $1.00      MAX (actuel)     $100.00              Ruineux
10 pts = $1       Élevé            $10.00               Encore cher
25 pts = $1       Modéré           $4.00                Correct
50 pts = $1       Économique       $2.00                ★ Recommandé
100 pts = $1      Très bas         $1.00                Trop restrictif
```

**Recommandation : 50 points = $1 USD** (soit `points_per_dollar = 50`)

Pourquoi :
- Commission parrainage 5% sur commande $100 = 5 points = **$0.10** de coût réel
- Le client doit accumuler beaucoup avant de convertir → fidélisation longue durée
- Suffisamment attractif pour que le programme reste motivant
- Valeur par défaut modifiable par l'admin à tout moment

## Plan d'implémentation

### 1. Ajouter le champ `points_per_dollar` dans `referral_settings`

Dans `AdminSettingsPage.tsx`, ajouter un nouveau champ dans la section Parrainage :
- Label : "Taux de conversion (points pour 1$)"
- Input numérique, min 1, max 500, défaut 50
- Texte explicatif : "Nombre de ZandoPoints nécessaires pour obtenir 1 USD en carte cadeau"
- Sauvegardé dans `platform_settings` → `referral_settings.points_per_dollar`

### 2. Appliquer le taux dans `ReferralDashboard.tsx`

- Charger `points_per_dollar` depuis `referral_settings`
- Conversion carte cadeau : `montant_dollar = points_saisis / points_per_dollar`
- Afficher le taux : "50 points = $1" au lieu de "1 point = $1"
- L'input permet de saisir des points, le montant dollar est affiché à côté
- La gift card est créée avec `original_amount = montant_dollar` et `points_used = points_saisis`

### 3. Appliquer au checkout (si points utilisés directement)

Vérifier si les points sont utilisables au checkout et appliquer le même taux de conversion.

### Fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| `AdminSettingsPage.tsx` | Ajouter champ `points_per_dollar` (input + save) |
| `ReferralDashboard.tsx` | Charger taux, convertir points→dollars, mettre à jour UI |
| Checkout (si applicable) | Appliquer le même taux |

Aucune migration SQL nécessaire — le champ est stocké en JSONB dans `platform_settings`.

