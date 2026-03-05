# Changelog — Zandofy Backend

Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).  
Le projet suit [Semantic Versioning](https://semver.org/lang/fr/) pour les versions de l’API (ex. v1.0.0).

---

## [1.0.0] — 2025-03

### Ajouté
- API FastAPI sous `/api/v1` : auth (login, register), commandes, paiements Kelpay, webhooks, recherche (POST /search/, GET /search/suggest), emails, factures PDF, push, abonnements vendeurs, sitemap, analytics, admin (audit, RGPD).
- CORS configuré pour localhost (3000, 5173).
- Modèles SQLAlchemy (users, roles, orders, payments, products, categories, shops, wallets, push, subscriptions, audit).
- Alembic : migration initiale.
- CRON (APScheduler) : libération des fonds vendeurs quotidienne.
- Documentation : README, DEV.md, .env.example.

### Sécurité
- JWT + RBAC (rôles admin, seller, buyer, support, moderator).
- Rate limiting et validation des uploads (voir SECURITY.md).

---

## À venir (non daté)
- Alignement fin des payloads/réponses avec le frontend Lovable après réception du clone.
- Optionnel : `/api/v2` en cas de breaking changes.
