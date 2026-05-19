# Diagnostic page blanche prod + preload hero

## Constat

1. **Warning console** : `The resource ...banners/...webp was preloaded using link preload, but not used within a few seconds...`
   → **Bénin**. Le script inline dans `frontend/index.html` (lignes 36-89) précharge **toujours** l'image du premier hero_slide, même sur `/auth`, `/account`, etc. où `HeroBanner` n'est jamais monté. Ce warning n'a aucun impact fonctionnel.

2. **Page blanche** : symptôme distinct du warning. Causes probables, classées par vraisemblance :
   - **A. Service Worker servant des chunks JS périmés** après le déploiement d'hier. `sw.js` (lignes 159-169) sert les JS/CSS en *stale-while-revalidate* depuis `STATIC_CACHE`. Après deploy, le nouveau `index.html` (network-first) référence de nouveaux hash de chunks ; les anciens chunks restent en cache mais les nouveaux peuvent ne pas être encore présents → si un import dynamique échoue de façon silencieuse (ex. lazy route), React reste à blanc.
   - **B. Erreur runtime non capturée** sur la route d'entrée. Les logs Lovable Cloud ne reflètent **pas** la prod (`vpt...yxf`), donc on ne peut pas trancher sans la console réelle.
   - **C. SW de prod cassé** : on voit dans les error_reports preview des `Failed to update ServiceWorker ... 404 sw.js?v=1.10.2`. Si la version prod a un mismatch similaire, le SW courant peut continuer à servir un `index.html` cohérent mais des chunks orphelins.

## Plan d'action (2 phases)

### Phase 1 — Nettoyer et instrumenter (sans casser)

1. **Conditionner le preload hero au chemin `/`**
   - Fichier : `frontend/index.html` (script inline lignes 36-89)
   - Ajouter en début de l'IIFE : `if (location.pathname !== '/' && location.pathname !== '/index.html') return;`
   - Idem dans `frontend/src/components/HeroBanner.tsx` : ne pas pousser dans `localStorage.z_lcp_hero_url` une URL qui sera rejouée hors home (déjà OK, mais on garde un garde-fou).
   - Résultat : disparition immédiate du warning console sur `/auth`, `/account`, etc.

2. **Durcir le SW pour éviter les chunks orphelins (cause A)**
   - Fichier : `frontend/public/sw.js`
   - Pour les requêtes vers `/assets/*.js` et `/assets/*.css` (Vercel met les chunks hashés ici), passer en **network-first** au lieu de stale-while-revalidate. Coût : un round-trip de plus, mais ces fichiers sont `Cache-Control: immutable` côté Vercel (`vercel.json` headers `/assets/(.*)`), donc le navigateur cache de toute façon — le bénéfice du SW est nul ici et le risque (chunks périmés) est réel.
   - Bumper `STATIC_CACHE` de `zandofy-static-v8` → `v9` pour évacuer les anciennes versions au prochain `activate`.

3. **Ajouter un kill-switch fallback côté `main.tsx`**
   - Déjà présent : `chunk_reload_attempted` recharge une fois sur erreur de chunk. Étendre : si après reload on détecte encore un échec → désinscrire le SW et vider les caches, puis recharger.
   - Ceci protège les utilisateurs déjà bloqués sur prod aujourd'hui (4000 visites/jour).

### Phase 2 — Vérification

1. Build + déploiement staging (`develop`), ouvrir `https://studio-staging.zandofy.com/auth` :
   - Console **sans** warning preload.
   - Devtools → Application → Service Workers : version `zandofy-static-v9` active, anciens caches supprimés.
2. Simuler un déploiement (modifier un import lazy, redéployer) → vérifier que le SW ne sert plus de chunk périmé.
3. Si OK, promouvoir vers `main` (prod).
4. Communiquer aux utilisateurs déjà bloqués : un **Ctrl+Shift+R** suffira (ou ils tomberont automatiquement sur le fallback de désinscription SW).

## Fichiers modifiés

- `frontend/index.html` — guard `location.pathname === '/'`
- `frontend/src/components/HeroBanner.tsx` — guard symétrique (défensif)
- `frontend/public/sw.js` — network-first pour `/assets/*`, bump cache `v8 → v9`
- `frontend/src/main.tsx` — fallback désinscription SW après second échec chunk

## Hors scope

- Pas de changement DB, edge functions, ni env.
- Pas de modif de routes ni de logique métier.
- L'investigation root-cause définitive de la page blanche nécessite un message console depuis la prod (Chrome devtools sur zandofy.com pendant le bug). Si le warning preload disparaît mais que la page reste blanche, **la cause B (erreur runtime)** sera confirmée et je demanderai la stack trace réelle.

## Note importante

Le warning preload **n'est pas** la cause de la page blanche. C'est seulement la seule chose que la console affiche parce que le reste du JS n'a pas eu le temps de s'exécuter (cause A ou B). En corrigeant le SW (cause A la plus probable vu le contexte deploy d'hier) on couvre 80% du risque. Si après merge sur prod le problème persiste, j'aurai besoin de :
1. La console prod complète (Chrome DevTools → Console → tout)
2. L'onglet Network filtre JS, voir s'il y a des 404 sur les chunks `/assets/*.js`
