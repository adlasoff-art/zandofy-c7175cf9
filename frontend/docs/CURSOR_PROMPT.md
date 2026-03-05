# Prompt Cursor — Backend FastAPI Zandofy

> Copie-colle ce prompt directement dans Cursor pour démarrer l'implémentation.

---

## PROMPT À COLLER DANS CURSOR

```
Tu es un développeur Python/FastAPI senior. Tu vas construire le backend complet pour Zandofy, une marketplace e-commerce multi-vendeurs.

## ÉTAPE 1 : Comprendre le projet

Commence par lire attentivement ces fichiers dans le repository GitHub :

1. `docs/FASTAPI_BACKEND_SPEC.md` — C'est le fichier LE PLUS IMPORTANT. Il contient :
   - Le schéma complet de la base de données (34+ tables)
   - Tous les endpoints API requis (auth, produits, commandes, paiements, vendeurs, admin, etc.)
   - La logique métier (triggers transformés en services Python)
   - Les tâches CRON
   - La structure de projet recommandée

2. `docs/FASTAPI_ROADMAP.md` — Le plan d'implémentation phase par phase

3. `docs/BACKEND_ROADMAP.md` — L'architecture de production et le workflow de déploiement

4. `src/services/api.ts` — Comment le frontend appelle actuellement le backend (Supabase). Tu dois reproduire ces endpoints.

5. `src/contexts/AuthContext.tsx` — Le flux d'authentification actuel

6. `src/integrations/supabase/types.ts` — Les types TypeScript qui reflètent le schéma exact de la DB

7. `supabase/functions/` — Les 11 Edge Functions existantes qui doivent devenir des endpoints FastAPI :
   - `kelpay-payment/` → POST /api/payments/initiate
   - `kelpay-callback/` → POST /api/payments/callback
   - `kelpay-check/` → POST /api/payments/check
   - `send-email/` → POST /api/emails/send
   - `generate-invoice/` → POST /api/invoices/generate
   - `admin-users/` → /api/admin/users/*
   - `calculate-shipping/` → POST /api/shipping/calculate
   - `notify-order-status/` → Service interne
   - `push-notifications/` → /api/admin/notifications/push
   - `generate-sitemap/` → GET /api/sitemap.xml
   - `notify-expiring-points/` → Tâche Celery

## ÉTAPE 2 : Créer le projet

Crée un dossier `backend/` à la racine du repo avec cette structure :

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── models/
│   ├── schemas/
│   ├── routers/
│   ├── services/
│   ├── middleware/
│   ├── tasks/
│   └── utils/
├── alembic/
├── alembic.ini
├── requirements.txt
├── Dockerfile
└── docker-compose.yml
```

## ÉTAPE 3 : Implémenter par phases

### Phase 1 — Fondations
- SQLAlchemy models pour TOUTES les tables
- Alembic setup + migration initiale
- Auth (register, login, JWT, refresh, password reset)
- RBAC middleware (vérification des rôles via user_roles)
- CORS configuré pour le frontend

### Phase 2 — Core E-commerce
- CRUD Produits (avec images, couleurs, tailles, pricing tiers)
- Catégories (arbre parent/enfant)
- Recherche full-text PostgreSQL
- Panier (CRUD cart_items)
- Commandes (création, historique statuts)
- Calcul shipping (logique haversine + zones + routes)

### Phase 3 — Paiements & Notifications
- KelPay Mobile Money (initiate, callback webhook, check)
- Service de notifications (in-app + email SMTP)
- Emails transactionnels (confirmation commande, expédition, livraison)
- WebSockets pour notifications realtime

### Phase 4 — Vendeurs
- Dashboard vendeur (stats, produits, commandes)
- Wallet vendeur (crédit auto à la livraison, retraits)
- Abonnements vendeur (tiers: beginner/pro/premium/enterprise)
- Coupons vendeur

### Phase 5 — Admin
- Dashboard admin (stats globales)
- Gestion utilisateurs (ban, rôles, reset password)
- CMS (bannières, pages, popups, menu)
- Gestion commandes, retours, litiges
- Configuration shipping (zones, routes, defaults)
- Audit logs

### Phase 6 — Fidélité & Extras
- ZandoPoints (parrainage, pending/earned/expired)
- Customer tiers
- Tâches Celery (release funds, expire points, backup)
- Upload fichiers (images produits, preuves livraison)
- Sitemap dynamique
- Factures HTML/PDF

## CONTRAINTES TECHNIQUES

- Python 3.11+, FastAPI, SQLAlchemy 2.0 (async), Alembic
- PostgreSQL 15 (pas MySQL, pas SQLite en prod)
- Redis pour cache + Celery broker
- JWT auth (access 15min + refresh 7j)
- Pydantic v2 pour validation
- CORS strict (whitelist des origins)
- Pagination sur TOUTES les listes
- Gestion d'erreurs uniforme (HTTPException avec codes)
- Logging structuré
- Tests unitaires (pytest + httpx)

## IMPORTANT

- Ne PAS modifier le frontend React. Tu construis UNIQUEMENT le backend.
- Le frontend sera modifié plus tard pour pointer vers l'API FastAPI au lieu de Supabase.
- Respecte EXACTEMENT le schéma de la DB décrit dans FASTAPI_BACKEND_SPEC.md
- Les rôles sont dans une table séparée `user_roles`, JAMAIS dans profiles
- La commission plateforme est de 10% sur chaque vente
- KelPay est la passerelle de paiement (Mobile Money RDC)
```

---

## COMMENT UTILISER CE PROMPT

1. Ouvre Cursor
2. Connecte-le au repo GitHub de Zandofy
3. Colle le prompt ci-dessus dans le chat Cursor
4. Cursor lira les fichiers référencés et commencera l'implémentation
5. Procède phase par phase en validant chaque étape
