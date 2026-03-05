# Audit Sécurité & Qualité — Zandofy

Document de synthèse de l’audit (sécurité, conformité RGPD, qualité, maintenabilité) et des correctifs appliqués.  
**Langue principale : français** ; termes techniques en anglais lorsque pertinent.

---

## 1. Sécurité & Conformité (OWASP, RGPD)

### 1.1 Correctifs appliqués

| Risque | Action |
|--------|--------|
| **En-têtes de sécurité manquants** | Middleware `SecurityHeadersMiddleware` ajouté dans `backend/app/main.py` : `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy`, `Content-Security-Policy` minimal. |
| **JWT secret par défaut en prod** | Au démarrage, si `app_env=production` et `JWT_SECRET_KEY` absent ou égal à `change-me-in-production`, l’application lève une erreur et refuse de démarrer (OWASP A02:2021). |
| **CORS trop permissif** | `allow_methods` et `allow_headers` restreints à une liste explicite (GET, POST, PUT, PATCH, DELETE, OPTIONS ; Authorization, Content-Type, Accept, X-Requested-With). |
| **Webhook KelPay sans signature** | Si `KELPAY_WEBHOOK_SECRET` est défini et que l’en-tête de signature est absent → 403. Signature invalide → 401. |
| **Upload : contournement taille** | `file.size` peut être `None` (streaming). Dans `uploads.py`, lecture par blocs avec vérification de la taille ; au-delà de `max_upload_bytes`, suppression du fichier partiel et 400. |
| **XSS facture (frontend)** | `document.write(html)` remplacé par `resp.blob()` + `URL.createObjectURL(blob)` + `window.open(url)`. Le contenu est ouvert dans une fenêtre séparée sans injection dans la page principale. |
| **Données sensibles frontend** | `DATABASE_URL` retirée de `frontend/.env` (ne doit jamais être exposée au build). Ajout de `frontend/.env.example` sans secrets. |
| **PII dans les logs** | Message SMTP « skipping email to %s » remplacé par « SMTP not configured, skipping transactional email » (RGPD : minimisation des données). |

### 1.2 À faire / recommandations

- **Webhook** : En production, s’assurer que `KELPAY_WEBHOOK_SECRET` est toujours défini.
- **CSP** : Si l’app SPA utilise des scripts inline ou des CDN, adapter `Content-Security-Policy` (nonces ou origines autorisées) pour éviter de casser le frontend.
- **Logs** : Éviter de logger des emails, tokens ou identifiants complets ; en prod, envisager un niveau INFO et des messages génériques pour les échecs d’auth.
- **Consentement RGPD** : S’assurer que les bannières / préférences de consentement et la documentation des traitements sont à jour (hors périmètre code de cet audit).

---

## 2. Qualité du code & Dette technique

### 2.1 Correctifs appliqués

| Élément | Action |
|--------|--------|
| **datetime.utcnow déprécié** | Création de `app/utils/date_utils.py` avec `utc_now()` (timezone-aware). Remplacement dans **tous** les modèles (profile, order, payment, product, store, vendor, wallet, misc, loyalty, notification, conversation, return_dispute, shipping, cms, category, review, push, shop, audit, user, subscription) pour compatibilité Python 3.12+. |
| **Intégrations externes** | **KelPay** : retry (2 tentatives) sur `HTTPStatusError` et `TimeoutException` pour `initiate_payment` ; timeouts déjà en place (30s / 15s). **SMTP** : `timeout=30` ajouté à `aiosmtplib.send()`. |

### 2.2 Recommandations

- **Requêtes DB** : Continuer à utiliser l’ORM (SQLAlchemy) avec paramètres liés ; ne pas construire de SQL brut avec des entrées utilisateur.
- **Recherche** : Les filtres `ilike` dans `search.py` sont paramétrés ; ne pas les remplacer par du `text()` avec interpolation.
- **Tests** : Ajouter des tests d’intégration sur les routes sensibles (auth, webhook, upload) et des tests unitaires sur la validation des entrées.

---

## 3. Standardisation & Lisibilité

### 3.1 Principes

- **Config** : Une seule source de configuration backend : `app.config.settings` (les usages `app.core.config` ont été alignés sur `app.config`).
- **Commentaires** : Privilégier le « pourquoi » (ex. : « En production, refuser de démarrer si JWT secret par défaut ») plutôt que le « comment » évident.
- **Nommage** : Conserver le français pour les messages utilisateur et la documentation ; identifiants techniques en anglais.

### 3.2 Structure

- **Backend** : `app/routers/` (routes), `app/services/` (métier), `app/models/` (ORM), `app/core/` (upload, storage, auth), `app/utils/` (dates, helpers).
- **Frontend** : Pas de modification de structure dans le cadre de cet audit ; s’assurer que les variables d’environnement utilisées sont uniquement celles préfixées `VITE_` et documentées dans `.env.example`.

---

## 4. Intégrations tierces

| Service | Timeout | Retry | Gestion d’erreur |
|--------|--------|-------|-------------------|
| KelPay (initiate) | 30s | 2 retries | Log + relance puis propagation |
| KelPay (check status) | 15s | Non | `raise_for_status` |
| SMTP | 30s | Non | `logger.exception` |
| Supabase (frontend) | 20s timeout + 2 retries (fetchWithRetry) | 2 retries | Helper `frontend/src/lib/api.ts` ; facture PDF utilise retry + toast d'erreur (DashboardPage). |

---

## 5. Résumé des fichiers modifiés

- `backend/app/main.py` — Middleware sécurité, lifespan JWT, CORS.
- `backend/app/routers/webhooks.py` — Rejet 403 si secret attendu et signature absente.
- `backend/app/services/email_service.py` — Timeout SMTP, log sans PII.
- `backend/app/services/kelpay.py` — Retry + timeouts.
- `backend/app/core/upload.py` — Commentaire sur `file.size` optionnel.
- `backend/app/routers/uploads.py` — Contrôle de taille à la lecture (streaming).
- `backend/app/utils/date_utils.py` — Nouveau : `utc_now()`.
- `backend/app/models/profile.py` — Utilisation de `utc_now`.
- `frontend/.env` — Suppression de `DATABASE_URL`.
- `frontend/.env.example` — Ajout (variables VITE_ uniquement).
- `frontend/src/pages/DashboardPage.tsx` — Facture : blob + object URL au lieu de `document.write`.

---

## 6. Checklist déploiement production

- [ ] `JWT_SECRET_KEY` défini et différent du défaut.
- [ ] `APP_ENV=production`.
- [ ] `CORS_ORIGINS` défini avec les origines autorisées.
- [ ] `KELPAY_WEBHOOK_SECRET` défini si webhooks KelPay utilisés (peut rester vide si webhook non finalisé).
- [ ] Aucune variable backend (ex. `DATABASE_URL`) dans le build frontend.
- [ ] Logs sans PII (emails, tokens) ou avec redaction.
- [ ] Migrations Alembic à jour (`alembic upgrade head` après premier déploiement).

**Détail des variables et étapes :** voir **PRODUCTION-READINESS.md** à la racine du projet.
