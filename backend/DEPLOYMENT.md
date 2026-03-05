# Déploiement — Backend Zandofy

Guide pour déployer l’API FastAPI en production de manière sécurisée et maintenable.

---

## 1. Prérequis

- Python 3.11+ sur le serveur ou dans l’image Docker.
- Base PostgreSQL (ex. Supabase, Neon, RDS) avec `DATABASE_URL` en `postgresql+asyncpg://...`.
- Variables d’environnement (voir `.env.example`) définies côté plateforme, pas dans le code.

---

## 2. Options de déploiement

### A. Service PaaS (Render, Railway, Fly.io, etc.)

1. Créer un service “Web” / “API” pointant vers le dossier **backend** (ou racine du repo avec `working_directory: backend`).
2. Build : `pip install -r backend/requirements.txt` (ou `pip install -r requirements.txt` si déjà dans backend).
3. Start : `uvicorn app.main:app --host 0.0.0.0 --port $PORT` (certaines plateformes injectent `PORT`).
4. Configurer les variables d’environnement dans le dashboard (DATABASE_URL, JWT_SECRET_KEY, CORS origins, etc.).
5. Migrations : exécuter une fois (job ou commande manuelle) : `alembic upgrade head`.

### B. Docker

Exemple de **Dockerfile** à la racine de `backend/` :

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Build : `docker build -t zandofy-backend ./backend`  
Run : `docker run -p 8000:8000 --env-file .env zandofy-backend`

En production : utiliser un fichier d’env ou un secret manager, pas un `.env` committé.

### C. Serveur dédié (Linux)

1. Cloner le repo, `cd backend`, `python -m venv .venv`, `source .venv/bin/activate`, `pip install -r requirements.txt`.
2. Configurer les variables d’environnement (systemd, fichier env, etc.).
3. Migrations : `alembic upgrade head`.
4. Lancer avec Gunicorn + Uvicorn workers (recommandé) :
   ```bash
   gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
   ```
5. Mettre un reverse proxy (Nginx/Caddy) en HTTPS devant l’app, et limiter les origines CORS aux domaines réels.

---

## 3. CORS en production

Dans `backend/app/main.py`, remplacer `allowed_origins` par la liste des origines du frontend en production, par exemple :

```python
allowed_origins = [
    "https://zandofy.com",
    "https://www.zandofy.com",
]
# Optionnel : ajouter les origines de dev si besoin
if os.getenv("APP_ENV") == "development":
    allowed_origins.extend(["http://localhost:3000", "http://localhost:5173", ...])
```

---

## 4. Migrations

- Toujours faire les migrations dans un environnement de staging avant la prod.
- En CI/CD : une étape peut lancer `alembic upgrade head` avant de déployer la nouvelle version.
- En cas de rollback : prévoir des downgrades Alembic et les tester.

---

## 5. Santé et monitoring

- Endpoint `/health` : utilisé par les load balancers et la surveillance.
- Logs : niveau INFO en prod, rotation des fichiers si besoin.
- Alertes : surveiller les 5xx et le temps de réponse (ex. Sentry, Datadog, ou outils de l’hébergeur).

---

## 6. Versioning et mises à jour

- Taguer les releases (ex. `v1.0.0`) dans le dépôt.
- Documenter les changements dans **CHANGELOG.md**.
- Avant mise à jour : lire les release notes des dépendances, lancer les tests, puis déployer en staging avant prod.

En suivant ce guide et **SECURITY.md**, le backend est prêt pour un déploiement professionnel et une évolution dans le temps avec le frontend Lovable.
