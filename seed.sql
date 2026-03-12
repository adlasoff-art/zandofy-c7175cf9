-- =============================================================
-- ZANDOFY — Seed Data (Production)
-- Copiez ce script dans le SQL Editor de supabase.com → Run
-- =============================================================

-- =====================
-- 1. CATÉGORIES
-- =====================

INSERT INTO public.categories (id, name, name_fr, icon, image_url) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Fashion', 'Mode', '👗', NULL),
  ('a1000000-0000-0000-0000-000000000002', 'Electronics', 'Électronique', '📱', NULL),
  ('a1000000-0000-0000-0000-000000000003', 'Beauty', 'Beauté & Soins', '💄', NULL),
  ('a1000000-0000-0000-0000-000000000004', 'Home & Living', 'Maison & Déco', '🏠', NULL),
  ('a1000000-0000-0000-0000-000000000005', 'Sports', 'Sports & Loisirs', '⚽', NULL),
  ('a1000000-0000-0000-0000-000000000006', 'Kids & Baby', 'Enfants & Bébé', '🧸', NULL),
  ('a1000000-0000-0000-0000-000000000007', 'Grocery', 'Alimentation', '🛒', NULL),
  ('a1000000-0000-0000-0000-000000000008', 'Auto & Moto', 'Auto & Moto', '🚗', NULL),
  ('a1000000-0000-0000-0000-000000000009', 'Books & Media', 'Livres & Médias', '📚', NULL),
  ('a1000000-0000-0000-0000-000000000010', 'Health', 'Santé & Bien-être', '💊', NULL)
ON CONFLICT (id) DO NOTHING;

-- Sous-catégories Mode
INSERT INTO public.categories (name, name_fr, icon, parent_id) VALUES
  ('Women''s Clothing', 'Vêtements Femme', '👚', 'a1000000-0000-0000-0000-000000000001'),
  ('Men''s Clothing', 'Vêtements Homme', '👔', 'a1000000-0000-0000-0000-000000000001'),
  ('Shoes', 'Chaussures', '👟', 'a1000000-0000-0000-0000-000000000001'),
  ('Bags & Accessories', 'Sacs & Accessoires', '👜', 'a1000000-0000-0000-0000-000000000001'),
  ('Jewelry', 'Bijoux', '💍', 'a1000000-0000-0000-0000-000000000001'),
  ('African Fashion', 'Mode Africaine', '🌍', 'a1000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- Sous-catégories Électronique
INSERT INTO public.categories (name, name_fr, icon, parent_id) VALUES
  ('Phones & Tablets', 'Téléphones & Tablettes', '📱', 'a1000000-0000-0000-0000-000000000002'),
  ('Computers', 'Ordinateurs', '💻', 'a1000000-0000-0000-0000-000000000002'),
  ('TV & Audio', 'TV & Audio', '📺', 'a1000000-0000-0000-0000-000000000002'),
  ('Accessories', 'Accessoires Tech', '🎧', 'a1000000-0000-0000-0000-000000000002')
ON CONFLICT DO NOTHING;

-- Sous-catégories Beauté
INSERT INTO public.categories (name, name_fr, icon, parent_id) VALUES
  ('Skincare', 'Soins de la peau', '🧴', 'a1000000-0000-0000-0000-000000000003'),
  ('Makeup', 'Maquillage', '💅', 'a1000000-0000-0000-0000-000000000003'),
  ('Hair Care', 'Soins capillaires', '💇', 'a1000000-0000-0000-0000-000000000003'),
  ('Perfumes', 'Parfums', '🌸', 'a1000000-0000-0000-0000-000000000003')
ON CONFLICT DO NOTHING;

-- Sous-catégories Maison
INSERT INTO public.categories (name, name_fr, icon, parent_id) VALUES
  ('Furniture', 'Meubles', '🛋️', 'a1000000-0000-0000-0000-000000000004'),
  ('Kitchen', 'Cuisine', '🍳', 'a1000000-0000-0000-0000-000000000004'),
  ('Decoration', 'Décoration', '🖼️', 'a1000000-0000-0000-0000-000000000004'),
  ('Bedding', 'Literie', '🛏️', 'a1000000-0000-0000-0000-000000000004')
ON CONFLICT DO NOTHING;

-- Sous-catégories Enfants
INSERT INTO public.categories (name, name_fr, icon, parent_id) VALUES
  ('Baby Clothes', 'Vêtements Bébé', '👶', 'a1000000-0000-0000-0000-000000000006'),
  ('Toys', 'Jouets', '🎮', 'a1000000-0000-0000-0000-000000000006'),
  ('School Supplies', 'Fournitures scolaires', '📝', 'a1000000-0000-0000-0000-000000000006')
ON CONFLICT DO NOTHING;


-- =====================
-- 2. TIERS & FIDÉLITÉ
-- =====================

-- Customer Tiers (programme fidélité)
INSERT INTO public.customer_tiers (tier_name, badge_label, min_orders, min_spent, discount_pct, sort_order) VALUES
  ('Client', '🛍️ Client', 0, 0, 0, 0),
  ('Junior', '⭐ Junior', 20, 500, 1, 1),
  ('Senior', '⭐⭐ Senior', 100, 2000, 3, 2),
  ('Pro', '🌟 Pro', 250, 5000, 5, 3),
  ('Business', '💎 Business', 500, 10000, 8, 4),
  ('Elite', '👑 Elite', 1000, 50000, 12, 5),
  ('Angel', '😇 Angel', 1500, 100000, 15, 6)
ON CONFLICT DO NOTHING;

-- Affiliate Tiers
INSERT INTO public.affiliate_tiers (tier_name, min_referrals, commission_pct, bonus_points, badge_label) VALUES
  ('Starter', 0, 5, 0, '🤝 Starter'),
  ('Bronze', 10, 7, 50, '🥉 Bronze'),
  ('Silver', 50, 10, 200, '🥈 Silver'),
  ('Gold', 150, 12, 500, '🥇 Gold'),
  ('Platinum', 500, 15, 1500, '💎 Platinum')
ON CONFLICT DO NOTHING;

-- Exchange Rates
INSERT INTO public.exchange_rates (base_currency, target_currency, rate) VALUES
  ('USD', 'CDF', 2750),
  ('USD', 'EUR', 0.92),
  ('USD', 'XAF', 605),
  ('USD', 'ZAR', 18.5),
  ('USD', 'KES', 155),
  ('USD', 'NGN', 1550),
  ('USD', 'GBP', 0.79)
ON CONFLICT DO NOTHING;


-- =====================
-- 3. LOGISTIQUE & SHIPPING
-- =====================

-- Logistic Zones
INSERT INTO public.logistic_zones (id, name, continent) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'Afrique Centrale', 'Africa'),
  ('b1000000-0000-0000-0000-000000000002', 'Afrique de l''Est', 'Africa'),
  ('b1000000-0000-0000-0000-000000000003', 'Afrique de l''Ouest', 'Africa'),
  ('b1000000-0000-0000-0000-000000000004', 'Afrique Australe', 'Africa'),
  ('b1000000-0000-0000-0000-000000000005', 'Asie', 'Asia'),
  ('b1000000-0000-0000-0000-000000000006', 'Europe', 'Europe')
ON CONFLICT (id) DO NOTHING;

-- Shipping Zones
INSERT INTO public.shipping_zones (id, name, zone_type, country_code, city) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Kinshasa', 'city', 'CD', 'Kinshasa'),
  ('c1000000-0000-0000-0000-000000000002', 'Lubumbashi', 'city', 'CD', 'Lubumbashi'),
  ('c1000000-0000-0000-0000-000000000003', 'Goma', 'city', 'CD', 'Goma'),
  ('c1000000-0000-0000-0000-000000000004', 'Bukavu', 'city', 'CD', 'Bukavu'),
  ('c1000000-0000-0000-0000-000000000005', 'Kisangani', 'city', 'CD', 'Kisangani'),
  ('c1000000-0000-0000-0000-000000000006', 'Mbuji-Mayi', 'city', 'CD', 'Mbuji-Mayi'),
  ('c1000000-0000-0000-0000-000000000007', 'Matadi', 'city', 'CD', 'Matadi'),
  ('c1000000-0000-0000-0000-000000000008', 'Kananga', 'city', 'CD', 'Kananga'),
  ('c1000000-0000-0000-0000-000000000009', 'Likasi', 'city', 'CD', 'Likasi'),
  ('c1000000-0000-0000-0000-000000000010', 'Kolwezi', 'city', 'CD', 'Kolwezi'),
  ('c1000000-0000-0000-0000-000000000020', 'Guangzhou (Chine)', 'city', 'CN', 'Guangzhou'),
  ('c1000000-0000-0000-0000-000000000021', 'Dubai (UAE)', 'city', 'AE', 'Dubai'),
  ('c1000000-0000-0000-0000-000000000022', 'Istanbul (Turquie)', 'city', 'TR', 'Istanbul')
ON CONFLICT (id) DO NOTHING;

-- Cities RDC (avec coordonnées GPS)
INSERT INTO public.cities (name, country_code, latitude, longitude, population, zone_id, logistic_zone_id) VALUES
  ('Kinshasa', 'CD', -4.3250, 15.3222, 17000000, 'c1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001'),
  ('Lubumbashi', 'CD', -11.6647, 27.4794, 2500000, 'c1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001'),
  ('Goma', 'CD', -1.6792, 29.2228, 1200000, 'c1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000001'),
  ('Bukavu', 'CD', -2.5083, 28.8608, 1000000, 'c1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000001'),
  ('Kisangani', 'CD', 0.5153, 25.1910, 1400000, 'c1000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000001'),
  ('Mbuji-Mayi', 'CD', -6.1500, 23.6000, 2000000, 'c1000000-0000-0000-0000-000000000006', 'b1000000-0000-0000-0000-000000000001'),
  ('Matadi', 'CD', -5.8167, 13.4500, 350000, 'c1000000-0000-0000-0000-000000000007', 'b1000000-0000-0000-0000-000000000001'),
  ('Kananga', 'CD', -5.8962, 22.4166, 1200000, 'c1000000-0000-0000-0000-000000000008', 'b1000000-0000-0000-0000-000000000001'),
  ('Likasi', 'CD', -10.9833, 26.7333, 500000, 'c1000000-0000-0000-0000-000000000009', 'b1000000-0000-0000-0000-000000000001'),
  ('Kolwezi', 'CD', -10.7167, 25.4667, 600000, 'c1000000-0000-0000-0000-000000000010', 'b1000000-0000-0000-0000-000000000001'),
  ('Bunia', 'CD', 1.5594, 30.2522, 400000, NULL, 'b1000000-0000-0000-0000-000000000001'),
  ('Beni', 'CD', 0.4960, 29.4686, 350000, NULL, 'b1000000-0000-0000-0000-000000000001'),
  ('Uvira', 'CD', -3.3956, 29.1378, 300000, NULL, 'b1000000-0000-0000-0000-000000000001'),
  ('Kalemie', 'CD', -5.9475, 29.1947, 200000, NULL, 'b1000000-0000-0000-0000-000000000001'),
  ('Kikwit', 'CD', -5.0411, 18.8181, 400000, NULL, 'b1000000-0000-0000-0000-000000000001'),
  ('Mbandaka', 'CD', 0.0478, 18.2631, 350000, NULL, 'b1000000-0000-0000-0000-000000000001'),
  ('Tshikapa', 'CD', -5.4000, 20.8000, 600000, NULL, 'b1000000-0000-0000-0000-000000000001'),
  ('Bandundu', 'CD', -3.3167, 17.3667, 150000, NULL, 'b1000000-0000-0000-0000-000000000001'),
  ('Boma', 'CD', -5.8500, 13.0500, 200000, NULL, 'b1000000-0000-0000-0000-000000000001'),
  ('Kasumbalesa', 'CD', -12.6167, 28.5333, 100000, NULL, 'b1000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- Shipping Routes
INSERT INTO public.shipping_routes (origin_zone_id, destination_zone_id, transport_mode, rate_price, rate_unit, min_charge, fuel_surcharge_pct, transit_days_min, transit_days_max, is_active) VALUES
  ('c1000000-0000-0000-0000-000000000020', 'c1000000-0000-0000-0000-000000000001', 'air', 8.50, 'per_kg', 25, 5, 7, 14, true),
  ('c1000000-0000-0000-0000-000000000020', 'c1000000-0000-0000-0000-000000000002', 'air', 9.00, 'per_kg', 25, 5, 8, 16, true),
  ('c1000000-0000-0000-0000-000000000021', 'c1000000-0000-0000-0000-000000000001', 'air', 7.00, 'per_kg', 20, 3, 5, 10, true),
  ('c1000000-0000-0000-0000-000000000022', 'c1000000-0000-0000-0000-000000000001', 'air', 7.50, 'per_kg', 20, 4, 6, 12, true),
  ('c1000000-0000-0000-0000-000000000020', 'c1000000-0000-0000-0000-000000000001', 'sea', 2.50, 'per_kg', 50, 3, 35, 60, true),
  ('c1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000002', 'road', 3.00, 'per_kg', 10, 2, 3, 7, true),
  ('c1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000003', 'air', 5.00, 'per_kg', 15, 2, 1, 3, true),
  ('c1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000007', 'road', 1.50, 'per_kg', 5, 1, 1, 2, true)
ON CONFLICT DO NOTHING;

-- Shipping Defaults
INSERT INTO public.shipping_defaults (mode, default_rate, rate_unit, currency) VALUES
  ('air', 8.00, 'per_kg', 'USD'),
  ('sea', 2.50, 'per_kg', 'USD'),
  ('road', 2.00, 'per_kg', 'USD')
ON CONFLICT DO NOTHING;

-- Category Surcharges
INSERT INTO public.category_surcharges (category_id, label, surcharge_type, surcharge_value, is_active) VALUES
  ('a1000000-0000-0000-0000-000000000002', 'Électronique fragile', 'percentage', 15, true),
  ('a1000000-0000-0000-0000-000000000004', 'Meuble volumineux', 'percentage', 20, true)
ON CONFLICT DO NOTHING;


-- =====================
-- 4. CMS & PLATFORM
-- =====================

-- Platform Settings
INSERT INTO public.platform_settings (key, value) VALUES
  ('new_product_days', '14'),
  ('free_shipping_threshold', '100'),
  ('referral_commission_pct', '5'),
  ('referral_max_rewarded_orders', '10'),
  ('points_expiry_months', '12'),
  ('platform_commission_pct', '10'),
  ('min_order_amount', '5'),
  ('max_saved_addresses', '5'),
  ('default_currency', '"USD"'),
  ('supported_currencies', '["USD", "CDF", "EUR"]'),
  ('contact_email', '"support@zandofy.com"'),
  ('contact_whatsapp', '"+243000000000"'),
  ('maintenance_mode', 'false')
ON CONFLICT (key) DO NOTHING;

-- CMS Banners
INSERT INTO public.cms_banners (title, subtitle, cta, link, position, sort_order, is_active) VALUES
  ('Bienvenue sur Zandofy', 'La marketplace #1 en RDC — Mode, Tech, Beauté et plus', 'Découvrir', '/categories', 'hero', 0, true),
  ('Nouveautés Mode', 'Découvrez les dernières tendances africaines', 'Voir les nouveautés', '/category/fashion', 'hero', 1, true),
  ('Livraison rapide', 'Recevez vos colis partout en RDC', 'En savoir plus', '/page/livraison', 'hero', 2, true);

-- CMS Menu Items
INSERT INTO public.cms_menu_items (label, url, menu_group, sort_order, is_visible) VALUES
  ('Accueil', '/', 'main', 0, true),
  ('Mode', '/category/fashion', 'main', 1, true),
  ('Électronique', '/category/electronics', 'main', 2, true),
  ('Beauté', '/category/beauty', 'main', 3, true),
  ('Maison', '/category/home-living', 'main', 4, true),
  ('Soldes', '/category/sales', 'main', 5, true),
  ('À propos', '/page/about', 'footer', 0, true),
  ('Conditions d''utilisation', '/page/terms', 'footer', 1, true),
  ('Politique de confidentialité', '/page/privacy', 'footer', 2, true),
  ('Nous contacter', '/page/contact', 'footer', 3, true),
  ('Devenir vendeur', '/vendor/apply', 'footer', 4, true);

-- CMS Homepage Sections
INSERT INTO public.cms_homepage_sections (section_key, label, sort_order, is_active, config) VALUES
  ('hero_banners', 'Bannières Hero', 0, true, '{"autoplay": true, "interval": 5000}'),
  ('categories_grid', 'Catégories', 1, true, '{"columns": 5, "showIcon": true}'),
  ('new_arrivals', 'Nouveautés', 2, true, '{"limit": 12, "showTimer": false}'),
  ('flash_sales', 'Ventes Flash', 3, true, '{"limit": 8, "showTimer": true}'),
  ('popular_products', 'Produits populaires', 4, true, '{"limit": 12, "sortBy": "sales"}'),
  ('top_stores', 'Boutiques vedettes', 5, true, '{"limit": 6}'),
  ('newsletter', 'Newsletter', 6, true, '{}')
ON CONFLICT (section_key) DO NOTHING;


-- =============================================================
-- FIN DU SEED — Toutes les données initiales sont prêtes ✅
-- =============================================================
