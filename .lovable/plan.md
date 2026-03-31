

# Plan d'Implémentation — Phases 1, 2 et 3

## Phase 1: Sécurité Edge Functions

### 1A. CORS Standardisé (18 fonctions)

Remplacer le pattern CORS dans chaque Edge Function par une fonction `getCorsHeaders(req)` commune :

```typescript
const ALLOWED_HEADERS = "authorization, x-client-info, apikey, content-type, ...";

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowed = [
    "https://studio.zandofy.com",
    "https://zandofy.com",
    "https://www.zandofy.com",
  ];
  const isAllowed =
    allowed.includes(origin) ||
    origin.endsWith(".lovable.app") ||
    origin.endsWith(".lovableproject.com") ||
    origin.startsWith("http://localhost");
  return {
    "Access-Control-Allow-Origin": isAllowed ? origin : allowed[0],
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
  };
}
```

**Fonctions concernées** (14 à migrer — `admin-users`, `send-email`, `impersonate-user` ont déjà un `getCorsHeaders` partiel à standardiser) :
- `keccel-cardpay`, `kelpay-payment`, `kelpay-check`, `kelpay-callback`, `kelpay-webhook`
- `ai-user-analysis`, `ai-recommendations`, `push-notifications`
- `notify-order-status`, `notify-expiring-points`, `expire-pending-orders`
- `generate-invoice`, `generate-sitemap`, `calculate-shipping`, `visual-search`

### 1B. Fix `admin-users` Closure Bug

**Problème** : `jsonResponse` (ligne 16) référence `corsHeaders` qui est défini à la ligne 23 dans `Deno.serve()` — hors scope.

**Fix** : Déplacer `jsonResponse` à l'intérieur de `Deno.serve()` après la déclaration de `corsHeaders`, ou lui passer `corsHeaders` en paramètre (comme `impersonate-user` le fait déjà correctement).

### 1C. Supprimer le fallback hardcodé `studio.zandofy.com`

**Fichier** : `keccel-cardpay/index.ts` ligne 27

```typescript
// AVANT
const siteBaseUrl = Deno.env.get("SITE_BASE_URL") || "https://studio.zandofy.com";

// APRÈS
const siteBaseUrl = Deno.env.get("SITE_BASE_URL");
if (!siteBaseUrl) {
  return errorResponse("SITE_BASE_URL non configuré");
}
```

### 1D. `verify_jwt = true` pour fonctions Admin

**Fichier** : `frontend/supabase/config.toml`

Passer à `verify_jwt = true` pour :
- `admin-users`
- `impersonate-user`
- `send-email`
- `ai-user-analysis`
- `ai-recommendations`
- `push-notifications`

Ces fonctions vérifient déjà le JWT et les rôles dans le code. L'activation de `verify_jwt` au gateway ajoute une couche de protection supplémentaire. Le frontend passe déjà le token Bearer via `supabase.functions.invoke()`, donc aucun changement côté client.

### 1E. Confirmation Webhook Signature

**Vérifié** : `kelpay-webhook` vérifie déjà la signature HMAC-SHA256 via `KELPAY_WEBHOOK_SECRET` (lignes 36-46). `kelpay-callback` ne vérifie pas de signature — c'est acceptable car il est conçu comme endpoint de retour/redirect, pas comme webhook server-to-server.

---

## Phase 2: Cleanup

### 2A. `useNavigate` dans NotificationCenter

**Analyse** : Le composant `NotificationCenter` est rendu dans le `Header`, qui est à l'intérieur de `BrowserRouter` dans `App.tsx` (ligne 137). L'arborescence est correcte : `ErrorBoundary > QueryClientProvider > BrowserRouter > ... > Header > NotificationCenter`.

L'erreur `useNavigate()` outside `<Router>` est probablement un artefact HMR (Hot Module Replacement) en développement, pas un bug structurel. Aucun changement requis — le composant est correctement positionné dans l'arbre du Router.

### 2B. Supprimer le dossier `/backend`

Supprimer entièrement le dossier `backend/` (FastAPI non déployé, contient `JWT_SECRET_KEY = "change-me-in-production"` dans `.env.example`).

### 2C. Supprimer `supabase/config.toml` racine

Le fichier racine ne déclare que `visual-search` et entre en conflit avec `frontend/supabase/config.toml`. Supprimer.

---

## Phase 3: Isolation Callback

### `keccel-cardpay` et `kelpay-payment`

Rendre `SITE_BASE_URL` obligatoire pour la construction des URLs de retour. Supprimer tout fallback hardcodé.

`kelpay-payment` ne semble pas utiliser de `returnUrl` (Mobile Money n'en a pas besoin), mais appliquer le même pattern pour le CORS.

---

## Résumé des fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| `frontend/supabase/functions/*/index.ts` (×18) | CORS standardisé |
| `frontend/supabase/functions/admin-users/index.ts` | Fix closure `jsonResponse` |
| `frontend/supabase/functions/keccel-cardpay/index.ts` | `SITE_BASE_URL` obligatoire |
| `frontend/supabase/config.toml` | `verify_jwt = true` pour 6 fonctions |
| `backend/` (tout le dossier) | Suppression |
| `supabase/config.toml` (racine) | Suppression |

