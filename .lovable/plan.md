

# Correction urgente : produits invisibles sur les pages boutiques

## Diagnostic

**Deux problemes identifies :**

1. **Probleme de code (certain)** : `StorePage.tsx` appelle `fetchProducts()` sans filtre `store_id`, recupere TOUS les produits publies, puis filtre cote client. Avec la limite par defaut de 1000 lignes de Supabase, des produits peuvent etre manques. Plus important : c'est inefficace et fragile.

2. **Probleme de RLS probable (production)** : Les politiques RLS sur votre base de donnees **production** (`vpt...yxf`) peuvent avoir ete modifiees lors du hardening de securite. Je ne peux pas verifier cette base depuis Lovable Cloud. Il est possible que la table `stores` ait une politique SELECT restrictive sur production qui bloque les jointures dans `PRODUCT_SELECT`.

## Plan de correction

### Etape 1 — Ajouter le filtre `storeId` a `fetchProducts`

Modifier `frontend/src/services/api.ts` pour accepter un parametre `storeId` dans `fetchProducts()` et filtrer directement cote serveur :

```typescript
// Ajouter dans les params
storeId?: string;

// Ajouter dans la query
if (params?.storeId) {
  query = query.eq("store_id", params.storeId);
}
```

### Etape 2 — Modifier `StorePage.tsx` pour utiliser le filtre serveur

Remplacer :
```typescript
const allProducts = await fetchProducts();
return allProducts.filter((p) => p.storeId === id);
```

Par :
```typescript
return await fetchProducts({ storeId: id });
```

### Etape 3 — Verifier les politiques RLS (migration SQL)

Creer une migration qui s'assure que les bonnes politiques existent pour la lecture publique :

```sql
-- Garantir l'acces public en lecture aux produits publies
DROP POLICY IF EXISTS "Public read published products" ON public.products;
CREATE POLICY "Public read published products" ON public.products
  FOR SELECT TO anon, authenticated
  USING (publish_status = 'published');

-- Garantir l'acces public en lecture aux boutiques
DROP POLICY IF EXISTS "Anon read stores" ON public.stores;
CREATE POLICY "Anon read stores" ON public.stores
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Authenticated read stores" ON public.stores;  
CREATE POLICY "Authenticated read stores" ON public.stores
  FOR SELECT TO authenticated USING (true);
```

**Important** : Cette migration doit egalement etre executee sur votre base de donnees **production** (`vpt...yxf`) et **staging** (`wgi...wete`) via le SQL Editor de Supabase.

### Etape 4 — Fichier SQL pour synchronisation manuelle

Conformement a la regle #6 du Safety Policy, un fichier SQL telechareable sera fourni pour que vous puissiez l'appliquer sur vos deux instances Supabase (staging et production).

---

## Ce que vous devez faire manuellement apres mon intervention

1. **Appliquer le SQL** sur vos bases staging et production via le SQL Editor Supabase
2. **Verifier** que les produits s'affichent sur une page boutique cote Vercel
3. **Remettre la regle GitHub** une fois confirme

## Fichiers modifies

- `frontend/src/services/api.ts` — ajout du filtre `storeId`
- `frontend/src/pages/StorePage.tsx` — utilisation du filtre serveur
- Migration SQL pour les politiques RLS

