# Zandofy — Guide de Migration Complet : VPS Hostinger

> **⚠️ DOCUMENT OBSOLÈTE (archivé)** — La stack active est **Vercel + Supabase Pro** (2 projets), pas VPS self-hosted / `api.zandofy.com`.
> Utilisez : `AGENTS.md`, `docs/ENVIRONMENTS.md`, `supabase/README.md`, `docs/LOVABLE_INSTRUCTIONS.md`.
> Les sections ci-dessous mentionnent des domaines et chemins (`frontend/supabase/`, Coolify) qui ne sont plus d'actualité.

> **Objectif historique** : Déployer l'intégralité de la plateforme Zandofy sur un VPS Hostinger (4 vCPU / 16 Go RAM / 200 Go NVMe), tout en conservant Lovable + GitHub pour le développement.

---

## Table des matières

1. [Pré-requis et préparation du VPS](#1-pré-requis-et-préparation-du-vps)
2. [Supabase Self-Hosted (Docker Compose)](#2-supabase-self-hosted-docker-compose)
3. [Migration de la base de données (66 migrations SQL)](#3-migration-de-la-base-de-données)
4. [Déploiement des 11 Edge Functions](#4-déploiement-des-11-edge-functions)
5. [Création des 6 buckets Storage](#5-création-des-6-buckets-storage)
6. [Export des données depuis Lovable Cloud](#6-export-des-données-depuis-lovable-cloud)
7. [Frontend : Dockerfile multi-stage](#7-frontend--dockerfile-multi-stage)
8. [Configuration Nginx](#8-configuration-nginx)
9. [Dokploy (CI/CD)](#9-dokploy-cicd)
10. [SSL / HTTPS avec Let's Encrypt](#10-ssl--https-avec-lets-encrypt)
11. [CRON Jobs](#11-cron-jobs)
12. [Sauvegardes automatiques](#12-sauvegardes-automatiques)
13. [Workflow Lovable → GitHub → Production](#13-workflow-lovable--github--production)
14. [Monitoring et seuils d'upgrade](#14-monitoring-et-seuils-dupgrade)

---

## Architecture finale

```text
VPS Hostinger (4 vCPU / 16GB RAM / 200GB NVMe)
│
├── Docker Compose (Supabase Self-Hosted)
│   ├── PostgreSQL 15        (port 5432)
│   ├── GoTrue Auth          (port 9999)
│   ├── PostgREST            (port 3000)
│   ├── Realtime             (port 4000)
│   ├── Storage API          (port 5000)
│   ├── Edge Functions       (port 8081)
│   ├── Kong API Gateway     (port 8000)
│   └── Studio Dashboard     (port 3001)
│
├── Dokploy (CI/CD)
│   └── Webhook GitHub → auto-build frontend
│
├── Nginx (reverse proxy + frontend)
│   ├── Frontend Vite (dist/) → port 80/443
│   ├── Proxy vers Kong (port 8000)
│   └── SSL Let's Encrypt
│
└── CRON (crontab)
    ├── release_vendor_pending_funds  (quotidien)
    ├── expire_inactive_points       (hebdomadaire)
    └── pg_dump backup               (quotidien)
```

---

## 1. Pré-requis et préparation du VPS

### 1.1 Connexion SSH

```bash
# Depuis votre machine locale
ssh root@VOTRE_IP_VPS

# Créer un utilisateur non-root (recommandé)
adduser zandofy
usermod -aG sudo zandofy
su - zandofy
```

### 1.2 Mise à jour du système

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release
```

### 1.3 Installation de Docker & Docker Compose

```bash
# Ajouter le repo officiel Docker
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Ajouter l'utilisateur au groupe docker
sudo usermod -aG docker $USER
newgrp docker

# Vérifier l'installation
docker --version
docker compose version
```

### 1.4 Installation de Node.js 20+

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # v20.x.x
npm --version
```

### 1.5 Installation du Supabase CLI

```bash
# Via npm (méthode recommandée)
sudo npm install -g supabase

# Vérifier
supabase --version
```

### 1.6 Configuration du Firewall (UFW)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
# NE PAS exposer 5432 publiquement (PostgreSQL reste interne)
# NE PAS exposer 8000 publiquement (Kong sera derrière Nginx)
sudo ufw enable
sudo ufw status
```

### 1.7 Configuration DNS

Chez votre registrar (ex: Namecheap, Cloudflare) :

| Type | Nom | Valeur | TTL |
|------|-----|--------|-----|
| A | `zandofy.com` | `VOTRE_IP_VPS` | 300 |
| A | `www` | `VOTRE_IP_VPS` | 300 |
| A | `api` | `VOTRE_IP_VPS` | 300 |
| A | `studio` | `VOTRE_IP_VPS` | 300 |

> **Note** : Attendez la propagation DNS (5-30 min) avant de configurer SSL.

---

## 2. Supabase Self-Hosted (Docker Compose)

### 2.1 Clonage du repo officiel

```bash
cd /home/zandofy
git clone --depth 1 https://github.com/supabase/supabase.git
cd supabase/docker

# Copier le fichier d'exemple
cp .env.example .env
```

### 2.2 Génération des clés JWT

```bash
# Installer le générateur JWT (ou utiliser https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys)
# Générer un JWT_SECRET (minimum 32 caractères)
openssl rand -base64 32
# → Notez cette valeur, c'est votre JWT_SECRET

# Générer les clés ANON et SERVICE_ROLE à partir du JWT_SECRET
# Utilisez https://supabase.com/docs/guides/self-hosting/docker#api-keys
# ou le script fourni dans le repo :
# node scripts/generate-keys.js
```

### 2.3 Configuration du fichier `.env`

Éditez le fichier `.env` dans `/home/zandofy/supabase/docker/` :

```bash
nano .env
```

**Variables critiques à configurer :**

```env
############
# Secrets
############
POSTGRES_PASSWORD=VotreMotDePassePostgresSecurise123!
JWT_SECRET=VotreJWTSecretDe32CaracteresMinimum
ANON_KEY=eyJ... # Clé anon générée à l'étape précédente
SERVICE_ROLE_KEY=eyJ... # Clé service_role générée

############
# Database
############
POSTGRES_HOST=db
POSTGRES_DB=postgres
POSTGRES_PORT=5432

############
# API
############
SITE_URL=https://zandofy.com
API_EXTERNAL_URL=https://api.zandofy.com
SUPABASE_PUBLIC_URL=https://api.zandofy.com

############
# Auth (GoTrue)
############
GOTRUE_SITE_URL=https://zandofy.com
GOTRUE_EXTERNAL_EMAIL_ENABLED=true
GOTRUE_MAILER_AUTOCONFIRM=false
GOTRUE_SMTP_HOST=votre-smtp-host.com
GOTRUE_SMTP_PORT=587
GOTRUE_SMTP_USER=votre-email@zandofy.com
GOTRUE_SMTP_PASS=VotreMotDePasseSMTP
GOTRUE_SMTP_ADMIN_EMAIL=noreply@zandofy.com
GOTRUE_SMTP_SENDER_NAME=Zandofy

############
# Studio
############
STUDIO_DEFAULT_ORGANIZATION=Zandofy
STUDIO_DEFAULT_PROJECT=Zandofy
STUDIO_PORT=3001

############
# Autres
############
ENABLE_PHONE_SIGNUP=false
ENABLE_PHONE_AUTOCONFIRM=false
```

### 2.4 Lancement de Supabase

```bash
cd /home/zandofy/supabase/docker

# Lancer tous les services
docker compose up -d

# Vérifier que tous les conteneurs tournent
docker compose ps

# Logs en temps réel (Ctrl+C pour quitter)
docker compose logs -f
```

### 2.5 Vérification

| Service | URL de test | Résultat attendu |
|---------|------------|-------------------|
| Studio | `http://VOTRE_IP:3001` | Dashboard Supabase |
| Kong (API) | `http://VOTRE_IP:8000` | `{"message":"..."}` |
| GoTrue | `http://VOTRE_IP:9999/health` | `{"status":"ok"}` |
| PostgREST | `http://VOTRE_IP:3000` | Réponse JSON |

> **Important** : Ces ports seront fermés au public après la configuration de Nginx (étape 8).

---

## 3. Migration de la base de données

### 3.1 Méthode A : Via Supabase CLI (recommandée)

```bash
cd /chemin/vers/votre/projet/zandofy

# Initialiser le projet Supabase local si pas déjà fait
supabase init

# Lier au projet self-hosted
supabase link --project-ref local \
  --db-url "postgresql://postgres:VOTRE_MOT_DE_PASSE@VOTRE_IP:5432/postgres"

# Rejouer toutes les migrations
supabase db push
```

### 3.2 Méthode B : Exécution manuelle des migrations

Si la méthode CLI ne fonctionne pas, exécutez les migrations une par une :

```bash
# Se connecter à PostgreSQL
docker exec -it supabase-db psql -U postgres

# Ou depuis l'extérieur (si port 5432 ouvert temporairement)
psql -h VOTRE_IP -U postgres -d postgres
```

```bash
# Exécuter les fichiers SQL un par un, dans l'ordre chronologique
for file in supabase/migrations/*.sql; do
  echo "Executing: $file"
  psql -h localhost -U postgres -d postgres -f "$file"
done
```

### 3.3 Vérification post-migration

```sql
-- Vérifier les tables principales
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Vérifier les fonctions
SELECT routine_name FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- Vérifier les triggers
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- Vérifier les types custom
SELECT typname FROM pg_type WHERE typnamespace = 'public'::regnamespace;

-- Vérifier les politiques RLS
SELECT schemaname, tablename, policyname, permissive, cmd
FROM pg_policies WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

**Tables attendues (liste non exhaustive)** :
- `profiles`, `user_roles`, `stores`, `store_followers`, `products`, `product_images`, `product_colors`, `product_sizes`, `product_pricing_tiers`
- `categories`, `category_surcharges`
- `orders`, `order_items`, `order_status_history`
- `payment_transactions`, `coupons`, `store_coupons`
- `reviews`, `store_reviews`
- `notifications`, `push_subscriptions`
- `conversations`, `messages`
- `vendor_wallets`, `vendor_transactions`, `withdrawal_requests`, `vendor_applications`, `vendor_documents`
- `deliveries`, `rider_locations`, `shipments`
- `referrals`, `zando_points`, `point_transactions`, `gift_cards`
- `disputes`, `dispute_messages`, `return_requests`, `cancellation_requests`
- `cms_banners`, `cms_pages`, `cms_menu_items`, `cms_homepage_sections`, `cms_popups`
- `platform_settings`, `exchange_rates`, `affiliate_tiers`, `customer_tiers`
- `shipping_zones`, `shipping_routes`, `shipping_defaults`, `logistic_zones`, `cities`
- `saved_addresses`, `cart_items`
- `admin_audit_logs`, `badge_requests`

---

## 4. Déploiement des 11 Edge Functions

### 4.1 Liste des fonctions

| # | Nom | Description | JWT |
|---|-----|-------------|-----|
| 1 | `admin-users` | Gestion utilisateurs (service_role) | Non |
| 2 | `calculate-shipping` | Calcul frais de port | Oui |
| 3 | `generate-invoice` | Génération facture PDF | Non |
| 4 | `generate-sitemap` | Sitemap XML dynamique | Non |
| 5 | `kelpay-payment` | Initiation paiement Mobile Money | Non |
| 6 | `kelpay-callback` | Webhook retour paiement | Non |
| 7 | `kelpay-check` | Vérification statut paiement | Non |
| 8 | `notify-expiring-points` | Alerte points expirants | Non |
| 9 | `notify-order-status` | Notification changement statut | Non |
| 10 | `push-notifications` | Push web notifications | Non |
| 11 | `send-email` | Envoi emails SMTP | Non |

### 4.2 Déploiement

```bash
cd /chemin/vers/votre/projet/zandofy

# Déployer toutes les fonctions
supabase functions deploy admin-users --project-ref local
supabase functions deploy calculate-shipping --project-ref local
supabase functions deploy generate-invoice --project-ref local
supabase functions deploy generate-sitemap --project-ref local
supabase functions deploy kelpay-payment --project-ref local
supabase functions deploy kelpay-callback --project-ref local
supabase functions deploy kelpay-check --project-ref local
supabase functions deploy notify-expiring-points --project-ref local
supabase functions deploy notify-order-status --project-ref local
supabase functions deploy push-notifications --project-ref local
supabase functions deploy send-email --project-ref local
```

### 4.3 Configuration des 13 secrets

```bash
supabase secrets set \
  SUPABASE_URL="https://api.zandofy.com" \
  SUPABASE_ANON_KEY="eyJ...votre-anon-key" \
  SUPABASE_SERVICE_ROLE_KEY="eyJ...votre-service-role-key" \
  SUPABASE_DB_URL="postgresql://postgres:VOTRE_MOT_DE_PASSE@db:5432/postgres" \
  SUPABASE_PUBLISHABLE_KEY="eyJ...votre-anon-key" \
  SMTP_HOST="votre-smtp-host.com" \
  SMTP_PORT="587" \
  SMTP_USER="votre-email@zandofy.com" \
  SMTP_PASS="VotreMotDePasseSMTP" \
  SMTP_FROM_EMAIL="noreply@zandofy.com" \
  KELPAY_MERCHANT_CODE="VOTRE_CODE_MARCHAND" \
  KELPAY_TOKEN="VOTRE_TOKEN_KELPAY" \
  LOVABLE_API_KEY="votre-lovable-api-key" \
  --project-ref local
```

### 4.4 Vérification

```bash
# Tester une fonction
curl -X POST https://api.zandofy.com/functions/v1/generate-sitemap \
  -H "Authorization: Bearer VOTRE_ANON_KEY" \
  -H "Content-Type: application/json"
```

---

## 5. Création des 6 buckets Storage

### 5.1 Via le Studio Supabase

Accédez à `http://VOTRE_IP:3001` → **Storage** → **New Bucket** et créez :

| Bucket | Public | Description |
|--------|--------|-------------|
| `product-media` | ✅ Oui | Images et vidéos produits |
| `review-images` | ✅ Oui | Images des avis clients |
| `delivery-proofs` | ✅ Oui | Photos de preuve de livraison |
| `chat-media` | ✅ Oui | Fichiers envoyés dans les messages |
| `vendor-documents` | ❌ Non | Documents privés des vendeurs |
| `cms-assets` | ✅ Oui | Images CMS (bannières, etc.) |

### 5.2 Via SQL (alternative)

```sql
INSERT INTO storage.buckets (id, name, public) VALUES
  ('product-media', 'product-media', true),
  ('review-images', 'review-images', true),
  ('delivery-proofs', 'delivery-proofs', true),
  ('chat-media', 'chat-media', true),
  ('vendor-documents', 'vendor-documents', false),
  ('cms-assets', 'cms-assets', true);
```

### 5.3 Politiques d'accès Storage

Appliquez les mêmes politiques RLS que celles existantes dans Lovable Cloud. Exemple pour les buckets publics :

```sql
-- Lecture publique pour les buckets publics
CREATE POLICY "Public read access" ON storage.objects
  FOR SELECT USING (bucket_id IN ('product-media', 'review-images', 'delivery-proofs', 'chat-media', 'cms-assets'));

-- Upload pour utilisateurs authentifiés
CREATE POLICY "Authenticated upload" ON storage.objects
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
    AND bucket_id IN ('product-media', 'review-images', 'delivery-proofs', 'chat-media', 'cms-assets')
  );

-- Accès privé vendor-documents
CREATE POLICY "Vendor documents access" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'vendor-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Vendor documents upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'vendor-documents'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

---

## 6. Export des données depuis Lovable Cloud

### 6.1 Tables critiques à exporter

Exportez les données dans cet ordre (respecter les dépendances de clés étrangères) :

**Niveau 1 (aucune dépendance) :**
```
categories, platform_settings, exchange_rates, affiliate_tiers, customer_tiers,
logistic_zones, shipping_zones, shipping_defaults, cms_pages, cms_popups
```

**Niveau 2 (dépend du niveau 1) :**
```
profiles, cities, shipping_routes, cms_banners, cms_menu_items,
cms_homepage_sections, category_surcharges, coupons
```

**Niveau 3 (dépend du niveau 2) :**
```
user_roles, stores, saved_addresses, zando_points
```

**Niveau 4 (dépend du niveau 3) :**
```
products, store_followers, store_coupons, vendor_wallets,
vendor_applications, referrals, conversations
```

**Niveau 5 (dépend du niveau 4) :**
```
product_images, product_colors, product_sizes, product_pricing_tiers,
orders, reviews, store_reviews, vendor_documents, messages
```

**Niveau 6 (dépend du niveau 5) :**
```
order_items, order_status_history, payment_transactions, deliveries,
return_requests, disputes, cart_items, point_transactions,
gift_cards, vendor_transactions, withdrawal_requests,
cancellation_requests, push_subscriptions, notifications
```

**Niveau 7 :**
```
dispute_messages, rider_locations, admin_audit_logs, badge_requests, shipments
```

### 6.2 Méthode d'export

Depuis Lovable Cloud, utilisez l'outil SQL pour exporter chaque table :

```sql
-- Exemple : exporter les catégories
SELECT * FROM categories;
-- Copier le résultat en CSV ou JSON
```

**Alternative** : Si vous avez accès à la connexion directe PostgreSQL de Lovable Cloud :

```bash
# Export avec pg_dump (table par table)
pg_dump --data-only --table=public.categories \
  -h HOST_LOVABLE -U postgres -d postgres > export_categories.sql
```

### 6.3 Import dans le nouveau PostgreSQL

```bash
# Importer les données
psql -h localhost -U postgres -d postgres -f export_categories.sql

# Ou via COPY pour CSV
psql -h localhost -U postgres -d postgres -c "\copy categories FROM 'categories.csv' CSV HEADER"
```

> **⚠️ Important** : Désactivez temporairement les triggers pendant l'import pour éviter les notifications en masse :
> ```sql
> -- Avant l'import
> SET session_replication_role = 'replica';
>
> -- Faire l'import ici...
>
> -- Après l'import
> SET session_replication_role = 'origin';
> ```

---

## 7. Frontend : Dockerfile multi-stage

Un fichier `Dockerfile` est fourni à la racine du projet. Voir le fichier pour les détails.

### 7.1 Build local (test)

```bash
# Build l'image
docker build \
  --build-arg VITE_SUPABASE_URL=https://api.zandofy.com \
  --build-arg VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...votre-anon-key \
  --build-arg VITE_SUPABASE_PROJECT_ID=zandofy-prod \
  -t zandofy-frontend .

# Lancer le conteneur
docker run -d -p 8080:80 --name zandofy-web zandofy-frontend

# Tester
curl http://localhost:8080
```

---

## 8. Configuration Nginx

### 8.1 Installation de Nginx (si pas déjà via Docker)

Si vous préférez Nginx sur le host (hors Docker) :

```bash
sudo apt install -y nginx
```

### 8.2 Configuration du reverse proxy

Créez le fichier de configuration :

```bash
sudo nano /etc/nginx/sites-available/zandofy
```

Utilisez le contenu du fichier `nginx.conf` fourni à la racine du projet, adapté pour un reverse proxy complet :

```nginx
server {
    listen 80;
    server_name zandofy.com www.zandofy.com;

    # Redirection vers HTTPS (après configuration SSL)
    # return 301 https://$server_name$request_uri;

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API Supabase (Kong)
    location /rest/ {
        proxy_pass http://127.0.0.1:8000/rest/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /auth/ {
        proxy_pass http://127.0.0.1:8000/auth/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /storage/ {
        proxy_pass http://127.0.0.1:8000/storage/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        client_max_body_size 50M;
    }

    location /functions/ {
        proxy_pass http://127.0.0.1:8000/functions/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Realtime WebSocket
    location /realtime/ {
        proxy_pass http://127.0.0.1:8000/realtime/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}

# API subdomain
server {
    listen 80;
    server_name api.zandofy.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket pour Realtime
    location /realtime/ {
        proxy_pass http://127.0.0.1:8000/realtime/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}

# Studio (accès restreint)
server {
    listen 80;
    server_name studio.zandofy.com;

    # Restreindre l'accès par IP si possible
    # allow VOTRE_IP_ADMIN;
    # deny all;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
# Activer le site
sudo ln -s /etc/nginx/sites-available/zandofy /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 9. Dokploy (CI/CD)

### 9.1 Installation de Dokploy

```bash
curl -sSL https://dokploy.com/install.sh | sh
```

Accédez à `http://VOTRE_IP:3000` (port par défaut Dokploy) pour configurer.

> **Note** : Si le port 3000 entre en conflit avec PostgREST, modifiez le port de Dokploy dans sa configuration.

### 9.2 Configuration

1. **Connecter GitHub** : Settings → Git → Add GitHub App
2. **Créer un projet** : Projects → New → Sélectionner le repo `zandofy`
3. **Variables d'environnement** :
   ```
   VITE_SUPABASE_URL=https://api.zandofy.com
   VITE_SUPABASE_PUBLISHABLE_KEY=eyJ...votre-anon-key
   VITE_SUPABASE_PROJECT_ID=zandofy-prod
   ```
4. **Build command** : Docker (utilise le Dockerfile du repo)
5. **Port** : 80 (Nginx interne au conteneur)

### 9.3 Webhook automatique

Dokploy configure automatiquement un webhook GitHub. Chaque push sur la branche `main` déclenche un rebuild.

---

## 10. SSL / HTTPS avec Let's Encrypt

### 10.1 Installation de Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 10.2 Obtention des certificats

```bash
# Pour tous les sous-domaines
sudo certbot --nginx \
  -d zandofy.com \
  -d www.zandofy.com \
  -d api.zandofy.com \
  -d studio.zandofy.com \
  --email admin@zandofy.com \
  --agree-tos \
  --no-eff-email
```

### 10.3 Renouvellement automatique

```bash
# Vérifier que le timer est actif
sudo systemctl status certbot.timer

# Tester le renouvellement
sudo certbot renew --dry-run
```

### 10.4 Mise à jour de la configuration Nginx

Après Certbot, le fichier Nginx est automatiquement mis à jour pour :
- Écouter sur le port 443 avec SSL
- Rediriger le port 80 vers 443
- Utiliser les certificats Let's Encrypt

---

## 11. CRON Jobs

### 11.1 Libération des fonds vendeurs (quotidien)

```bash
crontab -e
```

Ajoutez :

```cron
# Libération des fonds vendeurs — tous les jours à 2h du matin
0 2 * * * docker exec supabase-db psql -U postgres -d postgres -c "SELECT release_vendor_pending_funds();" >> /var/log/zandofy/cron-vendor-funds.log 2>&1

# Expiration des points inactifs — tous les lundis à 3h du matin
0 3 * * 1 docker exec supabase-db psql -U postgres -d postgres -c "SELECT expire_inactive_points(12);" >> /var/log/zandofy/cron-expire-points.log 2>&1

# Backup PostgreSQL — tous les jours à 4h du matin
0 4 * * * /home/zandofy/scripts/backup-db.sh >> /var/log/zandofy/cron-backup.log 2>&1
```

### 11.2 Créer le répertoire de logs

```bash
sudo mkdir -p /var/log/zandofy
sudo chown zandofy:zandofy /var/log/zandofy
```

---

## 12. Sauvegardes automatiques

### 12.1 Script de backup PostgreSQL

Créez le fichier `/home/zandofy/scripts/backup-db.sh` :

```bash
#!/bin/bash
set -euo pipefail

BACKUP_DIR="/home/zandofy/backups/postgres"
RETENTION_DAYS=7
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/zandofy_${TIMESTAMP}.sql.gz"

# Créer le répertoire si nécessaire
mkdir -p "$BACKUP_DIR"

# Dump de la base
docker exec supabase-db pg_dump -U postgres -d postgres | gzip > "$BACKUP_FILE"

# Vérifier que le fichier n'est pas vide
if [ ! -s "$BACKUP_FILE" ]; then
  echo "ERROR: Backup file is empty!"
  exit 1
fi

echo "Backup created: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

# Rotation : supprimer les backups de plus de N jours
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +${RETENTION_DAYS} -delete
echo "Old backups cleaned (retention: ${RETENTION_DAYS} days)"
```

```bash
chmod +x /home/zandofy/scripts/backup-db.sh
```

### 12.2 Backup des fichiers Storage

```bash
#!/bin/bash
# /home/zandofy/scripts/backup-storage.sh
set -euo pipefail

BACKUP_DIR="/home/zandofy/backups/storage"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Copier les volumes Docker de Storage
docker cp supabase-storage:/var/lib/storage "$BACKUP_DIR/storage_${TIMESTAMP}"

# Compresser
tar -czf "${BACKUP_DIR}/storage_${TIMESTAMP}.tar.gz" -C "$BACKUP_DIR" "storage_${TIMESTAMP}"
rm -rf "${BACKUP_DIR}/storage_${TIMESTAMP}"

echo "Storage backup: ${BACKUP_DIR}/storage_${TIMESTAMP}.tar.gz"

# Rotation
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete
```

---

## 13. Workflow Lovable → GitHub → Production

### 13.1 Flux de développement

```text
┌─────────────┐     auto-push     ┌──────────┐     webhook     ┌─────────────┐
│   Lovable   │ ───────────────── │  GitHub  │ ──────────────── │ VPS (Dokploy)│
│ (dev/design)│                   │  (repo)  │                  │  (production)│
└─────────────┘                   └──────────┘                  └─────────────┘
                                       │
                                       │ pull + review
                                       ▼
                                ┌──────────────┐
                                │  IDE local   │
                                │  (optionnel) │
                                └──────────────┘
```

### 13.2 Processus pour le Frontend

1. Développez dans Lovable (design, composants, pages)
2. Lovable pousse automatiquement sur GitHub (branche `main`)
3. Dokploy détecte le push via webhook
4. Dokploy rebuild l'image Docker et redéploie automatiquement
5. **Temps de déploiement** : ~2-3 minutes

### 13.3 Processus pour les migrations SQL

⚠️ **Les migrations SQL ne sont PAS automatiques** — elles doivent être appliquées manuellement :

```bash
# 1. Tirez les derniers changements depuis GitHub
cd /home/zandofy/zandofy
git pull origin main

# 2. Vérifiez les nouvelles migrations
ls -la supabase/migrations/

# 3. Appliquez les migrations
supabase db push --db-url "postgresql://postgres:MOT_DE_PASSE@localhost:5432/postgres"

# 4. Vérifiez le résultat
docker exec supabase-db psql -U postgres -c "SELECT * FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 5;"
```

### 13.4 Processus pour les Edge Functions

```bash
# 1. Tirez les derniers changements
git pull origin main

# 2. Redéployez les fonctions modifiées
supabase functions deploy NOM_DE_LA_FONCTION --project-ref local

# Ou toutes d'un coup
for fn in admin-users calculate-shipping generate-invoice generate-sitemap \
  kelpay-payment kelpay-callback kelpay-check notify-expiring-points \
  notify-order-status push-notifications send-email; do
  supabase functions deploy $fn --project-ref local
done
```

---

## 14. Monitoring et seuils d'upgrade

### 14.1 Commandes de monitoring

```bash
# Utilisation RAM en temps réel
htop
# ou
free -h

# Utilisation disque
df -h

# Utilisation CPU
top

# Logs Docker (tous les services)
docker stats

# Logs Supabase spécifiques
docker compose -f /home/zandofy/supabase/docker/docker-compose.yml logs -f --tail=100
```

### 14.2 Script de monitoring (optionnel)

```bash
#!/bin/bash
# /home/zandofy/scripts/health-check.sh

echo "=== Zandofy Health Check ==="
echo "Date: $(date)"
echo ""

# RAM
echo "--- RAM ---"
free -h | grep Mem

# Disk
echo "--- Disk ---"
df -h / | tail -1

# Docker containers
echo "--- Docker ---"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | head -20

# API response time
echo "--- API Response ---"
time curl -s -o /dev/null -w "%{http_code}" https://api.zandofy.com/rest/v1/ 2>&1

echo ""
echo "==========================="
```

### 14.3 Seuils d'alerte pour upgrade vers 8 vCPU / 32 Go

| Métrique | Seuil d'alerte | Action |
|----------|----------------|--------|
| RAM utilisée | > 12 Go (75%) | Planifier upgrade |
| Stockage utilisé | > 150 Go (75%) | Planifier upgrade |
| CPU moyen | > 80% pendant 1h | Planifier upgrade |
| Temps de réponse API | > 500ms en moyenne | Investiguer + upgrade |
| Connexions PostgreSQL | > 80 simultanées | Augmenter `max_connections` ou upgrade |

### 14.4 Procédure d'upgrade chez Hostinger

1. Connectez-vous au panel Hostinger
2. VPS → Upgrade Plan → Sélectionner 8 vCPU / 32 Go
3. L'upgrade se fait généralement **sans perte de données** et avec un redémarrage court (~5 min)
4. Après l'upgrade, vérifiez que tous les services Docker sont relancés :
   ```bash
   docker compose -f /home/zandofy/supabase/docker/docker-compose.yml up -d
   ```

---

## Estimation du temps de mise en place

| Phase | Durée estimée |
|-------|---------------|
| VPS + Docker + Supabase | 2-3 heures |
| Migration DB + Edge Functions | 1-2 heures |
| Frontend + Dokploy + SSL | 1-2 heures |
| Données + Storage + CRON | 2-3 heures |
| **Total** | **~1 journée** |

---

## Checklist finale

- [ ] VPS provisionné et accessible en SSH
- [ ] Docker + Docker Compose installés
- [ ] Supabase Self-Hosted lancé et fonctionnel
- [ ] 66 migrations SQL rejouées et vérifiées
- [ ] 11 Edge Functions déployées
- [ ] 13 secrets configurés
- [ ] 6 buckets Storage créés avec politiques RLS
- [ ] Données migrées depuis Lovable Cloud
- [ ] Frontend buildé et servi via Nginx
- [ ] Dokploy connecté à GitHub avec webhook
- [ ] SSL/HTTPS configuré (Let's Encrypt)
- [ ] CRON jobs en place (fonds vendeurs, points, backup)
- [ ] Sauvegardes automatiques PostgreSQL
- [ ] DNS configuré (domaine + sous-domaines)
- [ ] Variables d'environnement mises à jour dans le frontend
- [ ] Tests end-to-end effectués (inscription, commande, paiement)
- [ ] Monitoring en place
