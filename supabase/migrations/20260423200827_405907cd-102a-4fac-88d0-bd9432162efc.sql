-- =============================================================
-- Seed: Chinese provinces & cities for freight pricing engine
-- Idempotent: safe to re-run
-- =============================================================

-- ============ 1. PROVINCES (30) ============
INSERT INTO public.provinces (name, country_code, is_active)
SELECT v.name, 'CN', true
FROM (VALUES
  ('Beijing'), ('Tianjin'), ('Shanghai'), ('Chongqing'),
  ('Guangdong'), ('Zhejiang'), ('Jiangsu'), ('Fujian'),
  ('Shandong'), ('Hebei'), ('Henan'), ('Hubei'),
  ('Hunan'), ('Jiangxi'), ('Anhui'), ('Sichuan'),
  ('Yunnan'), ('Guizhou'), ('Shaanxi'), ('Gansu'),
  ('Liaoning'), ('Jilin'), ('Heilongjiang'), ('Hainan'),
  ('Shanxi'), ('Guangxi'), ('Inner Mongolia'),
  ('Xinjiang'), ('Tibet'), ('Ningxia')
) AS v(name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.provinces p
  WHERE p.name = v.name AND p.country_code = 'CN'
);

-- ============ 2. RATTACHEMENT VILLES EXISTANTES ============
UPDATE public.cities c SET province_id = p.id
FROM public.provinces p
WHERE p.country_code = 'CN' AND c.country_code = 'CN'
  AND c.province_id IS NULL
  AND (
    (c.name = 'Beijing'    AND p.name = 'Beijing')    OR
    (c.name = 'Shanghai'   AND p.name = 'Shanghai')   OR
    (c.name = 'Guangzhou'  AND p.name = 'Guangdong')  OR
    (c.name = 'Shenzhen'   AND p.name = 'Guangdong')  OR
    (c.name = 'Dongguan'   AND p.name = 'Guangdong')  OR
    (c.name = 'Yiwu'       AND p.name = 'Zhejiang')   OR
    (c.name = 'Ningbo'     AND p.name = 'Zhejiang')
  );

-- ============ 3. NOUVELLES VILLES (33) ============
WITH new_cities(name, province_name, lat, lon, pop) AS (
  VALUES
    -- Zhejiang
    ('Lishui',       'Zhejiang', 28.4517, 119.9219, 2700000),
    ('Hangzhou',     'Zhejiang', 30.2741, 120.1551, 12200000),
    ('Wenzhou',      'Zhejiang', 27.9939, 120.6993, 9300000),
    -- Guangdong
    ('Foshan',       'Guangdong', 23.0218, 113.1219, 9500000),
    ('Zhongshan',    'Guangdong', 22.5176, 113.3928, 4400000),
    ('Zhuhai',       'Guangdong', 22.2710, 113.5767, 2400000),
    ('Shantou',      'Guangdong', 23.3535, 116.6820, 5500000),
    -- Fujian
    ('Xiamen',       'Fujian', 24.4798, 118.0894, 5200000),
    ('Fuzhou',       'Fujian', 26.0745, 119.2965, 8300000),
    ('Quanzhou',     'Fujian', 24.8741, 118.6757, 8800000),
    -- Shandong
    ('Qingdao',      'Shandong', 36.0671, 120.3826, 10100000),
    ('Jinan',        'Shandong', 36.6512, 117.1201, 9200000),
    -- Tianjin
    ('Tianjin',      'Tianjin', 39.0842, 117.2010, 13900000),
    -- Hubei
    ('Wuhan',        'Hubei', 30.5928, 114.3055, 13700000),
    -- Jiangsu
    ('Suzhou',       'Jiangsu', 31.2989, 120.5853, 12800000),
    ('Nanjing',      'Jiangsu', 32.0603, 118.7969, 9300000),
    -- Henan
    ('Zhengzhou',    'Henan', 34.7466, 113.6253, 12600000),
    -- Sichuan
    ('Chengdu',      'Sichuan', 30.5728, 104.0668, 21200000),
    -- Chongqing
    ('Chongqing',    'Chongqing', 29.5630, 106.5516, 32100000),
    -- Hunan
    ('Changsha',     'Hunan', 28.2282, 112.9388, 10500000),
    -- Jiangxi
    ('Nanchang',     'Jiangxi', 28.6820, 115.8579, 6500000),
    -- Anhui
    ('Hefei',        'Anhui', 31.8206, 117.2272, 9400000),
    -- Shaanxi
    ('Xi''an',       'Shaanxi', 34.3416, 108.9398, 13000000),
    -- Liaoning
    ('Shenyang',     'Liaoning', 41.8057, 123.4315, 9100000),
    ('Dalian',       'Liaoning', 38.9140, 121.6147, 7500000),
    -- Heilongjiang
    ('Harbin',       'Heilongjiang', 45.8038, 126.5350, 10700000),
    -- Yunnan
    ('Kunming',      'Yunnan', 25.0389, 102.7183, 8500000),
    -- Guangxi
    ('Nanning',      'Guangxi', 22.8170, 108.3669, 8800000),
    -- Hainan
    ('Haikou',       'Hainan', 20.0440, 110.1920, 2900000),
    -- Gansu
    ('Lanzhou',      'Gansu', 36.0611, 103.8343, 4400000),
    -- Xinjiang
    ('Urumqi',       'Xinjiang', 43.8256, 87.6168, 4100000),
    -- Inner Mongolia
    ('Hohhot',       'Inner Mongolia', 40.8429, 111.7497, 3500000),
    -- Shanxi
    ('Taiyuan',      'Shanxi', 37.8706, 112.5489, 5300000),
    -- Hebei
    ('Shijiazhuang', 'Hebei', 38.0428, 114.5149, 11200000)
)
INSERT INTO public.cities (name, country_code, latitude, longitude, population, province_id, is_active)
SELECT nc.name, 'CN', nc.lat, nc.lon, nc.pop, p.id, true
FROM new_cities nc
JOIN public.provinces p ON p.name = nc.province_name AND p.country_code = 'CN'
WHERE NOT EXISTS (
  SELECT 1 FROM public.cities c
  WHERE c.name = nc.name AND c.country_code = 'CN'
);