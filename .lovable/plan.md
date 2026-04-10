

# Plan : Bannière PWA Install fiable + Estimation frais mobile

## Probleme 1 : Estimation frais "Aucune ville trouvée" sur mobile

L'estimateur de frais utilise `onBlur` avec un `setTimeout` de 200ms pour fermer le dropdown. Sur mobile, le clavier virtuel et les événements tactiles provoquent des cycles blur/focus inattendus qui ferment le dropdown avant que les resultats n'arrivent, ou avant que l'utilisateur puisse les toucher.

De plus, les boutons de selection utilisent `onMouseDown` au lieu de `onPointerDown`, ce qui peut ne pas fonctionner correctement sur certains navigateurs mobiles.

### Corrections

**3 fichiers concernes** : `ProductShippingEstimator.tsx`, `PrecisionShippingEstimate.tsx`, `DynamicShippingCalculator.tsx`

Pour chacun :
- Augmenter le timeout `onBlur` de 200ms a 400ms pour laisser le temps aux interactions tactiles
- Remplacer `onMouseDown` par `onPointerDown` sur les boutons de selection de ville (meilleure compatibilite mobile)
- Ajouter une protection : ne pas fermer le dropdown si une recherche est en cours (`loading`)

## Probleme 2 : Banniere PWA Install absente sur mobile

Le composant `PWAInstallBanner.tsx` existe et fonctionne correctement pour iOS. Cependant, sur Android, si l'evenement `beforeinstallprompt` ne se declenche pas (cas frequent en environnement preview ou certains navigateurs), la banniere ne s'affiche jamais (ligne 116 : `if (!deferredPrompt) return null`).

### Corrections

**Fichier** : `PWAInstallBanner.tsx`

- Ajouter un fallback Android : si `beforeinstallprompt` ne se declenche pas apres 3 secondes, afficher quand meme une banniere avec instructions manuelles ("Menu > Ajouter a l'ecran d'accueil")
- Garder le comportement actuel si `beforeinstallprompt` se declenche (bouton Installer natif)
- Garder le comportement iOS inchange (guide 3 etapes)
- Garder la detection standalone (ne rien afficher si app deja installee)

**Fichier** : `App.tsx`

- Envelopper `CmsThemeInjector` dans un `ErrorBoundary` pour isoler le crash `No QueryClient set` et ne pas bloquer le rendu de la banniere PWA

## Fichiers modifies

- `frontend/src/components/ProductShippingEstimator.tsx` -- blur timeout + onPointerDown
- `frontend/src/components/PrecisionShippingEstimate.tsx` -- idem
- `frontend/src/components/DynamicShippingCalculator.tsx` -- idem
- `frontend/src/components/PWAInstallBanner.tsx` -- fallback Android
- `frontend/src/App.tsx` -- ErrorBoundary autour de CmsThemeInjector

