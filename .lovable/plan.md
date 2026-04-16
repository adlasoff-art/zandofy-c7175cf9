
L'utilisateur clarifie :
- `wgidwyrdnboivfphwete` (WETE) = staging/test, plus utilisé pour stocker de nouvelles images.
- `vpttoqojmiqxgudknyxf` (YXF) = production, contient désormais toutes les images.
- Les anciennes images encore servies depuis WETE peuvent rester (pas de migration nécessaire).
- Pas besoin de préconnecter WETE en prod.

Le diagnostic PageSpeed montrait des images servies depuis WETE. Si c'est juste des résidus historiques (anciens produits), pas besoin d'optimiser ce host. Mais si la home charge encore activement des images depuis WETE, il faut comprendre pourquoi (références hardcodées, données seedées en prod pointant vers WETE, branding/bannière configurée avant la migration).

Je dois donc :
1. Vérifier que la prod ne fait que de la production sur YXF (pas de fuite vers WETE pour les nouveaux assets).
2. Identifier d'où viennent les images WETE encore visibles sur la home (probablement banner/branding seedés avant migration).
3. Ne PAS préconnecter WETE (gaspillage).
4. Vérifier le déploiement v2 sur Vercel (les changements PageSpeed v2 ne semblent pas live).

# Plan v3 — Clarification environnements + vérif déploiement

## Compréhension confirmée

| Host | Rôle | Action |
|---|---|---|
| `vpttoqojmiqxgudknyxf` (YXF) | **Production** — toutes les nouvelles images, DB live | ✅ Préconnecter (déjà fait) |
| `wgidwyrdnboivfphwete` (WETE) | **Staging/test** — résidus d'anciennes images | ❌ Ne PAS préconnecter en prod |
| `uogkklwfvwoxkifpkzpu` (UOG) | **Lovable preview** uniquement | ❌ Retirer (déjà fait en v2) |

## Questions à investiguer (lecture seule, pas de modif)

1. **D'où viennent les images WETE encore servies sur zandofy.com ?**
   - Lire le contenu actuel de la table `branding` (logo, favicon) côté YXF
   - Lire le contenu actuel de la bannière hero (`hero_banners` ou équivalent) côté YXF
   - Lire les `category_banners` côté YXF
   - Si des URLs WETE traînent → ce sont des références orphelines à nettoyer (hors scope perf, mais à signaler)

2. **Pourquoi le bundle déployé (`index-C7b9Bwhv.js`) ne reflète pas v2 ?**
   - Vérifier le dernier commit Vercel
   - Vérifier le hash du bundle local après build
   - Si différent → la v2 n'est jamais arrivée en prod (pipeline Vercel bloqué, branche non mergée, ou cache CDN)

## Ce que je propose pour la suite

### Étape A — Diagnostic (ce plan)
Lire ces fichiers pour comprendre l'état réel :
- `frontend/src/components/HeroBanner.tsx` (vérifier que les changements v2 y sont)
- `frontend/src/hooks/use-geo-detection.ts` (vérifier sessionStorage gate)
- `vite.config.ts` racine (vérifier `lucide-vendor` chunk)
- `frontend/src/pages/CheckoutPage.tsx` (vérifier flag `zandofy_geo_needed`)
- Requête SQL prod : `SELECT * FROM branding LIMIT 5`, idem `hero_banners`, `category_banners` → identifier URLs WETE résiduelles

### Étape B — Action proposée selon diagnostic

**Cas 1** : Le code v2 EST bien dans le repo mais PAS déployé sur Vercel
→ Action : signaler à l'utilisateur que le déploiement Vercel doit être déclenché (push sur `main` ou redéploiement manuel). Pas de code à changer.

**Cas 2** : Le code v2 est déployé mais des images WETE persistent (refs orphelines en DB)
→ Action : proposer de migrer ces URLs vers YXF (re-uploader les anciens assets clés sur YXF storage et mettre à jour les refs DB). Ou laisser tel quel (l'utilisateur a dit que c'est ok).

**Cas 3** : Les deux problèmes coexistent
→ Action prioritaire : déploiement v2, puis nettoyage des refs WETE résiduelles.

## Ce qui ne change pas
- Aucune préconnexion vers WETE (confirmé non utile).
- Aucune migration forcée des images WETE (l'utilisateur les laisse vivre).
- Pas de modification visuelle.

## Étape suivante
Si tu approuves, je passe en mode exécution pour :
1. Lire les 4 fichiers code v2 → confirmer que les changements y sont.
2. Requêter la DB YXF (`branding`, `hero_banners`, `category_banners`) → identifier les URLs WETE résiduelles.
3. Te livrer un diagnostic clair : "v2 déployée ou non" + "résidus WETE à migrer ou non".
4. Selon ton choix, exécuter le nettoyage ou attendre le déploiement Vercel.

