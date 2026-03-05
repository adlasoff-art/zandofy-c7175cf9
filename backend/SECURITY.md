# Sécurité — Backend Zandofy

Bonnes pratiques et points de vigilance pour le déploiement et la maintenance.

---

## 1. Secrets et environnement

- **Ne jamais commiter** `.env` ni clés API/tokens. Utiliser `.env.example` sans valeurs sensibles.
- En production : variables d’environnement injectées par la plateforme (ex. Render, Railway, Docker secrets), pas de fichier `.env` dans l’image.
- `JWT_SECRET_KEY` : fort, aléatoire, propre à chaque environnement.
- `SUPABASE_SERVICE_ROLE_KEY` et `KELPAY_*` : réservés au backend, jamais exposés au frontend.

---

## 2. CORS

- En dev : origines limitées (localhost:3000, 5173) dans `main.py`.
- En production : remplacer par la liste des domaines réels du frontend (ex. `https://zandofy.com`). Ne pas utiliser `allow_origins=["*"]` avec `allow_credentials=True`.

---

## 3. Authentification et autorisation

- Routes protégées : dépendance `get_current_user` ou `require_roles(...)`.
- Token JWT : durée courte (ex. 60 min), renouvellement côté frontend si besoin (refresh flow à ajouter si nécessaire).
- Mots de passe : hachage bcrypt via `passlib`. Ne jamais logger ni renvoyer les mots de passe.

---

## 4. Données et base

- Connexion DB : préférer SSL en production (`?sslmode=require` ou équivalent dans `DATABASE_URL`).
- Migrations : exécuter avec un utilisateur ayant uniquement les droits nécessaires (pas le superuser en prod).
- Données sensibles : pas de log des corps de requête contenant mots de passe ou tokens.

---

## 5. Requêtes et injection

- SQLAlchemy ORM/requêtes paramétrées : utilisés partout (pas de SQL brut concaténé).
- Validation des entrées : Pydantic sur tous les endpoints (body, query, path).

---

## 6. Rate limiting et abus

- Utiliser la dépendance/middleware de rate limiting sur login, register, webhooks (voir `app/core/rate_limit.py`).
- En production : envisager un rate limiting global (ex. reverse proxy ou middleware).

---

## 7. Webhooks (Kelpay, etc.)

- Vérifier systématiquement la signature (HMAC) avec `KELPAY_WEBHOOK_SECRET` avant de traiter le payload.
- Ne pas exposer de logs détaillés du corps des webhooks (peut contenir des infos sensibles).

---

## 8. Audit et conformité

- Table `audit_logs` : enregistrer les actions sensibles (admin, suppression, export RGPD).
- RGPD : endpoints export/suppression des données utilisateur (admin) ; documenter la rétention et le processus dans la politique de confidentialité.

---

## 9. Dépendances

- Mettre à jour régulièrement les paquets (`pip list --outdated`, `pip install -U`).
- Vérifier les CVE (ex. `pip audit` ou outils du CI).

---

## 10. Déploiement

- Servir l’API en HTTPS uniquement en production.
- Headers de sécurité : envisager des en-têtes type HSTS, X-Content-Type-Options (via reverse proxy ou middleware).
- Logs : ne pas logger de tokens ni de données personnelles ; niveau log adapté (INFO en prod, DEBUG uniquement en dev).

Pour les étapes concrètes de déploiement, voir **DEPLOYMENT.md**.
