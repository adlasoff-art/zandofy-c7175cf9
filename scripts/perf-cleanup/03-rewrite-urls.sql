-- ============================================================
-- RÉÉCRITURE — wgidwyrdnboivfphwete.supabase.co → vpttoqojmiqxgudknyxf.supabase.co
-- À exécuter sur le projet PROD (vpttoqojmiqxgudknyxf) APRÈS :
--   1. avoir lancé 01-audit.sql
--   2. avoir vérifié que les fichiers existent côté prod (ou copiés via 02-copy-missing.mjs)
--   3. avoir créé _backup_urls_20260506 (cf. README.md)
--
-- Périmètre confirmé par l'audit : 537 URLs à réécrire
--   cms_banners      :   6
--   categories       :  10
--   product_images   : 521
--   cms_menu_items   :   0  (inclus par sécurité, no-op)
--   cms_popups       :   0  (inclus par sécurité, no-op)
-- ============================================================

begin;

update cms_banners
   set image_url = replace(image_url,
                           'wgidwyrdnboivfphwete.supabase.co',
                           'vpttoqojmiqxgudknyxf.supabase.co')
 where image_url like '%wgidwyrdnboivfphwete%';

update categories
   set image_url = replace(image_url,
                           'wgidwyrdnboivfphwete.supabase.co',
                           'vpttoqojmiqxgudknyxf.supabase.co')
 where image_url like '%wgidwyrdnboivfphwete%';

update product_images
   set image_url = replace(image_url,
                           'wgidwyrdnboivfphwete.supabase.co',
                           'vpttoqojmiqxgudknyxf.supabase.co')
 where image_url like '%wgidwyrdnboivfphwete%';

update cms_menu_items
   set url = replace(url,
                     'wgidwyrdnboivfphwete.supabase.co',
                     'vpttoqojmiqxgudknyxf.supabase.co')
 where url like '%wgidwyrdnboivfphwete%';

update cms_popups
   set image_url = replace(image_url,
                           'wgidwyrdnboivfphwete.supabase.co',
                           'vpttoqojmiqxgudknyxf.supabase.co')
 where image_url like '%wgidwyrdnboivfphwete%';

-- VALIDATION : tous les counts doivent retourner 0
select 'cms_banners'      as t, count(*) from cms_banners       where image_url like '%wgidwyrdnboivfphwete%'
union all select 'categories',     count(*) from categories     where image_url like '%wgidwyrdnboivfphwete%'
union all select 'product_images', count(*) from product_images where image_url like '%wgidwyrdnboivfphwete%'
union all select 'cms_menu_items', count(*) from cms_menu_items where coalesce(url,'') like '%wgidwyrdnboivfphwete%'
union all select 'cms_popups',     count(*) from cms_popups     where coalesce(image_url,'') like '%wgidwyrdnboivfphwete%';

-- Si tout est à 0 → COMMIT, sinon ROLLBACK et investiguer
commit;
