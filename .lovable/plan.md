

# Correction : produits invisibles sur les pages boutiques

## Probleme identifie

Le bug est dans `StorePage.tsx` ligne 111. Le code passe le parametre URL brut (`id`) a `fetchProducts({ storeId: id })`. Or ce parametre peut etre un **slug** (ex: `ma-boutique`) et non un UUID. La requete fait alors `WHERE store_id = 'ma-boutique'` qui ne retourne jamais rien.

La requete de chargement du store (lignes 87-103) resout correctement slug → UUID, mais le chargement des produits (lignes 108-114) ne reutilise pas le store resolu.

## Correction

**Fichier** : `frontend/src/pages/StorePage.tsx`

Modifier le query des produits pour utiliser `store.id` (UUID resolu) au lieu du parametre URL brut :

```typescript
const { data: products, isLoading: productsLoading } = useQuery({
  queryKey: ["store-products", store?.id],
  queryFn: async () => {
    return await fetchProducts({ storeId: store!.id });
  },
  enabled: !!store?.id,
});
```

C'est un changement de 3 lignes. Aucune migration SQL necessaire — le probleme est purement cote code.

## Impact

- Corrige l'affichage "0 articles" sur toutes les boutiques accedees par slug
- Les boutiques accedees par UUID directement fonctionnaient peut-etre deja
- Aucun risque de regression

