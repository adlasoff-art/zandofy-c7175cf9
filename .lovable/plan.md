

# Correction du cache produits — implémentation sûre

## Résumé

3 changements isolés, chacun indépendant des autres. Aucune migration SQL. Aucun fichier sensible (Docker, env, routing) touché.

## Analyse de risque

| Changement | Risque | Mitigation |
|---|---|---|
| `staleTime: 0` sur StorePage | Aucun — ne touche que cette requête | Les autres pages gardent le staleTime global de 5 min |
| Exclusion produits du cache SW | Très faible — ajoute une condition `return` avant le cache API | Les requêtes produits passent simplement en network-only |
| Panneau admin cache | Aucun — ajout d'UI, pas de modification existante | Utilise les messages SW déjà supportés (`CLEAR_CACHES`, `REFRESH_CATALOG`) |

**Aucun impact** sur : l'authentification, le panier, les paiements, le chat, les commandes, le SEO, le PWA install prompt.

## Changements

### 1. `frontend/src/pages/StorePage.tsx` (lignes 108-114)

Ajouter `staleTime: 0` et `refetchOnMount: 'always'` à la requête produits existante. Rien d'autre ne change dans ce fichier.

```tsx
const { data: products, isLoading: productsLoading } = useQuery({
  queryKey: ["store-products", store?.id],
  queryFn: async () => {
    return await fetchProducts({ storeId: store!.id });
  },
  enabled: !!store?.id,
  staleTime: 0,
  refetchOnMount: 'always',
});
```

### 2. `frontend/public/sw.js` (après ligne 84)

Ajouter une exclusion pour les requêtes produits Supabase, afin qu'elles ne soient jamais servies depuis le cache SW :

```js
// Skip product API calls — always fetch fresh
if (url.pathname.includes("/rest/v1/products")) return;
```

### 3. `frontend/src/pages/admin/AdminSettingsPage.tsx`

Ajouter un bloc "Gestion du cache" en fin de page avec 2 boutons :
- **Purger le cache** : envoie `CLEAR_CACHES` au SW + `queryClient.clear()` + reload
- **Rafraîchir le catalogue offline** : envoie `REFRESH_CATALOG` au SW

Ce bloc utilise les messages SW déjà implémentés — aucune modification du service worker nécessaire pour cette partie.

## Fichiers modifiés

- `frontend/src/pages/StorePage.tsx` — 2 lignes ajoutées
- `frontend/public/sw.js` — 2 lignes ajoutées
- `frontend/src/pages/admin/AdminSettingsPage.tsx` — nouveau bloc UI (~40 lignes)

