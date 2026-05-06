-- ============================================================
-- AUDIT — URLs pointant encore vers le projet staging Supabase
-- À exécuter sur le projet PROD (vpttoqojmiqxgudknyxf), read-only.
-- ============================================================

-- 1) Compteurs par table
select 'cms_banners       ' as table_name,
       count(*) filter (where image_url like '%wgidwyrdnboivfphwete%') as legacy_count,
       count(*)                                                        as total
from cms_banners
union all
select 'categories        ',
       count(*) filter (where image_url like '%wgidwyrdnboivfphwete%'),
       count(*)
from categories
union all
select 'product_images    ',
       count(*) filter (where image_url like '%wgidwyrdnboivfphwete%'),
       count(*)
from product_images
union all
select 'products          ',
       count(*) filter (where main_image_url like '%wgidwyrdnboivfphwete%'),
       count(*)
from products
union all
select 'platform_settings ',
       count(*) filter (where value::text like '%wgidwyrdnboivfphwete%'),
       count(*)
from platform_settings
union all
select 'cms_menu_items    ',
       count(*) filter (where coalesce(image_url,'') like '%wgidwyrdnboivfphwete%'),
       count(*)
from cms_menu_items
union all
select 'cms_popups        ',
       count(*) filter (where coalesce(image_url,'') like '%wgidwyrdnboivfphwete%'),
       count(*)
from cms_popups;

-- 2) Échantillon (10 lignes par table) pour préparer la copie de fichiers manquants
select 'cms_banners' as src, id::text, image_url from cms_banners
  where image_url like '%wgidwyrdnboivfphwete%' limit 10;
select 'categories' as src, id::text, image_url from categories
  where image_url like '%wgidwyrdnboivfphwete%' limit 10;
select 'products' as src, id::text, main_image_url as image_url from products
  where main_image_url like '%wgidwyrdnboivfphwete%' limit 10;
select 'product_images' as src, id::text, image_url from product_images
  where image_url like '%wgidwyrdnboivfphwete%' limit 10;
select 'platform_settings' as src, key::text as id, value::text as image_url
  from platform_settings where value::text like '%wgidwyrdnboivfphwete%' limit 10;