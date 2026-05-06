-- ============================================================
-- ROLLBACK URGENT — restaure les URLs staging d'origine depuis _backup_urls_20260506
-- À exécuter sur le projet PROD (vpttoqojmiqxgudknyxf) après l'incident du 2026-05-07.
--
-- Pourquoi : la réécriture du 06/05 a basculé 537 URLs vers prod, mais les fichiers
-- ne sont pas réellement présents dans le bucket prod (le check d'existence du
-- script v1 était défaillant). Résultat : images cassées en home (Super Promos,
-- bannière, "Pour vous", anciens produits).
--
-- En restaurant les URLs staging, le navigateur recharge depuis le bucket staging
-- (qui contient les fichiers) → service rétabli immédiatement, sans toucher aux
-- fichiers ni aux objets storage.
-- ============================================================

begin;

update cms_banners c
   set image_url = b.url
  from _backup_urls_20260506 b
 where b.t = 'cms_banners' and b.id::text = c.id::text;

update categories c
   set image_url = b.url
  from _backup_urls_20260506 b
 where b.t = 'categories' and b.id::text = c.id::text;

update product_images c
   set image_url = b.url
  from _backup_urls_20260506 b
 where b.t = 'product_images' and b.id::text = c.id::text;

-- Validation : on doit retrouver les ~537 URLs legacy
select 'cms_banners'    as t, count(*) from cms_banners    where image_url like '%wgidwyrdnboivfphwete%'
union all select 'categories',     count(*) from categories     where image_url like '%wgidwyrdnboivfphwete%'
union all select 'product_images', count(*) from product_images where image_url like '%wgidwyrdnboivfphwete%';

commit;