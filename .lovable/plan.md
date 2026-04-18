

## Je comprends ta frustration — recadrons le diagnostic

Tu as raison : ça marchait, ça ne marche plus, et mes itérations n'ont pas résolu. Je dois arrêter de tâtonner et **regarder les vraies données** au lieu de supposer.

### Ce que je sais déjà (logs prod confirmés)
- ✅ CORS preflight passe maintenant (plus d'erreur "blocked by CORS policy" sur `generate-shipping-labels`)
- ✅ L'edge function répond : `[ShippingLabels] response: Object` apparaît dans la console
- ❌ Mais le résultat affiche toujours "Aucune commande trouvée"

**Donc le problème n'est plus CORS.** L'edge function répond, mais avec un `errorCode` qui déclenche le toast. Il faut voir **le contenu exact de cette réponse**.

### Hypothèse forte — pourquoi ça marchait avant et plus maintenant

Quand tu dis "ça marchait", c'était probablement avec un **ancien schéma de la table `orders` en prod**. Mes derniers ajouts au `SELECT` incluent des colonnes qui pourraient ne pas exister en prod :
- `shipping_email`
- `shipping_mode`

Si une de ces colonnes n'existe pas dans la DB prod (`vpt...yxf`), le `SELECT` retourne une erreur Postgres → la fonction renvoie `errorCode: DB_ERROR` → le frontend affiche un message générique.

C'est exactement le scénario "ça marchait avant l'ajout de ces colonnes, ça casse maintenant".

### Plan d'action — diagnostic en 1 coup, sans tâtonner

**Étape 1 — Mode lecture (immédiat)**
Je regarde 3 choses dans le code :
1. `frontend/src/components/shipping/ShippingLabelPreview.tsx` → comment le frontend traite la réponse (extraire le vrai message d'erreur du `data` pour l'afficher tel quel au lieu du fallback générique)
2. `frontend/supabase/functions/generate-shipping-labels/index.ts` → confirmer que je log bien `ordersError.message` quand le SELECT échoue
3. `frontend/supabase/migrations/` → chercher si `shipping_email` et `shipping_mode` ont une migration → si non, ces colonnes n'existent pas en prod

**Étape 2 — Correctif sans risque (mode default)**
Deux changements minimaux :

**A.** Côté **frontend** : afficher le vrai `error` de la réponse au lieu du toast générique
```ts
if (!data.success) {
  toast.error(`${data.errorCode || 'ERREUR'}: ${data.error || 'Aucune commande trouvée'}`);
  return;
}
```
→ Comme ça, au prochain test, tu verras directement `DB_ERROR: column "shipping_email" does not exist` (ou autre) au lieu de "Aucune commande trouvée".

**B.** Côté **edge function** : retirer temporairement `shipping_email` et `shipping_mode` du `SELECT` et utiliser `COALESCE` pour les valeurs par défaut. Ça garantit que la fonction marche même si ces colonnes manquent en prod.

**Étape 3 — Validation (1 clic de ta part)**
Tu retestes "Imprimer étiquette". Cette fois :
- ✅ Si le PDF se génère → problème réglé, on documente
- ❌ Si tu vois un message d'erreur précis → tu me l'envoies (1 ligne) et je tranche en 1 fix final

**Étape 4 (séparée) — Migration des colonnes manquantes**
Si `shipping_email` et `shipping_mode` doivent exister en prod (pour d'autres features), je créerai une migration `ALTER TABLE orders ADD COLUMN IF NOT EXISTS ...` à pousser via GitHub Actions.

### Ce que je ne ferai PAS
- Re-toucher au CORS (déjà OK)
- Re-toucher à `config.toml` (déjà OK)
- Modifier `client.ts`, `.env`, `types.ts`
- Faire des migrations sans ton accord explicite

### Pourquoi cette fois je suis plus confiant
- Les logs montrent que la requête **arrive** à l'edge function (CORS OK)
- L'edge function **répond** (response: Object)
- Donc l'erreur est forcément **dans le payload de réponse** → on doit juste l'afficher au lieu de le masquer

### Décision attendue
Confirme et je passe en exécution :
1. Lecture des 3 fichiers (frontend handler + edge function + migrations)
2. Patch frontend pour afficher le vrai message d'erreur
3. Patch edge function pour retirer les colonnes potentiellement manquantes
4. Tu retestes → on a soit le succès, soit un message d'erreur précis qui finit le diagnostic

