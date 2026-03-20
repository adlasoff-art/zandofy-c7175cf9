

# Correction de l'arrondi stratégique — pricing-utils.ts

## Problème

La fonction `strategicRound` actuelle a une logique à 3 paliers inutilement complexe :
- decimal ≥ 0.50 → `floor + 0.99` (OK)
- decimal ≥ 0.25 → `floor + 0.49` (gonfle : 16.30 → 16.49)
- decimal < 0.25 → `(floor-1) + 0.99` (baisse : 16.10 → 15.99)

Exemple avec $11.42 : raw = 16.559 → donne 16.99 (correct ici), mais d'autres montants donneraient des résultats incohérents.

## Solution

Remplacer par un arrondi simple : **toujours `Math.floor(price) + 0.99`**.

```text
Avant                         Après
─────────────────────────────────────────
16.559 → 16.99               16.559 → 16.99 ✓
16.30  → 16.49 (gonflé)      16.30  → 16.99 ✓
16.10  → 15.99 (baissé!)     16.10  → 16.99 ✓
25.70  → 25.49 (baissé!)     25.70  → 25.99 ✓
```

## Fichier modifié

| Fichier | Action |
|---------|--------|
| `frontend/src/lib/pricing-utils.ts` | Simplifier `strategicRound` → `Math.floor(price) + 0.99` |

## Impact

- **Pas de migration SQL** — la logique de pricing est 100% frontend
- Le même fichier est utilisé par le backend Vercel (`pricing-utils.ts`), donc le redéploiement Vercel appliquera la correction automatiquement
- `calculateOldPrice` utilise aussi `strategicRound`, donc l'ancien prix sera aussi arrondi proprement

