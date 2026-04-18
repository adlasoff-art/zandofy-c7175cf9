

## Diagnostic — "Aucune commande trouvée" en prod après redéploiement

### Constat
Tu as testé sur `zandofy.com` après le push du `[v2]` → toujours "Aucune commande trouvée". Cela signifie que la nouvelle edge function tourne maintenant en prod (sinon le message aurait changé de forme), mais elle retourne `errorCode: NO_ORDERS` après le `SELECT ... IN (orderIds)`.

### Hypothèses (par ordre de probabilité)

1. **Mismatch project/UUID** : les `orderIds` envoyés depuis le frontend prod n'existent pas dans la DB prod `vpt...yxf`. Peu probable si tu cliques depuis la liste UI prod, mais à confirmer.
2. **RLS bloquant le service role** : improbable (le service role bypasse RLS), mais si la table `orders` a des policies restrictives + un trigger qui lit `auth.uid()`, ça peut filtrer.
3. **store_id NULL sur les vraies commandes prod** : le `SELECT` n'utilise pas `store_id` dans le filtre, donc ça ne devrait pas causer 0 résultat. Écartable.
4. **Schéma différent en prod** : une colonne du `SELECT` (ex: `shipping_email`, `shipping_mode`) n'existe pas en prod → erreur `ordersError` mais on retournerait `DB_ERROR`, pas `NO_ORDERS`. Donc à éliminer via les logs.
5. **Le frontend appelle une URL hardcodée vers Lovable Cloud** au lieu de `VITE_SUPABASE_URL` → l'edge function exécutée serait toujours celle de `uog...zpu` qui n'a pas tes vraies commandes prod.

### Ce que je dois vérifier (mode lecture)

Avant de proposer un correctif, j'ai besoin de relire :
- `frontend/src/components/shipping/ShippingLabelPreview.tsx` → comment l'URL de l'edge function est construite (hardcodée ? via env ? via `supabase.functions.invoke` ?)
- Le composant parent qui passe les `orderIds` → s'assurer qu'il passe les vrais UUID prod, pas un mapping cassé
- Confirmer que les logs `[v2]` côté client (`console.log("[ShippingLabelPreview] sending orderIds=", ...)`) ont bien été ajoutés et sont visibles dans la console navigateur

### Plan d'action concret

**Étape 1 — Audit lecture seule (immédiat, en mode plan)**
Relire `ShippingLabelPreview.tsx` + le composant parent (probablement `OrdersTab.tsx` ou équivalent vendeur) pour identifier :
- Construction de l'URL edge function (hardcoded vs env)
- Source des `orderIds` (depuis `selectedRows` / `selectedOrders` ?)

**Étape 2 — Demande à l'utilisatrice (avant de coder)**
Tu m'envoies :
- L'**UUID exact** (ou order_ref) de la commande sur laquelle tu cliques
- La **console navigateur ouverte** (F12 → Console) au moment du clic, avec la ligne `[ShippingLabelPreview] sending orderIds=...` et l'`url=...`
- Les **logs serveur** depuis Supabase prod (`vpt...yxf`) → Edge Functions → `generate-shipping-labels` → Logs : copier-coller toutes les lignes `[v2]` ou `[shipping-labels]` du dernier appel

Avec ces 3 infos, je tranche en 1 itération entre :
- **Cas A** : l'URL pointe vers Lovable Cloud → corriger côté frontend pour utiliser `import.meta.env.VITE_SUPABASE_URL`
- **Cas B** : l'URL pointe bien vers prod, mais l'UUID envoyé n'existe pas en DB prod → bug de mapping côté UI vendeur
- **Cas C** : tout est correct côté URL/UUID, mais le `SELECT` retourne 0 → problème de schéma (colonne manquante en prod) → adapter le SELECT

**Étape 3 — Correctif ciblé (en mode default, après diagnostic)**
Selon le cas A/B/C identifié, une seule modification précise. Aucune migration, aucun risque pour la prod.

### Pourquoi je ne fonce pas tête baissée
J'ai déjà fait 3 itérations qui n'ont pas résolu le problème. La règle "stuck pivot" s'applique : il faut **voir les logs réels prod + console nav** avant de toucher au code. Sinon je vais re-tâtonner et user ta confiance.

### Décision attendue
Confirme et je :
1. Lis `ShippingLabelPreview.tsx` + composant parent pour cartographier la chaîne d'appel exacte
2. Te liste précisément les 3 infos à m'envoyer (UUID, console nav, logs Supabase prod)
3. Une fois reçues, je passe en mode default avec le bon correctif

