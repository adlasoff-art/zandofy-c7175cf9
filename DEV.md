# Zandofy — Développement de l'outil (Backend FastAPI)

Ce document décrit les choix techniques et l’implémentation du backend de la plateforme Zandofy, réalisé en **FastAPI** selon le guide « Roadmap Backend & Guide d'intégration API ».

---

## 1. Stack et structure

- **Framework** : FastAPI (async)
- **ORM** : SQLAlchemy 2 (async avec `asyncpg`)
- **Base** : PostgreSQL (compatible Supabase)
- **Auth** : JWT (python-jose) + RBAC (5 rôles : admin, seller, buyer, support, moderator)
- **Tâches planifiées** : APScheduler (CRON en processus)
- **Emails** : aiosmtplib + Jinja2 (templates HTML)
- **PDF** : ReportLab (factures)
- **Push** : pywebpush (VAPID)

Structure du projet :

```
backend/
├── app/
│   ├── core/           # config, database, security, auth, rate_limit, upload
│   ├── models/         # SQLAlchemy (users, orders, payments, products, shops, wallet, push, subscriptions, audit)
│   ├── schemas/        # Pydantic (common)
│   ├── services/      # kelpay, email, invoice, push, wallet_release, sitemap
│   ├── routers/       # auth, payments, webhooks, orders, search, email, invoices, push, subscriptions, sitemap, analytics, admin
│   └── templates/email/
├── alembic/            # migrations
├── requirements.txt
├── .env.example
└── DEV.md (ce fichier)
```

---

## 2. Fonctionnalités implémentées

### 2.1 Passerelle de paiement (non-Stripe) — Kelpay

- **Tables** : `payment_transactions` (déjà prévue dans le guide).
- **Service** : `app/services/kelpay.py` — `initiate_payment()` (Mobile Money + carte), `check_payment_status()`, `verify_webhook_signature()`.
- **Endpoints** :
  - `POST /api/v1/payments/init` : initie un paiement (order_id, payment_method, callback_url).
  - `POST /api/v1/webhooks/kelpay` : webhook de confirmation ; mise à jour `payment_transactions.status` et `orders.status` → `confirmed` en cas de succès.
- **Config** : `KELPAY_MERCHANT_CODE`, `KELPAY_TOKEN`, `KELPAY_WEBHOOK_SECRET`, `KELPAY_BASE_URL`.

### 2.2 Libération automatique des fonds vendeurs

- **Service** : `app/services/wallet_release.py` — `release_vendor_pending_funds(db, retention_days)`.
  - Sélection des commandes `delivered` avec `delivered_at` antérieur à `retention_days` (défaut 7).
  - Pour chaque commande non encore libérée : création d’une `WalletTransaction` (type `order_release`), mise à jour du wallet (pending → balance).
- **CRON** : `app/core/scheduler.py` — APScheduler, job quotidien à 02:00 qui appelle `release_vendor_pending_funds()`.

### 2.3 Recherche avancée (full-text)

- **Option retenue** : requêtes SQL avec filtres (catégorie, prix min/max, taille, couleur) et recherche texte sur `name` / `description` (ILIKE). Pas de colonne `ts_vector` dans la migration initiale pour rester compatible sans extension ; une migration ultérieure peut ajouter `ts_vector` + index GIN pour du vrai full-text.
- **Endpoints** :
  - `POST /api/v1/search/` : body `SearchFilters` (q, category_slug, min_price, max_price, size, color, sort, limit, offset).
  - `GET /api/v1/search/suggest?q=...` : autocomplétion (suggestions par nom de produit).

### 2.4 Emails transactionnels

- **Service** : `app/services/email_service.py` (SMTP + Jinja2).
- **Templates** (dans `app/templates/email/`) : `order_confirmation.html`, `order_shipped.html`, `order_delivered.html`, `password_reset.html`, `vendor_new_order.html`, `newsletter_welcome.html`.
- **Endpoints** (exemples) : `POST /api/v1/email/send-order-confirmation`, `POST /api/v1/email/password-reset`, `POST /api/v1/email/newsletter/subscribe`.
- Intégration côté commandes : envoi confirmation / expédition / livraison depuis `app/routers/orders.py` (changement de statut) et possibilité d’appeler les envois depuis le webhook ou d’autres services.

### 2.5 Génération de factures PDF

- **Service** : `app/services/invoice_service.py` — `generate_invoice_pdf()` (ReportLab), `upload_invoice_to_storage()` (Supabase Storage).
- **Endpoints** :
  - `GET /api/v1/invoices/{order_id}/pdf` : téléchargement direct du PDF (client authentifié).
  - `POST /api/v1/invoices/{order_id}/generate-and-store` : génère le PDF, l’upload dans le bucket, retourne l’URL de téléchargement.

### 2.6 Notifications push

- **Table** : `push_subscriptions` (endpoint, p256dh, auth, user_id).
- **Service** : `app/services/push_service.py` (pywebpush, VAPID).
- **Endpoints** :
  - `GET /api/v1/push/vapid-public-key` : clé publique VAPID pour le client.
  - `POST /api/v1/push/subscribe` : enregistrement d’un abonnement (body : endpoint, p256dh, auth).
  - `POST /api/v1/push/send-test` : envoi d’une notification de test à l’utilisateur connecté.
- **Config** : `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`. Les push peuvent être déclenchés depuis les mêmes endroits que les emails (nouvelle commande, expédition, livraison, message).

### 2.7 Abonnements vendeurs

- **Tables** : `subscription_plans`, `vendor_subscriptions`.
- **Endpoints** :
  - `GET /api/v1/subscriptions/plans` : liste des offres (Basic, Pro, Enterprise).
  - `GET /api/v1/subscriptions/my` : abonnement actuel du vendeur (via sa boutique).
  - `POST /api/v1/subscriptions/remind-expiration` : envoi d’un email de rappel d’expiration (à brancher sur un job ou manuellement).
- Le paiement récurrent et la limitation des fonctionnalités par tier (Basic, Pro, Enterprise) peuvent être branchés sur la passerelle Kelpay et des checks dans les routes (ex. création de produits selon `plan.limits`).

### 2.8 Sitemap dynamique

- **Service** : `app/services/sitemap_service.py` — `generate_sitemap_xml(db, base_url)` : URLs pour accueil, catégories, boutiques, produits.
- **Endpoint** : `GET /api/v1/sitemap/xml` : retourne le sitemap XML. Un scheduler hebdomadaire peut appeler cette route (ou une tâche interne) et soumettre le résultat à Google Search Console.

### 2.9 Analytics et rapports

- **Endpoints** :
  - `GET /api/v1/analytics/admin/dashboard?days=30` : CA, nombre de commandes, nouveaux utilisateurs (admin).
  - `GET /api/v1/analytics/seller/reports?days=30` : ventes, nombre de commandes pour la boutique du vendeur.
  - `GET /api/v1/analytics/admin/export/csv?days=30` : export CSV des commandes (admin).

### 2.10 Sécurité et conformité

- **Rate limiting** : `app/core/rate_limit.py` — dépendance `rate_limit_middleware` (en mémoire, par IP, fenêtre et nombre de requêtes configurables). À attacher aux routes sensibles (login, register, webhooks).
- **Validation des uploads** : `app/core/upload.py` — `validate_upload(file, max_size, allowed_mime)` (type MIME et taille max depuis la config).
- **Audit** : table `audit_logs` ; endpoints admin `GET /api/v1/admin/audit-logs`, `POST /api/v1/admin/audit-logs` pour enregistrer les actions critiques.
- **RGPD** : `GET /api/v1/admin/gdpr/export/{user_id}` (export des données utilisateur), `DELETE /api/v1/admin/gdpr/delete/{user_id}` (suppression, réservé admin).

---

## 3. Base de données et migrations

- **Alembic** : répertoire `alembic/`, migration initiale `001_initial.py` qui crée toutes les tables (roles, users, user_roles, shops, categories, products, orders, order_items, payment_transactions, wallets, wallet_transactions, push_subscriptions, subscription_plans, vendor_subscriptions, audit_logs).
- **URL** : fournie par `DATABASE_URL` (format `postgresql+asyncpg://...`). Pour Alembic, l’URL est convertie en `postgresql://` dans `env.py`.

---

## 4. Démarrage et déploiement

1. Créer un venv et installer les dépendances :  
   `pip install -r backend/requirements.txt`
2. Copier `backend/.env.example` en `backend/.env` et renseigner les variables (DB, JWT, SMTP, Kelpay, VAPID, etc.).
3. Exécuter les migrations : depuis `backend/`, `alembic upgrade head`.
4. Lancer l’API : `uvicorn app.main:app --reload --app-dir backend` (ou depuis `backend/` : `uvicorn app.main:app --reload`).
5. Health check : `GET /health`.

---

## 5. Priorités et évolutions possibles

- **P0** : Paiement (Kelpay) et emails transactionnels — en place.
- **P1** : CRON libération fonds et recherche — en place ; amélioration possible avec `ts_vector` + GIN.
- **P2** : Push et factures PDF — en place.
- **P3** : Analytics (dashboard plus riche), sitemap automatique (job + soumission GSC), rappels d’expiration d’abonnements (job).

Évolutions suggérées :

- Utiliser une queue (Celery, Redis) pour les envois d’emails et les push en arrière-plan.
- Déplacer le CRON vers un vrai cron système ou un worker dédié si plusieurs instances.
- Ajouter une migration pour colonne `search_vector` + trigger pour la recherche full-text native PostgreSQL.
- Brancher les limites d’abonnements vendeurs (max_products, etc.) dans les routes de création/édition de produits.

---

*Document généré dans le cadre du développement du backend Zandofy (FastAPI).*
