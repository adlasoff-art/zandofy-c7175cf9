# Intégration Backend Zandofy ↔ Frontend Lovable (React + Vite)

Ce document décrit comment faire fonctionner le **backend FastAPI Zandofy** avec le **frontend React + Vite fourni par Lovable**, et comment maintenir/faire évoluer le projet de façon professionnelle.

**Frontend (Lovable) :** https://github.com/adlasoff-art/zandofy — à cloner dans le dossier `frontend/`.

---

## 1. Base URL et CORS

- **Backend** : par défaut `http://127.0.0.1:8000` (dev).
- **Préfixe API** : `/api/v1` → base URL complète : `http://127.0.0.1:8000/api/v1`.
- **CORS** : le backend autorise déjà :
  - `http://localhost:3000`
  - `http://127.0.0.1:3000`
  - `http://localhost:5173`
  - `http://127.0.0.1:5173`

Si Lovable tourne sur un autre port, ajoute-le dans `backend/app/main.py` dans la liste `allowed_origins`.

---

## 2. Contrat API (endpoints à utiliser depuis Lovable)

Une fois le projet Lovable cloné, adapte les appels pour qu’ils ciblent ce backend. Exemples de correspondance courante :

| Usage frontend | Méthode | Endpoint backend | Corps / query |
|----------------|--------|-------------------|--------------|
| Inscription    | POST   | `/api/v1/auth/register` | `{ "email", "password", "full_name?" }` |
| Connexion      | POST   | `/api/v1/auth/login`   | `{ "email", "password" }` |
| Recherche      | POST   | `/api/v1/search/`       | `{ "q", "category_slug?", "min_price?", "max_price?", "sort?", "limit?", "offset?" }` |
| Suggestions    | GET    | `/api/v1/search/suggest?q=...&limit=10` | - |
| Mes commandes  | GET    | `/api/v1/orders/my`    | Header `Authorization: Bearer <token>` |
| Détail commande| GET    | `/api/v1/orders/{id}`   | id path, Bearer |
| Init paiement  | POST   | `/api/v1/payments/init` | `{ "order_id", "payment_method?", "callback_url?" }` + Bearer |
| Facture PDF    | GET    | `/api/v1/invoices/{order_id}/pdf` | Bearer |

Réponses auth : `{ "access_token", "token_type": "bearer" }`.  
Envoie le token dans l’en-tête : `Authorization: Bearer <access_token>` pour les routes protégées.

---

## 3. Configurer le frontend Lovable pour ce backend

Dans le projet Lovable (dossier `frontend/`) :

1. **Variable d’environnement**  
   Crée ou modifie `.env` (ou `.env.local`) :
   ```env
   VITE_API_URL=http://127.0.0.1:8000/api/v1
   ```
   Puis dans le code, utilise `import.meta.env.VITE_API_URL` comme base pour les appels API.

2. **Proxy Vite (recommandé en dev)**  
   Dans `vite.config.ts` :
   ```ts
   export default defineConfig({
     // ...
     server: {
       proxy: {
         '/api': {
           target: 'http://127.0.0.1:8000',
           changeOrigin: true,
         },
       },
     },
   });
   ```
   Ensuite utilise la base URL **relative** : `baseURL = '/api/v1'` (même origine, pas de CORS).

3. **Vérifications après clone Lovable**  
   - Remplacer ou compléter les appels qui pointent vers une autre API (ex. Supabase direct) par des appels vers `VITE_API_URL` ou `/api/v1`.
   - S’assurer que login/register utilisent les réponses `access_token` et stockent le token (localStorage/sessionStorage) et l’envoient en `Authorization: Bearer ...`.

---

## 4. Sécurité et bonnes pratiques

- Ne jamais commiter `.env` / `.env.local` (mettre dans `.gitignore`).
- En production : utiliser une URL backend en HTTPS et la mettre dans `VITE_API_URL` (ou équivalent).
- Côté backend : garder `allow_origins` limité aux domaines réels en prod (pas `*`).
- Voir aussi **backend/SECURITY.md** et **backend/README.md**.

---

## 5. Évolution et maintenance

- **Versioning API** : le backend utilise `/api/v1`. Les changements non rétrocompatibles peuvent aller dans `/api/v2` plus tard.
- **Changements de contrat** : documenter dans ce fichier et dans **backend/CHANGELOG.md**.
- **Déploiement** : voir **backend/DEPLOYMENT.md** (ou section déploiement dans README backend).

---

## 6. Après le clone du repo adlasoff-art/zandofy

Une fois le dépôt cloné dans `frontend/` :

1. Ouvre le projet Zandofy (racine) dans Cursor et demande : *« Analyse le frontend Lovable (dossier frontend/) : repère tous les appels API (Supabase, fetch, axios). Conforme le backend pour que les endpoints et payloads correspondent à ce que le frontend attend. »*
2. Le backend pourra alors être ajusté (chemins, corps de requête/réponse, auth) en fonction du code réel du frontend.
3. Ce document sera mis à jour avec le contrat exact (routes, schémas) une fois l’analyse faite.
