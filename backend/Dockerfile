# =============================================================================
# Zandofy Backend — Dockerfile (FastAPI + Uvicorn)
# Pour preview et déploiement
# =============================================================================

FROM python:3.11-slim

WORKDIR /app

# Dépendances système éventuelles (WeasyPrint, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpango-1.0-0 libpangocairo-1.0-0 libgdk-pixbuf2.0-0 libffi-dev shared-mime-info \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Répertoire uploads (chat-media, etc.)
RUN mkdir -p uploads/chat-media

EXPOSE 8000

# Variables d'env à passer au run (DATABASE_URL, JWT_SECRET_KEY, etc.)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
