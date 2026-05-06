-- ============================================================
-- RÉÉCRITURE — wgidwyrdnboivfphwete.supabase.co → vpttoqojmiqxgudknyxf.supabase.co
-- À exécuter sur le projet PROD (vpttoqojmiqxgudknyxf) APRÈS :
--   1. avoir lancé 01-audit.sql
--   2. avoir vérifié que les fichiers existent côté prod (ou copiés via 02-copy-missing.mjs)
--   3. avoir créé _backup_urls_20260506 (cf. README.md)
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

update products
   set main_image_url = replace(main_image_url,
                                'wgidwyrdnboivfphwete.supabase.co',
                                'vpttoqojmiqxgudknyxf.supabase.co')
 where main_image_url like '%wgidwyrdnboivfphwete%';

update product_images
   set image_url = replace(image_url,
                           'wgidwyrdnboivfphwete.supabase.co',
                           'vpttoqojmiqxgudknyxf.supabase.co')
 where image_url like '%wgidwyrdnboivfphwete%';

update cms_menu_items
   set image_url = replace(image_url,
                           'wgidwyrdnboivfphwete.supabase.co',
                           'vpttoqojmiqxgudknyxf.supabase.co')
 where image_url like '%wgidwyrdnboivfphwete%';

update cms_popups
   set image_url = replace(image_url,
                           'wgidwyrdnboivfphwete.supabase.co',
                           'vpttoqojmiqxgudknyxf.supabase.co')
 where image_url like '%wgidwyrdnboivfphwete%';

-- platform_settings stocke du JSON → on remplace en cast text puis re-cast jsonb
update platform_settings
   set value = replace(value::text,
                       'wgidwyrdnboivfphwete.supabase.co',
                       'vpttoqojmiqxgudknyxf.supabase.co')::jsonb
 where value::text like '%wgidwyrdnboivfphwete%';

-- VALIDATION : le SELECT suivant doit retourner 0 partout
select 'cms_banners'      as t, count(*) from cms_banners       where image_url like '%wgidwyrdnboivfphwete%'
union all select 'categories',     count(*) from categories     where image_url like '%wgidwyrdnboivfphwete%'
union all select 'products',       count(*) from products       where main_image_url like '%wgidwyrdnboivfphwete%'
union all select 'product_images', count(*) from product_images where image_url like '%wgidwyrdnboivfphwete%'
union all select 'cms_menu_items', count(*) from cms_menu_items where coalesce(image_url,'') like '%wgidwyrdnboivfphwete%'
union all select 'cms_popups',     count(*) from cms_popups     where coalesce(image_url,'') like '%wgidwyrdnboivfphwete%'
union all select 'platform_settings', count(*) from platform_settings where value::text like '%wgidwyrdnboivfphwete%';

-- Si tout est à 0 → COMMIT, sinon ROLLBACK et investiguer
commit;