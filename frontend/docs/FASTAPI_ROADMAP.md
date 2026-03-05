# Zandofy — Roadmap FastAPI Backend

## Vue d'ensemble

Migration du backend Supabase vers FastAPI pour un contrôle total, hébergé sur VPS Hostinger avec Dokploy.

---

## Phase 1 — Fondations (Jours 1-3)

| Tâche | Priorité | Détails |
|-------|----------|---------|
| Setup projet Python | P0 | `backend/` avec FastAPI, SQLAlchemy 2.0, Alembic |
| Modèles SQLAlchemy | P0 | 34+ tables depuis `FASTAPI_BACKEND_SPEC.md` |
| Migration initiale | P0 | Alembic init + première migration |
| Auth JWT | P0 | Register, login, refresh, password reset, email verification |
| RBAC middleware | P0 | Vérification rôles via `user_roles` table |
| CORS + config | P0 | Pydantic BaseSettings, .env |
| Dockerfile backend | P1 | Python 3.11 + uvicorn |
| docker-compose.yml | P1 | PostgreSQL + Redis + FastAPI |

**Livrable** : Backend qui démarre, auth fonctionnelle, DB créée.

---

## Phase 2 — Core E-commerce (Jours 4-7)

| Tâche | Priorité | Détails |
|-------|----------|---------|
| CRUD Produits | P0 | Liste, détail, filtres, tri, pagination |
| CRUD Catégories | P0 | Arbre parent/enfant |
| Recherche full-text | P1 | tsvector + GIN index sur products |
| Panier | P0 | CRUD cart_items |
| Commandes | P0 | Création, listing, détail, historique statuts |
| Calcul shipping | P0 | Haversine + zones + routes + defaults |
| Avis produits | P1 | CRUD + calcul rating auto |
| Adresses sauvegardées | P1 | CRUD saved_addresses |

**Livrable** : Catalogue navigable, commandes créables.

---

## Phase 3 — Paiements & Notifications (Jours 8-10)

| Tâche | Priorité | Détails |
|-------|----------|---------|
| KelPay integration | P0 | Initiate, callback, check transaction |
| Notifications in-app | P0 | CRUD + triggers automatiques |
| Emails SMTP | P0 | smtplib/aiosmtplib, templates HTML |
| WebSockets | P1 | Notifications realtime, messages, rider GPS |
| Factures HTML | P2 | Génération facture commande |

**Livrable** : Paiements fonctionnels, notifications multi-canal.

---

## Phase 4 — Vendeurs (Jours 11-13)

| Tâche | Priorité | Détails |
|-------|----------|---------|
| Dashboard vendeur | P0 | Stats, produits, commandes |
| Wallet vendeur | P0 | Crédit auto, pending → available, retraits |
| Gestion produits vendeur | P0 | CRUD complet avec images |
| Coupons vendeur | P1 | Création, analytics |
| Abonnements vendeur | P1 | Tiers avec limites produits |
| Messagerie | P1 | Conversations vendeur-client |

**Livrable** : Vendeurs autonomes sur la plateforme.

---

## Phase 5 — Admin (Jours 14-16)

| Tâche | Priorité | Détails |
|-------|----------|---------|
| Dashboard admin | P0 | Stats globales (revenus, users, commandes) |
| Gestion utilisateurs | P0 | Ban/unban, rôles, reset password |
| CMS complet | P0 | Bannières, pages, popups, menu, sections homepage |
| Gestion commandes | P0 | Liste, changement statut forcé |
| Retours & litiges | P1 | Gestion admin |
| Vendor applications | P1 | Approbation/rejet |
| Shipping admin | P1 | Zones, routes, defaults, villes |
| Coupons admin | P1 | CRUD global |
| Audit logs | P2 | Traçabilité actions admin |

**Livrable** : Panel admin complet.

---

## Phase 6 — Fidélité & Ops (Jours 17-19)

| Tâche | Priorité | Détails |
|-------|----------|---------|
| ZandoPoints | P1 | Parrainage, pending/earned/expired |
| Customer tiers | P1 | Bronze → Diamond |
| Celery tasks | P1 | release_vendor_funds, expire_points, backup |
| Upload fichiers | P1 | Images produits, preuves livraison |
| Sitemap dynamique | P2 | Génération XML |
| Exchange rates | P2 | CRUD |
| Rider/Shipper endpoints | P2 | Livraisons, expéditions, GPS |

**Livrable** : Plateforme complète.

---

## Phase 7 — Migration Frontend (Jours 20-22)

| Tâche | Priorité | Détails |
|-------|----------|---------|
| Créer `src/services/fastapi-client.ts` | P0 | Client HTTP avec intercepteur JWT |
| Remplacer `supabase` imports | P0 | Dans tous les fichiers `src/` |
| Adapter `AuthContext.tsx` | P0 | JWT au lieu de Supabase Auth |
| Adapter les hooks | P0 | use-roles, use-vendor-subscription, etc. |
| Tester tous les flux | P0 | Inscription → achat → livraison |

**Livrable** : Frontend connecté au backend FastAPI.

---

## Phase 8 — Déploiement (Jour 23)

| Tâche | Priorité | Détails |
|-------|----------|---------|
| Push sur GitHub | P0 | Backend + frontend modifié |
| Dokploy setup | P0 | Auto-deploy depuis GitHub |
| docker-compose production | P0 | PostgreSQL + Redis + FastAPI + Nginx |
| SSL Let's Encrypt | P0 | HTTPS |
| DNS zandofy.com | P0 | A record vers VPS |
| CRON Celery | P1 | Configurer les tâches planifiées |
| Monitoring | P2 | Logs, uptime, alertes |

**Livrable** : Production live.

---

## Estimation totale : ~23 jours de travail

### Stack finale

```
VPS Hostinger (4 vCPU / 16GB RAM)
├── Docker Compose
│   ├── FastAPI (uvicorn, 4 workers)
│   ├── PostgreSQL 15
│   ├── Redis 7
│   ├── Celery Worker
│   └── Celery Beat (scheduler)
├── Nginx
│   ├── Frontend React (dist/)
│   ├── Proxy /api → FastAPI
│   └── SSL Let's Encrypt
└── Dokploy (CI/CD)
```
