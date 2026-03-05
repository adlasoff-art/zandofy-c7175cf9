# =============================================================================
# Zandofy — Dockerfile Multi-Stage
# Stage 1 : Build de l'application Vite/React
# Stage 2 : Servir les fichiers statiques via Nginx
# =============================================================================

# --- Stage 1 : Build ---
FROM node:20-alpine AS builder

WORKDIR /app

# Copier les fichiers de dépendances d'abord (cache Docker)
COPY package.json package-lock.json* bun.lock* ./

# Installer les dépendances
RUN npm install

# Copier le reste du code source
COPY . .

# Variables d'environnement pour le build Vite
# Passer via --build-arg lors du docker build (preview: backend accessible depuis le navigateur)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ARG VITE_API_URL=http://localhost:8000

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID
ENV VITE_API_URL=$VITE_API_URL

# Build de production
RUN npm run build

# --- Stage 2 : Nginx ---
FROM nginx:1.27-alpine AS production

# Supprimer la config par défaut
RUN rm /etc/nginx/conf.d/default.conf

# Copier la config Nginx optimisée
COPY nginx.conf /etc/nginx/conf.d/zandofy.conf

# Copier les fichiers buildés depuis le stage 1
COPY --from=builder /app/dist /usr/share/nginx/html

# Exposer le port 80
EXPOSE 80

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
