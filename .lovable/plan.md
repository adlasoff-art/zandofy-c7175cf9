

## Diagnostic — "Aucune commande trouvée" persiste

### État actuel
- Mémoire mise à jour : prod = `vpttoqojmiqxgudknyxf` (Supabase.com perso), front = `zandofy.com`.
- Edge function `generate-shipping-labels` côté Lovable Cloud (`uog...zpu`) = à jour avec le pattern always-200 + `getUser`.
- Mais le frontend prod sur `zandofy.com` appelle l'edge function du projet Supabase **prod** (`vpt...yxf`), où la fonction n'a **pas encore été redéployée** avec les correctifs récents.

### Cause racine
Les corrections faites dans Lovable touchent le repo GitHub (`frontend/supabase/functions/generate-shipping-labels/index.ts`). Pour qu'elles atteignent la prod, il faut que le workflow GitHub Actions `deploy-edge-functions.yml` se déclenche et déploie sur `vpt...yxf`. Tant que ce workflow n'a pas tourné avec succès, la prod exécute l'**ancienne** version de la fonction (celle qui ne loggue rien et masque les erreurs).

Donc le message "Aucune commande trouvée" provient soit :
1. De l'ancienne edge function en prod qui retourne 404 sur un cas qu'elle ne devrait pas (et le nouveau code aurait expliqué pourquoi)
2. Du nouveau code une fois déployé, mais avec une vraie raison métier (RLS, store_id manquant, rôle non reconnu en prod)

Sans logs côté Supabase prod, impossible de trancher à l'aveugle.

### Plan d'action

**1. Forcer le redéploiement de l'edge function vers la prod**
Faire un changement minimal et traçable dans `frontend/supabase/functions/generate-shipping-labels/index.ts` (ajout d'une ligne `console.log` de version `v2`) pour garantir que GitHub Actions détecte le diff et redéploie sur `vpt...yxf`.

**2. Renforcer les logs de diagnostic dans la fonction**
Ajouter en début de handler (après auth) des `console.log` explicites :
- `[v2] userId=`, `roles=`, `orderIds reçus=`
- `[v2] orders.length après select=`, et si 0 → logger les UUID manquants
- `[v2] store_ids=`, `isOwner/isCollab par store`
Comme ça, dès que la fonction tourne en prod, on voit immédiatement dans Supabase Dashboard prod (Functions → Logs) ce qui cloche.

**3. Vérifier l'invocation côté client**
Relire `frontend/src/components/shipping/ShippingLabelPreview.tsx` pour confirmer que :
- L'URL utilisée pour le `fetch` direct est bien construite à partir de `import.meta.env.VITE_SUPABASE_URL` (donc `vpt...yxf` en prod)
- Le `Authorization: Bearer <token>` envoyé est bien le JWT prod (pas un cache d'un autre projet)
- Les `orderIds` envoyés sont les bons UUID (logger côté client juste avant l'envoi)

**4. Une fois déployé, l'utilisatrice clique "Imprimer étiquette"**
Puis elle me transmet :
- L'order_ref ou l'UUID de la commande sélectionnée
- Le toast exact qui s'affiche
- (idéalement) un screenshot de la console navigateur

Avec ça + les logs serveur prod, je tranche en 1 itération.

### Ce que je vais modifier (mode default, après ton OK)

| Fichier | Changement |
|---|---|
| `frontend/supabase/functions/generate-shipping-labels/index.ts` | Ajouter logs `[v2]` ciblés + bump de version dans un commentaire en tête pour forcer le diff |
| `frontend/src/components/shipping/ShippingLabelPreview.tsx` | Ajouter `console.log("[ShippingLabelPreview] sending orderIds=", orderIds)` juste avant le `fetch` |

Aucun changement de logique métier, aucune migration DB, aucun risque pour les 4000 visiteurs/jour.

### Ce que tu fais après le push
- Vérifier dans GitHub → Actions que `deploy-edge-functions.yml` tourne et passe ✅
- Tester depuis `zandofy.com` → "Imprimer étiquette" sur une vraie commande
- Si "Aucune commande trouvée" persiste : ouvrir Supabase prod (`vpt...yxf`) → Edge Functions → `generate-shipping-labels` → Logs, copier-coller les lignes `[v2]` ici
- Je diagnostique précisément (RLS ? store_id null ? UUID inexistant ? rôle vendor non détecté en prod ?) et je corrige

### Pourquoi je ne peux pas faire mieux maintenant
Lovable n'a pas accès au projet Supabase prod (`vpt...yxf`) — je ne peux ni lire ses logs, ni déployer dessus directement. Le seul chemin légitime est : code → GitHub → Actions → Supabase prod. Toute autre approche violerait le SOP de déploiement.

### Décision
Confirme et je passe en exécution pour ajouter les logs `[v2]` + bump de version, ce qui déclenchera automatiquement le redéploiement vers ta prod.

