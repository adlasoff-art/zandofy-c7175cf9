# Zandofy

Plateforme e‑commerce (backend FastAPI + frontend Lovable React/Vite).

## Structure

- **backend/** — API FastAPI (auth, commandes, paiement Kelpay, recherche, emails, factures, push, analytics, admin).
- **frontend/** — Projet React + Vite Lovable (cloner : `git clone https://github.com/adlasoff-art/zandofy frontend`).

## Démarrage rapide

### Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
cp .env.example .env     # puis éditer .env
alembic upgrade head
uvicorn app.main:app --reload
```
→ API : http://127.0.0.1:8000 — Docs : http://127.0.0.1:8000/docs

### Frontend (après clone Lovable)
```bash
cd frontend
git clone <URL_LOVABLE> .
npm install
npm run dev
```
→ Configurer l’API : voir **INTEGRATION_LOVABLE.md**.

## Documentation

| Fichier | Description |
|--------|-------------|
| **PRODUCTION-READINESS.md** | Checklist production, **tout ce que vous devez fournir** (clés, variables), étapes déploiement Coolify. |
| **AUDIT-SECURITE.md** | Audit sécurité, conformité, correctifs appliqués. |
| **INTEGRATION_LOVABLE.md** | Connexion frontend Lovable ↔ backend, CORS, contrat API. |
| **backend/README.md** | Installation, variables d’env, routes. |
| **backend/SECURITY.md** | Sécurité, secrets, CORS, audit. |
| **backend/DEPLOYMENT.md** | Déploiement (PaaS, Docker, serveur). |
| **backend/CHANGELOG.md** | Historique des versions API. |
| **DEV.md** | Détail du développement backend (guide initial). |

## Versioning et évolution

- API versionnée sous `/api/v1`. Breaking changes possibles sous `/api/v2` plus tard.
- Modifications documentées dans `backend/CHANGELOG.md`.
- Déploiement et maintenance : **backend/DEPLOYMENT.md** et **backend/SECURITY.md**.
