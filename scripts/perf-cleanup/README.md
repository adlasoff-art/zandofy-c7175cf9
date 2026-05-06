# Perf cleanup — migration des URLs legacy `wgidwyrdnboivfphwete` → prod

## Pourquoi

PageSpeed mobile (LCP 7.8 s) montre que ~1,1 MB d'images publiques de la home pointent
encore vers le projet **staging** Supabase (`wgidwyrdnboivfphwete.supabase.co`) au lieu
de la **prod** (`vpttoqojmiqxgudknyxf.supabase.co`). Conséquences :

- domaine non-préconnecté → +200-400 ms de DNS+TCP+TLS sur mobile
- pas de CDN Cloudflare (le proxy n'est branché que sur prod)
- 2 connexions HTTP au lieu d'une → contention bande passante
- cache TTL court (1 h) côté staging

## Étape 1 — Audit (read-only, à exécuter côté prod)

Connecte-toi au SQL editor de **Supabase prod** (`vpttoqojmiqxgudknyxf`) et exécute
`01-audit.sql`. Ça liste, par table, le nombre de lignes contenant l'URL legacy
et un échantillon. Aucun écrit.

## Étape 2 — Vérifier que les fichiers existent côté prod

Pour chaque chemin retourné par l'audit, vérifier dans le bucket prod (storage) qu'un
objet de même path existe. Deux cas :

- **Objet présent côté prod** → simple UPDATE de l'URL (étape 3a)
- **Objet absent** → script Node `02-copy-missing.mjs` qui télécharge depuis staging
  et upload sur prod, en conservant exactement le même path (étape 3b avant 3a)

## Étape 3a — Réécriture des URLs (DESTRUCTIF, à backup avant)

Exécute `03-rewrite-urls.sql` côté prod. Il fait des `UPDATE` ciblés en remplaçant
`wgidwyrdnboivfphwete.supabase.co` par `vpttoqojmiqxgudknyxf.supabase.co` dans
chaque colonne identifiée par l'audit.

**Backup recommandé avant** :
```sql
create table _backup_urls_20260506 as
select 'cms_banners' as t, id, image_url from cms_banners where image_url like '%wgidwyrdnboivfphwete%'
union all select 'categories', id, image_url from categories where image_url like '%wgidwyrdnboivfphwete%'
union all select 'product_images', id, image_url from product_images where image_url like '%wgidwyrdnboivfphwete%'
union all select 'products', id, main_image_url from products where main_image_url like '%wgidwyrdnboivfphwete%';
```

## Étape 4 — Validation

1. Re-run `01-audit.sql` → tous les `count` doivent être à 0.
2. Ouvrir https://zandofy.com sur mobile, DevTools → Network → vérifier qu'aucune
   requête `wgidwyrdnboivfphwete` n'apparaît.
3. Re-run PageSpeed mobile sur https://pagespeed.web.dev/.

## Rollback

Si un visuel manque, rejouer depuis `_backup_urls_20260506` :
```sql
update cms_banners c set image_url = b.image_url
from _backup_urls_20260506 b where b.t = 'cms_banners' and b.id = c.id;
-- idem pour les autres tables
```