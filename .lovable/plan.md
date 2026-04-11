

# Plan : Scroll-to-top lors du changement d'étape Checkout

## Problème
Quand le client passe de l'étape "Expédition" à "Paiement" (ou "Confirmation"), la page reste à la même position de scroll. Sur mobile, le client doit remonter manuellement pour voir les options de paiement.

## Solution
Ajouter un `window.scrollTo(0, 0)` à chaque appel de `setStep()` dans `CheckoutPage.tsx`. Cela garantit que le haut de la page (avec les onglets et le contenu de l'étape) est visible immédiatement.

## Fichier modifié

| Fichier | Changement |
|---------|-----------|
| `frontend/src/pages/CheckoutPage.tsx` | Créer une fonction `goToStep(newStep)` qui appelle `setStep(newStep)` puis `window.scrollTo({ top: 0, behavior: 'smooth' })`. Remplacer tous les appels `setStep("payment")`, `setStep("confirmation")`, `setStep("shipping")` par `goToStep(...)`. |

## Détail technique

```typescript
const goToStep = (next: Step) => {
  setStep(next);
  window.scrollTo({ top: 0, behavior: "smooth" });
};
```

Environ 10+ occurrences de `setStep(...)` à remplacer par `goToStep(...)` dans le fichier. Aucun autre fichier impacté.

