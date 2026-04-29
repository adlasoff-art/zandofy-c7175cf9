## Bug confirmé (un seul)

Very Speed : 0,540 kg réel → affiche **20,58 USD** au lieu de **17,90 USD** (forfait 1 kg).

JH (19 $), Saidi (19 $), Congo Queen Lubumbashi (15,50 $) = **tarifs corrects** configurés par l'admin. Pas de bug.

## Cause racine

Dans `quoteByKgTier` (`frontend/src/services/freightQuote.ts`, lignes 263-289), le calcul utilise le **poids facturable** (`chargeableWeightKg = max(réel, volumétrique)`) pour décider Cas A vs Cas B :

```text
billableRaw = chargeableWeightKg(0.540, cbm, 6000)
            = max(0.540, volumétrique)
            = ex. 0.97 ou 1.05 selon le CBM
```

Quand le poids volumétrique gonflé dépasse 1 kg → bascule en Cas B → `(billable + 0.1) × 17.90 ≈ 20,58`. Le client voit ça comme une arnaque.

## Règle métier (rappel client, validée)

- **Poids RÉEL agrégé < 1 kg** → forfait fixe = prix palier 1 kg.
- **Poids RÉEL agrégé ≥ 1 kg** → `(poids_réel + 0,1) × prix_par_kg` du palier matché.
- Le **poids volumétrique ne doit PAS faire basculer en Cas B** pour un produit physiquement léger. Il reste utile uniquement pour des cas extrêmes (gros carton de plumes), à traiter via warning admin, pas via re-tarification automatique.

## Correctif (chirurgical, 1 fichier)

### `frontend/src/services/freightQuote.ts` — fonction `quoteByKgTier`

Remplacer le test `if (billableRaw < 1)` par un test sur le **poids réel** :

```text
function quoteByKgTier(profile, tiers, totalCbm, totalWeightKg) {
  if (tiers.length === 0) return null;
  if (totalWeightKg <= 0) return null;

  const sortedTiers = [...tiers].sort((a, b) => a.min_kg - b.min_kg);
  const baseTier = pickKgTier(sortedTiers, 1) ?? sortedTiers[0] ?? null;
  if (!baseTier) return null;

  // Cas A : poids RÉEL < 1 kg → forfait 1 kg, peu importe le volumétrique
  if (totalWeightKg < 1.0) {
    const flat = baseTier.flat_price ?? baseTier.price_per_kg;
    if (flat == null) return null;
    return {
      type: "weight",
      label: "Forfait minimum (poids < 1 kg)",
      weight_kg: 1,
      unit: "kg",
      line_total: round2(Number(flat)),
    };
  }

  // Cas B : poids RÉEL ≥ 1 kg → (réel + 0.1) × prix/kg du palier matché
  const billableForPricing = round2(totalWeightKg + 0.1);
  let tier = pickKgTier(sortedTiers, billableForPricing)
          ?? sortedTiers.find(t => t.max_kg == null)
          ?? sortedTiers[sortedTiers.length - 1];
  if (!tier || tier.is_quote_only) { /* gestion quote_only inchangée */ }

  const pricePerKg = tier.price_per_kg ?? (tier.flat_price && tier.min_kg > 0 ? tier.flat_price / tier.min_kg : null);
  if (pricePerKg == null) return null;

  return {
    type: "weight",
    label: `${totalWeightKg.toFixed(2)} kg × ${pricePerKg.toFixed(2)} (palier ${tier.min_kg}${tier.max_kg ? `–${tier.max_kg}` : "+"})`,
    weight_kg: totalWeightKg,
    unit: "kg",
    unit_price: pricePerKg,
    line_total: round2(billableForPricing * pricePerKg),
  };
}
```

**Différence clé** : on remplace `billableRaw` (= max réel/volumétrique) par `totalWeightKg` (= poids réel pur) dans le test du seuil ET dans le calcul prorata. Le poids volumétrique n'intervient plus.

### Garde-fou volumétrique (warning, pas re-tarification)

Si `volumetricWeightKg(cbm, divisor) > totalWeightKg × 3`, ajouter dans `composeFreightQuote` un `warnings.push("Colis très volumineux par rapport au poids — vérification manuelle recommandée")`. Pure info admin, n'affecte pas le total.

### Tests

Mettre à jour `frontend/src/services/__tests__/freightQuote.test.ts` (la suite actuelle ne couvre pas `quoteByKgTier`) :


| Cas                         | Réel  | CBM   | Divisor | Prix/kg | Attendu                       |
| --------------------------- | ----- | ----- | ------- | ------- | ----------------------------- |
| Forfait pur                 | 0,540 | 0     | 6000    | 17,90   | **17,90**                     |
| Forfait malgré CBM gonflant | 0,540 | 0,008 | 6000    | 17,90   | **17,90** (avant fix : 20,58) |
| Limite haute Cas A          | 0,999 | 0     | 6000    | 17,90   | **17,90**                     |
| Seuil Cas B                 | 1,000 | 0     | 6000    | 17,90   | **19,69** (1,1 × 17,90)       |
| Cas B standard              | 1,200 | 0     | 6000    | 17,90   | **23,27** (1,3 × 17,90)       |
| 4 articles × 250 g          | 1,000 | 0     | 6000    | 17,90   | **17,90**                     |


## Fichiers modifiés

- `frontend/src/services/freightQuote.ts` (~30 lignes dans `quoteByKgTier` + 4 lignes dans `composeFreightQuote` pour le warning)
- `frontend/src/services/__tests__/freightQuote.test.ts` (6 nouveaux cas)

## Hors scope (à voir demain comme convenu)

- Options de livraison (last-mile / pickup) qui ne fonctionnent pas correctement.
- Pas de migration SQL nécessaire pour ce fix : pur calcul client.

## Validation post-déploiement

1. Recharger le checkout avec un produit 540 g → Very Speed doit afficher **17,90 $**.
2. Tester un produit 1,2 kg → Very Speed doit afficher **23,27 $**.
3. JH/Saidi restent à 19 $ (forfait inchangé), Congo Queen Lubumbashi à 15,50 $.