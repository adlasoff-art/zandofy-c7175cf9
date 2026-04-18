

## Diagnostic — "Edge Function returned a non-2xx status code"

### Ce que j'ai vérifié
1. **L'edge function répond** : test direct avec un faux UUID → `404 + {"error":"Aucune commande trouvée"}`. Donc la fonction est déployée, l'auth marche, le routing marche.
2. **Aucun log récent** dans `generate-shipping-labels` côté Supabase → la dernière invocation n'a même pas atteint la fonction OU le log a expiré.
3. **Le client `supabase.functions.invoke`** considère **toute réponse non-2xx comme une exception** et masque le body JSON utile. Le frontend essaie bien d'extraire `error.context.response.json()` mais ça échoue silencieusement dans certains cas (response déjà consommée, CORS, etc.) → toast générique "Edge Function returned a non-2xx status code".

### Cause racine probable
Deux problèmes qui se cumulent :

**A. Côté serveur (architectural)** : la fonction renvoie 401/403/404 sur erreur métier. C'est techniquement correct mais ça déclenche le wrapper d'erreur de `functions.invoke` qui mange le body. Le **pattern recommandé** (et utilisé partout sur Lovable) est de **toujours renvoyer 200** avec `{ ok: false, error: "..." }`.

**B. Côté métier (vraie cause du 404)** : la fonction fait un `select ... in("id", orderIds)` avec `supabaseAdmin` (service role) → ça **ne peut pas** renvoyer 0 résultat si l'ID existe. Donc soit :
   - Le frontend envoie un ID qui n'existe plus (suppression entre sélection et clic)
   - Le store_id de la commande n'est pas dans la liste des stores autorisées (le contrôle d'accès renvoie 403, pas 404)
   - **Plus probable** : la commande n'a pas de `store_id` valide ou la requête retourne `[]` à cause d'un filtre que je n'ai pas vu.

Je dois aussi vérifier si la commande sélectionnée a bien le statut requis pour l'impression (souvent les vendeurs essaient d'imprimer sur des commandes en `pending` alors que la fonction le bloque implicitement).

---

## Solution

### Correctif 1 — Refactoring "always 200, structured error"
Dans `generate-shipping-labels/index.ts`, créer un helper `respond(ok, payload)` qui renvoie **toujours 200** avec :
```ts
{ ok: boolean, error?: string, errorCode?: string, labels?: [] }
```
Tous les `return new Response(..., { status: 4xx })` deviennent `respond(false, { error, errorCode })`. Le client lit alors le body de manière fiable.

### Correctif 2 — Côté client : lire `data.ok` au lieu de `data.success`
Dans `ShippingLabelPreview.tsx`, simplifier le `fetchLabels()` :
```ts
const { data, error } = await supabase.functions.invoke(...);
if (error) { toast.error("Network error"); return; }
if (!data?.ok) { toast.error(data?.error || "Erreur inconnue"); return; }
if (!data.labels?.length) { toast.error("Aucune étiquette"); return; }
setLabels(data.labels);
```
Ça fait disparaître le toast "non-2xx" pour de bon, et l'erreur réelle ("Vendeur non autorisé", "Commande introuvable", etc.) s'affiche enfin.

### Correctif 3 — Diagnostic enrichi côté serveur
Ajouter dans la fonction des `console.log` ciblés :
- `userId`, `roles`, `orderIds reçus`, `orders trouvées (count)`, `store_ids vérifiés`
Pour qu'au prochain bug on voie immédiatement dans les logs ce qui cloche, sans deviner.

### Correctif 4 — Garder `success: true` en plus de `ok: true`
Pour rester rétrocompatible si une autre partie du code (admin) lit encore `data.success`.

---

### Tests post-correctif
1. Sélectionner une commande valide → l'étiquette doit s'afficher.
2. Sélectionner une commande sans `store_id` → toast "Commande introuvable" (clair).
3. Sur un compte vendeur d'une boutique sans labels activés → toast "Étiquettes non activées pour cette boutique".
4. Vérifier les logs côté serveur : on doit voir `userId`, `count orders`, etc.

### Risques
- Aucun. Le changement de status code n'a pas d'impact sécurité (l'auth reste vérifiée).
- Le client gère la nouvelle forme de réponse (`ok`) mais on garde `success` en parallèle pour ne rien casser.
- Aucune migration DB.

### Ordre d'exécution
1. Refactor `generate-shipping-labels/index.ts` (helper `respond` + logs)
2. Simplifier `ShippingLabelPreview.tsx` (lecture `data.ok`)
3. Redéployer l'edge function
4. Tester depuis l'UI vendeur → confirmer que l'erreur réelle s'affiche

Confirme et je passe en exécution.

