

# Enrichissement villes & provinces Chine (moteur tarification fret)

## État actuel (constat DB)

**Villes chinoises présentes (7)** : Beijing, Dongguan, Guangzhou, Ningbo, Shanghai, Shenzhen, Yiwu.

**Provinces chinoises présentes** : **0** (table `provinces` vide pour `country_code='CN'` → impossible de filtrer Ville par Province dans l'UI).

**Manquantes** d'après ta liste + hubs e-commerce/logistique majeurs : Lishui, Hangzhou, Foshan, Xiamen, Qingdao, Tianjin, Wuhan, Suzhou, Zhengzhou, Chengdu, Chongqing, Nanjing, Jinan, Fuzhou, Quanzhou, Wenzhou, Shantou, Zhongshan, Zhuhai, Changsha, Nanchang, Hefei, Xi'an, Shenyang, Dalian, Harbin, Kunming, Nanning, Haikou, Lanzhou, Urumqi, Hohhot, Taiyuan, Shijiazhuang.

## Plan

### 1. Seed des 23 provinces chinoises (table `provinces`)
Insertion des provinces, municipalités et régions autonomes : Beijing, Tianjin, Shanghai, Chongqing (municipalités), Guangdong, Zhejiang, Jiangsu, Fujian, Shandong, Hebei, Henan, Hubei, Hunan, Jiangxi, Anhui, Sichuan, Yunnan, Guizhou, Shaanxi, Gansu, Liaoning, Jilin, Heilongjiang, Hainan, Shanxi + régions autonomes (Guangxi, Inner Mongolia, Xinjiang, Tibet, Ningxia).

### 2. Rattachement des villes existantes à leur province
UPDATE des 7 villes déjà en base avec leur `province_id` correct (ex: Shenzhen/Guangzhou/Dongguan → Guangdong, Shanghai → Shanghai, Yiwu/Ningbo → Zhejiang, Beijing → Beijing).

### 3. Ajout des ~33 villes manquantes
Insertion avec coordonnées GPS réelles (lat/lon), `country_code='CN'`, `province_id` correct, `is_active=true`. Lishui (28.4517, 119.9219, Zhejiang) en tête de liste.

### 4. Détails techniques
- **Migration SQL idempotente** (`ON CONFLICT DO NOTHING` sur unicité name+country_code, créée si absente) commit dans `frontend/supabase/migrations/` → auto-déploiement prod via GitHub Actions, conforme `deployment-workflow-sop`.
- **Aucun changement de schéma** — uniquement des INSERT/UPDATE de données de référence.
- **Aucun impact runtime** sur les villes existantes (coordonnées et `zone_id` préservés).
- Les nouvelles villes apparaîtront immédiatement dans :
  - Le sélecteur "Origine" du moteur de tarification fret
  - Le combo Ville du nouveau dialog **Profils tarifaires transitaires**
  - Tout autre composant utilisant `useGeoData` (cascading address fields)

### 5. Fichiers modifiés
- ➕ `frontend/supabase/migrations/<ts>_seed_china_provinces_cities.sql` (provinces + cities + rattachements)
- Aucun changement frontend nécessaire (l'UI lit déjà `cities` filtré par `country_code`/`province_id`).

### 6. Hors scope
- Pas de refonte du seed pour d'autres pays (à traiter séparément si besoin similaire).
- Pas d'import massif type GeoNames (overkill — on cible les villes pertinentes pour le sourcing/transitaires Zandofy).

