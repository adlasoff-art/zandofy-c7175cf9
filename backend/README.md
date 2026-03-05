# Zandofy Backend — FastAPI

Backend de la plateforme Zandofy : auth (profiles + JWT 15min/refresh 7j), schéma spec 34+ tables, paiement KelPay, emails, factures PDF, recherche, push, analytics, RGPD.

## Schéma spec (FASTAPI_BACKEND_SPEC.md)

- **Auth** : table `profiles` + `user_roles` (rôles : admin, manager, vendor, shipper, rider). Pas de rôle dans profiles.
- **Préfixe API** : configurable via `API_PREFIX` (défaut `/api`). Les routes auth spec sont sous `{API_PREFIX}/auth` (register, login, refresh, me, forgot-password, reset-password, verify-email).
- **Migrations** : `002_spec_schema` crée profiles, stores, user_roles, categories, products, orders, order_items, cart_items, payment_transactions. PostgreSQL requis (enum `app_role`).

## Installation

**Important :** Toutes les commandes ci-dessous doivent être exécutées depuis le dossier **`backend`** (pas depuis la racine du projet). Sinon : `alembic` ne trouve pas sa config, et `uvicorn app.main:app` lève "No module named 'app'".

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
python -m pip install -r requirements.txt
cp .env.example .env
# Éditer .env : DATABASE_URL (PostgreSQL), JWT_SECRET_KEY, JWT_REFRESH_EXPIRE_DAYS=7, SMTP_*, KELPAY_*, VAPID_*
alembic upgrade head
uvicorn app.main:app --reload
```

API : http://127.0.0.1:8000  
Docs : http://127.0.0.1:8000/docs

## Variables d'environnement (.env)

Voir `.env.example`. Principales : `DATABASE_URL`, `JWT_SECRET_KEY`, `SMTP_*`, `KELPAY_*`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`.

## Routes principales

| Préfixe | Description |
|--------|-------------|
| `/api/v1/auth` | Login, register |
| `/api/v1/orders` | Mes commandes, détail, mise à jour statut |
| `/api/v1/payments` | Init paiement Kelpay |
| `/api/v1/webhooks/kelpay` | Webhook confirmation paiement |
| `/api/v1/search` | Recherche + suggest |
| `/api/v1/email` | Envoi emails (confirmation, reset, newsletter) |
| `/api/v1/invoices` | Factures PDF |
| `/api/v1/push` | Abonnement push, VAPID key |
| `/api/v1/subscriptions` | Plans et abo vendeur |
| `/api/v1/sitemap/xml` | Sitemap dynamique |
| `/api/v1/analytics` | Dashboard admin, rapports vendeur, export CSV |
| `/api/v1/admin` | Audit logs, RGPD export/delete |
| `/api/v1/zando-points` | Solde, historique, parrainage (ZandoPoints) |
| `/api/v1/uploads` | Images produit, logo boutique (vendeur) |

## Celery (tâches asynchrones)

Pour les emails en arrière-plan et les jobs planifiés (ex. release wallet), lancer le worker :

```bash
cd backend
celery -A app.celery_app worker -l info
```

Variables utiles : `REDIS_URL` (broker/backend, défaut `redis://localhost:6379/0`).

## Tests

Depuis le dossier `backend` (avec l'environnement activé) :

```bash
python -m pip install -r requirements.txt   # si besoin
python -m pytest tests/ -v
```

Si `pip` ou `pytest` ne sont pas reconnus (launcher cassé sous Windows), utiliser `python -m pip` et `python -m pytest`.

Voir **DEV.md** à la racine du projet pour le détail du développement de l’outil.
