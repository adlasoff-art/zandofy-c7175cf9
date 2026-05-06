# Plan de remédiation — images cassées en prod + maintenance + perf

## Diagnostic

Le script `02-copy-missing.mjs` a renvoyé **0 copied, 537 skipped, 0 failed**, puis on a réécrit les 537 URLs `wgidwyrdnboivfphwete` → `vpttoqojmiqxgudknyxf`. Or aujourd'hui les images de Super Promos, bannière, "Pour vous" et anciens produits sont cassées. **Conclusion** : les 537 fichiers n'étaient PAS réellement présents dans le bucket prod. Le check d'existence du script (`storage.list(parent, { search: filename })` + `some(f => f.name === filename)`) a faussement retourné "exists" — probablement parce que :

- `list()` renvoie max 100 entrées et certains dossiers en ont plus,
- ou `search` fait une correspondance fuzzy/préfixe ambiguë,
- ou pour des paths à un seul segment, `parent = ""` matche un autre fichier homonyme dans un autre dossier du bucket.

Avant la réécriture, les `<img>` chargeaient depuis staging (qui contient les fichiers) → ça fonctionnait. Après la réécriture, ils pointent sur prod où les fichiers manquent → 400/404.

Heureusement la table `_backup_urls_20260506` contient les URLs originales staging → **rollback possible immédiatement**.

## Objectifs (ordre)

1. **Restaurer le service maintenant** (rollback URLs → images repassent en staging, le temps de tout copier proprement).
2. **Recopier réellement** les 537 objets staging → prod avec un check fiable.
3. **Vérifier** chaque URL prod (HTTP 200) avant réécriture.
4. **Re-réécrire** les URLs en prod.
5. **Fiabiliser le mode maintenance** (échec en navigation privée).
6. **Reprendre le plan PageSpeed**.

## Étape 1 — Rollback immédiat des URLs (5 min, dans le SQL Editor prod)

```sql
begin;

update cms_banners c
   set image_url = b.image_url
  from _backup_urls_20260506 b
 where b.t = 'cms_banners' and b.id::text = c.id::text;

update categories c
   set image_url = b.image_url
  from _backup_urls_20260506 b
 where b.t = 'categories' and b.id::text = c.id::text;

update product_images c
   set image_url = b.image_url
  from _backup_urls_20260506 b
 where b.t = 'product_images' and b.id::text = c.id::text;

-- vérification : on doit retrouver ~537
select t, count(*) from _backup_urls_20260506 group by t;
select 'now_legacy', count(*) from product_images where image_url like '%wgidwyrdnboivfphwete%';

commit;
```

→ Les images se rechargent depuis staging et le site redevient affichable. On peut alors lever la maintenance dès demain matin sans urgence.

## Étape 2 — Réécrire un script de copie fiable

Nouveau `scripts/perf-cleanup/02b-copy-missing-v2.mjs` qui :

- pour chaque URL legacy, **fait un `HEAD` HTTP direct** sur l'URL prod équivalente. `200` → présent, on skip. `400/404` → manquant, on copie.
- télécharge depuis staging via `storage.from(bucket).download(path)`.
- upload vers prod avec `upsert: true` (RLS UPDATE déjà en place — voir mémoire `supabase-storage-upsert-policy-constraint-logic`).
- log chaque ligne (présent / copié / échec) pour qu'on voie le défilement (l'absence de log aujourd'hui venait du `process.stdout` non flushé + skip silencieux).
- écrit un rapport `report.json` avec status par URL.

## Étape 3 — Liste exhaustive des URLs à traiter

Regénérer `urls.txt` depuis prod (sur les URLs encore en staging après rollback) :

```sql
select image_url from cms_banners      where image_url like '%wgidwyrdnboivfphwete%'
union all select image_url from categories      where image_url like '%wgidwyrdnboivfphwete%'
union all select image_url from product_images  where image_url like '%wgidwyrdnboivfphwete%';
```

Export CSV → `urls.txt`.

## Étape 4 — Lancer la copie + vérifier

```powershell
node scripts/perf-cleanup/02b-copy-missing-v2.mjs urls.txt
```

À la fin, le rapport doit afficher `failed: 0`. Sinon on traite les exceptions une par une (fichiers vraiment perdus côté staging — on demandera ré-upload manuel par les vendeurs concernés).

## Étape 5 — Re-réécriture des URLs (seulement si rapport clean)

Re-jouer `03-rewrite-urls.sql`. Le backup `_backup_urls_20260506` reste en place pour rollback éventuel.

## Étape 6 — Fiabiliser le mode maintenance

Constat user : en navigation privée, la page maintenance ne s'affiche pas.

Cause probable dans `MaintenanceGuard.tsx` :
- En navigation privée, **pas de cache localStorage** → `checked = true` au premier render mais `config = null`.
- L'effet `supabase.from("platform_settings").select(...)` dépend du chargement réseau ; si la requête est lente ou si une RLS bloque la lecture en utilisateur non-authentifié, `config` reste `null` et l'app s'affiche normalement.

À corriger :
1. **Vérifier la RLS** de `platform_settings` : la clé `maintenance_mode` doit être lisible **anon**.
2. Bloquer l'affichage de l'app tant que la première lecture n'a pas répondu (un mini-skeleton 300 ms max), pour éviter le flash en privé.
3. Côté Edge / `index.html`, injecter le flag maintenance via le bootstrap déjà présent (`use-platform-bootstrap`) pour qu'il soit dispo SANS attendre Supabase au runtime.
4. Passer `MaintenanceGuard` en haut de l'arbre (déjà OK) et ne plus se reposer uniquement sur localStorage pour décider.

## Étape 7 — Reprendre le plan PageSpeed (post-incident)

Une fois les images restaurées proprement sur prod :

| # | Action | Gain attendu |
|---|---|---|
| 1 | Confirmer 0 URL `wgidwyrdnboivfphwete` restante (audit) | base saine |
| 2 | Re-tester PageSpeed mobile sur `https://zandofy.com` | mesure de référence post-fix |
| 3 | Activer transformation d'images Supabase (`?width=400&quality=75&format=webp`) sur `ProductCard`, `TopTrends`, bannière | -40 à -60% poids LCP |
| 4 | Pré-générer responsive `srcset` (320/480/800w) | meilleur DPR mobile |
| 5 | Lazy-loader strict tout sauf les 4 premiers produits visibles | -30% requêtes initiales |
| 6 | Vérifier `<link rel="preconnect">` ne contient plus que prod Supabase + CDN domain | preconnect propre |
| 7 | Activer Cloudflare Polish + Mirage si pas déjà fait | +200 ms LCP |
| 8 | Auditer les chunks JS (`vite build --mode analyze`) et différer les routes admin | -30% TTI |

Ce volet sera détaillé dans un plan dédié après confirmation que les images sont OK.

## Détails techniques (référence)

- Bug racine `02-copy-missing.mjs` : la combinaison `storage.list(parent, { search })` + `some(name === ...)` n'est pas un check d'existence fiable (limite 100 résultats, search fuzzy). Le remplacer par `fetch(prodPublicUrl, { method: 'HEAD' })` est trivial et déterministe.
- Backup `_backup_urls_20260506` : à conserver jusqu'à validation post-incident (1 semaine), puis archiver.
- Mémoire à mettre à jour après l'incident : ajouter dans `mem/architecture/environment-database-separation.md` la procédure de copie storage cross-projet validée + le bug du check `list+search`.

## Hors périmètre de ce plan

- Aucune modification frontend produit (composants, pages) tant que les images ne sont pas restaurées.
- Aucune modification de la stack Docker / Vercel / Supabase config.
- Pas de migration de schéma DB.
