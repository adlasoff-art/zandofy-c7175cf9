# Zandofy — Roadmap Backend & Architecture de Production

## 🏗️ ARCHITECTURE DE PRODUCTION

### Infrastructure : VPS Hostinger « Tout-en-un »

| Ressource | Valeur (V1) | Upgrade prévu |
|-----------|-------------|---------------|
| vCPU | 4 cœurs | → 8 cœurs |
| RAM | 16 Go | → 32 Go |
| Stockage | 200 Go NVMe | → 400 Go NVMe |
| Bande passante | 16 To/mois | → 32 To/mois |

### Stack technique

```text
VPS Hostinger (4 vCPU / 16GB RAM / 200GB NVMe)
│
├── Docker Compose
│   ├── FastAPI (uvicorn, 4 workers)    → Backend API
│   ├── PostgreSQL 15                   → Base de données
│   ├── Redis 7                         → Cache + Celery broker
│   ├── Celery Worker                   → Tâches async
│   └── Celery Beat                     → CRON scheduler
│
├── Dokploy (CI/CD)
│   └── Webhook GitHub → auto-build & deploy
│
├── Nginx (reverse proxy + frontend)
│   ├── Frontend Vite (dist/) → port 80/443
│   ├── Proxy /api → FastAPI (port 8000)
│   └── SSL Let's Encrypt
│
└── Tâches Celery (planifiées)
    ├── release_vendor_pending_funds  (quotidien)
    ├── expire_inactive_points       (hebdomadaire)
    ├── notify_expiring_points       (hebdomadaire)
    └── pg_dump backup               (quotidien)
```

### Workflow de développement

```text
Lovable (dev frontend) → GitHub (versioning) → Dokploy (auto-deploy)
Cursor (dev backend)   → GitHub (versioning) → Dokploy (auto-deploy)
```

---

## 📋 DOCUMENTS DE RÉFÉRENCE

| Document | Contenu |
|----------|---------|
| `docs/FASTAPI_BACKEND_SPEC.md` | Spécification complète du backend (34+ tables, 100+ endpoints, logique métier) |
| `docs/FASTAPI_ROADMAP.md` | Plan d'implémentation phase par phase (~23 jours) |
| `docs/CURSOR_PROMPT.md` | Prompt prêt à coller dans Cursor pour démarrer |
| `docs/MIGRATION_GUIDE.md` | Guide de déploiement VPS (Nginx, Docker, SSL, CRON) |

---

## ✅ COMPLÉTÉ (Frontend)

| Module | Statut | Détails |
|--------|--------|---------|
| Catégories dynamiques | ✅ | Liens nav, cercles, mega-menu → `/category/:slug` |
| Hero Banner CMS | ✅ | Slides, bannières gauche/droite depuis `cms_banners` |
| Pages catégories + filtres | ✅ | Prix, tailles, couleurs, tri |
| Nouveautés / Soldes | ✅ | Slugs spéciaux avec `newness_duration_days` configurable |
| Sync compteurs boutique | ✅ | Triggers: products_count, followers_count, sales_count, rating |
| Wallet vendeur | ✅ | Crédit automatique à la livraison (trigger) |
| Points de fidélité | ✅ | Parrainage, pending → earned, expiration |
| Avis produits + boutique | ✅ | UI + triggers recalcul rating |
| Système de rôles RBAC | ✅ | 5 rôles, table séparée, RoleGuard |

---

## 🔧 À IMPLÉMENTER (Backend FastAPI)

Voir `docs/FASTAPI_ROADMAP.md` pour le plan détaillé.

### Priorités

1. **P0** : Auth JWT + RBAC
2. **P0** : CRUD Produits, Catégories, Commandes
3. **P0** : Paiement KelPay (Mobile Money)
4. **P0** : Notifications multi-canal (in-app + email)
5. **P1** : Dashboard vendeur + wallet
6. **P1** : Panel admin complet
7. **P1** : Calcul shipping dynamique
8. **P2** : Fidélité, parrainage, tâches CRON
9. **P3** : Migration frontend (Supabase → FastAPI)

---

## 🔑 SECRETS (10 secrets)

| Secret | Usage |
|--------|-------|
| DATABASE_URL | PostgreSQL connection string |
| REDIS_URL | Redis connection string |
| SECRET_KEY | JWT signing key |
| SMTP_HOST | Serveur SMTP |
| SMTP_PORT | Port SMTP |
| SMTP_USER | Utilisateur SMTP |
| SMTP_PASS | Mot de passe SMTP |
| SMTP_FROM_EMAIL | Adresse expéditeur |
| KELPAY_MERCHANT_CODE | Code marchand KelPay |
| KELPAY_TOKEN | Token API KelPay |

---

## 📦 STORAGE (6 dossiers)

| Dossier | Public | Usage |
|---------|--------|-------|
| product-media | ✅ | Images/vidéos produits |
| review-images | ✅ | Images des avis |
| delivery-proofs | ✅ | Preuves de livraison |
| chat-media | ✅ | Fichiers messagerie |
| vendor-documents | ❌ | Documents vendeurs (privé) |
| cms-assets | ✅ | Assets CMS |

---

## 📈 SEUILS D'UPGRADE VPS

| Métrique | Seuil | Action |
|----------|-------|--------|
| RAM > 12 Go | 75% | Upgrade → 32 Go |
| Stockage > 150 Go | 75% | Upgrade → 400 Go |
| CPU > 80% (1h) | Soutenu | Upgrade → 8 vCPU |
| API > 500ms | Moyenne | Investiguer + upgrade |
