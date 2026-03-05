# Zandofy — Prêt pour la production

Document de vérification et **tout ce que vous devez fournir** avant déploiement (GitHub → Coolify).

---

## 1. Ce qui a été fait côté projet (conformité & sécurité)

| Élément | Statut |
|--------|--------|
| **Backend** `.env.example` | Complet avec CORS, JWT, APP_ENV, commentaires prod. |
| **Frontend** `.env.example` | Uniquement variables `VITE_*` ; aucun secret backend. |
| **CORS** | Liste d’origines depuis `CORS_ORIGINS` ; en prod = domaines réels. |
| **JWT** | En prod, refus de démarrage si `JWT_SECRET_KEY` absent ou égal à `change-me-in-production`. |
| **En-têtes de sécurité** | X-Content-Type-Options, X-Frame-Options, CSP (sauf /docs pour Swagger). |
| **Docker** | `Dockerfile` backend + frontend ; `docker-compose.yml` (preview) ; `docker-compose.prod.yml` (prod). |
| **Secrets** | `.env` et `*.env` dans `.gitignore` ; pas de clés committées. |
| **AUDIT-SECURITE.md** | Checklist déploiement alignée avec ce document. |

---

## 2. Ce que vous devez fournir (obligatoire)

Renseigner ces valeurs **dans Coolify** (variables d’environnement du projet) ou dans un fichier `.env` **non committé** pour un déploiement manuel.

### 2.1 Backend — obligatoires en production

| Variable | Description | Exemple (à remplacer) |
|----------|-------------|------------------------|
| `APP_ENV` | Doit être `production` | `production` |
| `JWT_SECRET_KEY` | Clé secrète forte (min. 32 caractères aléatoires) | Générer : `openssl rand -hex 32` |
| `CORS_ORIGINS` | Origines autorisées (frontend), séparées par des virgules | `https://zandofy.com,https://www.zandofy.com` |
| `DATABASE_URL` | Connexion PostgreSQL (async) | `postgresql+asyncpg://user:password@host:5432/dbname` |
| **OU** (si vous utilisez le compose prod avec Postgres intégré) | | |
| `POSTGRES_USER` | Utilisateur PostgreSQL | `zandofy` |
| `POSTGRES_PASSWORD` | Mot de passe PostgreSQL (fort) | À définir |
| `POSTGRES_DB` | Nom de la base | `zandofy` |

### 2.2 Backend — optionnels (selon les fonctionnalités)

| Variable | Description |
|----------|-------------|
| `SUPABASE_JWT_SECRET` | JWT Secret Supabase (Project Settings > API) si le frontend utilise Supabase Auth et que le backend valide ces tokens. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL` | Envoi d’emails transactionnels. |
| `KELPAY_MERCHANT_CODE`, `KELPAY_TOKEN` | Paiements KelPay. |
| `KELPAY_WEBHOOK_SECRET` | Signature des webhooks KelPay (vous avez indiqué le laisser vide pour l’instant). |
| `OPENAI_API_KEY` | Recherche visuelle (GPT-4o). |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Notifications push web. |
| `SITE_BASE_URL` | URL du site (factures, liens de reset mot de passe). Ex. `https://zandofy.com` |

### 2.3 Frontend (build) — obligatoires pour la prod

| Variable | Description | Exemple |
|----------|-------------|---------|
| `VITE_API_URL` | URL publique de l’API backend | `https://api.zandofy.com` ou `https://zandofy.com/api` |
| `VITE_SUPABASE_URL` | URL de votre instance Supabase (cloud ou self-hosted) | `https://xxx.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clé anon/publique Supabase | (depuis le dashboard Supabase) |
| `VITE_SUPABASE_PROJECT_ID` | ID projet Supabase | (depuis le dashboard) |

---

## 3. Vérifications avant déploiement

- [ ] **Repo GitHub** : code à jour, pas de fichier `.env` committé.
- [ ] **Backend** : `JWT_SECRET_KEY` défini et **différent** de `change-me-in-production`.
- [ ] **Backend** : `APP_ENV=production`.
- [ ] **Backend** : `CORS_ORIGINS` = les domaines réels du frontend (séparés par des virgules).
- [ ] **Backend** : `DATABASE_URL` (ou `POSTGRES_*`) pointant vers une base PostgreSQL 15+.
- [ ] **Frontend** : `VITE_API_URL` = URL réelle de l’API en prod.
- [ ] **Migrations** : après premier déploiement backend, exécuter une fois :  
  `cd backend && alembic upgrade head`  
  (ou via script/Coolify si vous l’intégrez).
- [ ] **KelPay webhook** : vous avez choisi de le laisser non finalisé ; `KELPAY_WEBHOOK_SECRET` peut rester vide.

---

## 4. Étapes de déploiement (rappel)

1. **GitHub** : push du monorepo (frontend + backend + `docker-compose.prod.yml`).
2. **Coolify — Sources** : + Add → GitHub → sélectionner le repo Zandofy.
3. **Coolify — Projet** : créer le projet, ajouter la ressource (Docker Compose avec `docker-compose.prod.yml` ou services séparés).
4. **Coolify — Variables** : renseigner toutes les variables listées en §2 (obligatoires + optionnels selon besoin).
5. **Coolify — Déploiement** : lancer le build et le déploiement.
6. **Migrations** : exécuter `alembic upgrade head` sur la base (une fois).
7. **DNS & SSL** : configurer le domaine et Let’s Encrypt dans Coolify pour frontend et API.

---

## 5. Génération de la clé JWT (rappel)

Sous Linux/macOS (ou WSL) :

```bash
openssl rand -hex 32
```

Utiliser la sortie comme valeur de `JWT_SECRET_KEY` (sans la partager ni la committer).

---

*Dernière mise à jour : aligné avec AUDIT-SECURITE.md et checklist production.*
