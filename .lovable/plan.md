## Diagnostic

L’écran « Oups ! Un problème est survenu » vient très probablement d’une règle React cassée dans `CheckoutPage.tsx` : un `useState` et un `useEffect` pour `isDesktop` sont déclarés vers la fin du composant, après plusieurs retours conditionnels (`non connecté`, `KYC bloqué`, `panier vide`).

Quand l’état du checkout change selon le panier ou l’utilisateur, React peut voir un nombre de hooks différent entre deux rendus, ce qui déclenche l’`ErrorBoundary` et affiche exactement l’écran de la capture.

J’ai aussi vu une requête `store_package_subscriptions` qui répond en 400, mais elle n’a pas déclenché l’écran d’erreur dans ma session. Elle doit être rendue non bloquante pour éviter d’ajouter du bruit au checkout.

## Correctif proposé

1. **Stabiliser les hooks React dans `CheckoutPage.tsx`**
   - Déplacer l’état `isDesktop` et son `useEffect` avant tous les retours conditionnels.
   - Supprimer la déclaration tardive actuelle pour éviter tout changement d’ordre des hooks.

2. **Sécuriser la requête d’abonnement livraison**
   - Modifier la requête `clientDeliverySub` pour retourner `null` en cas d’erreur au lieu de laisser l’erreur se propager.
   - Conserver le checkout fonctionnel même si l’abonnement livraison ne peut pas être lu.

3. **Vérifier après correction**
   - Ouvrir `/checkout` dans le preview.
   - Confirmer que la page ne tombe plus sur l’`ErrorBoundary`.
   - Vérifier que le formulaire d’expédition et le récapitulatif restent visibles comme sur la capture saine.

## Fichiers concernés

- `frontend/src/pages/CheckoutPage.tsx`

Aucune modification de domaine, infrastructure, backend de production ou variables d’environnement.