

## Diagnostic — "Error generating labels"

### Cause racine identifiée
L'edge function `generate-shipping-labels` utilise `supabase.auth.getClaims(token)` (ligne 51) — une méthode trop récente du SDK Supabase qui n'est pas disponible dans le runtime Deno actuel. Résultat : `claimsError` est toujours non-null → la fonction renvoie systématiquement **401 Unauthorized** → le toast affiche "Error generating labels".

**Preuve** : les autres edges fonctions du projet (`keccel-cardpay`, `subscribe-payment`) utilisent `supabase.auth.getUser(token)` qui fonctionne correctement. Seules deux fonctions utilisent `getClaims` — celle-ci et `verify-confirmation-code` (qui doit avoir le même bug latent).

### Effet secondaire observé
Le toast "Error generating labels" s'affiche plusieurs fois car le composant `ShippingLabelPreview` re-render et rappelle `fetchLabels()` à cause de la condition `if (open && !fetched && !loading)` placée dans le corps du composant (ligne 67) — un anti-pattern React qui déclenche plusieurs invocations.

## Solution

### Correctif 1 — remplacer `getClaims` par `getUser` (edge function)
Dans `supabase/functions/generate-shipping-labels/index.ts` lignes 50-58, remplacer :
```ts
const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
if (claimsError || !claimsData?.claims) { ... }
const userId = claimsData.claims.sub as string;
```
par le pattern éprouvé déjà utilisé partout :
```ts
const { data: { user }, error: authError } = await supabase.auth.getUser(token);
if (authError || !user) { return 401; }
const userId = user.id;
```

### Correctif 2 — supprimer le double appel côté client
Dans `ShippingLabelPreview.tsx` ligne 67, déplacer le `fetchLabels()` dans un `useEffect([open])` proprement, pour qu'il ne soit appelé qu'une seule fois à l'ouverture du dialog. Ça évitera le triple toast d'erreur.

### Correctif 3 (préventif) — appliquer le même fix sur `verify-confirmation-code`
Même pattern problématique → même fix `getUser(token)` pour éviter qu'un autre flux casse demain.

### Tests post-déploiement
1. Sur un compte vendeur, sélectionner une commande → cliquer "Imprimer étiquette" → la prévisualisation doit s'afficher.
2. Sur un compte admin, idem depuis `/admin/orders`.
3. Vérifier qu'un seul toast apparaît en cas d'échec réel.

### Risques
- Aucun. `getUser(token)` est utilisé en prod sur d'autres edges depuis longtemps.
- Aucune migration DB.
- Aucun changement visuel.

### Ordre d'exécution (en mode default)
1. Patcher l'edge function `generate-shipping-labels`
2. Patcher l'edge function `verify-confirmation-code`
3. Refactorer le `useEffect` dans `ShippingLabelPreview.tsx`
4. Déployer les edges → tester

Confirme et je passe en exécution.

