

# Plan d'Audit et de Solidification — Zandofy (Stack Production)

## Contexte

Préparer la base de code pour une mise en production propre avec deux environnements :
- **Staging** : `studio.zandofy.com` (stack actuelle)
- **Production** : `zandofy.com` (nouveau déploiement Vercel + Supabase dupliqué)

---

## Phase 1 — Corrections critiques (bugs, deprecated, incohérences)

### 1.1 Edge Functions : `getClaims()` deprecated → `getUser()`

**Fichiers** : `send-email/index.ts`, `generate-invoice/index.ts`

Ces deux fonctions utilisent `supabase.auth.getClaims(token)` qui n'existe pas dans le SDK Supabase JS v2. Cela provoque des erreurs silencieuses en production.

**Action** : Remplacer par `supabase.auth.getUser(token)` conformément au pattern déjà utilisé dans `admin-users`, `kelpay-check`, etc.

### 1.2 Edge Functions : `serve()` deprecated → `Deno.serve()`

**Fichiers** : `send-email`, `ai-user-analysis`, `ai-recommendations`, `impersonate-user`, `visual-search`

Ces 5 fonctions utilisent `import { serve } from "https://deno.land/std@0.168.0/http/server.ts"` qui est deprecated depuis Deno 1.35+. Les 11 autres fonctions utilisent déjà correctement `Deno.serve()`.

**Action** : Migrer vers `Deno.serve()` (supprimer l'import `serve`).

### 1.3 Sitemap : URL en dur `zandofy.lovable.app`

**Fichier** : `generate-sitemap/index.ts` (ligne 3)

```typescript
const SITE_URL = "https://zandofy.lovable.app"; // ← FAUX en production
```

**Action** : Lire depuis une variable d'environnement `Deno.env.get("SITE_BASE_URL") || "https://zandofy.com"`. Ajouter le secret `SITE_BASE_URL`.

### 1.4 Sitemap : produits référencés par `id` au lieu de `slug`

Ligne 54 : `/product/${p.id}` alors que le routeur utilise `/product/:slug`. Google indexera des UUIDs au lieu des slugs SEO-friendly.

**Action** : Requêter aussi `slug` et préférer `p.slug || p.id`.

### 1.5 `api-client.ts` : fallback `localStorage.getItem("access_token")`

Ligne 20 : Ce fallback legacy est inutile et potentiellement dangereux (token périmé stocké manuellement).

**Action** : Supprimer le bloc fallback. Le token Supabase via `getSession()` est la seule source fiable.

---

## Phase 2 — Qualité de code (nettoyage `as any`, typage, DRY)

### 2.1 `api.ts` : propriétés hors interface via `(p as any).xxx`

Le `mapProduct()` ajoute 6 propriétés (`storeIsVerified`, `galleryImages`, `promoEndDate`, etc.) par casting `as any` au lieu de les déclarer dans l'interface `Product`.

**Action** : Étendre l'interface `Product` avec les propriétés manquantes (optionnelles). Supprimer tous les `as any` du mapper.

### 2.2 `api.ts` : tables `trend_tags` et `flash_sales` castées `as any`

```typescript
.from("trend_tags" as any)
.from("flash_sales" as any)
```

Cela indique que ces tables ne sont pas dans le fichier `types.ts` auto-généré. Comme ce fichier est auto-généré, on ne peut pas le modifier. Cependant, on peut centraliser un helper typé plutôt que des casts éparpillés.

**Action** : Utiliser `fromTable()` de `supabase-helpers.ts` de manière cohérente au lieu de `as any` directement dans les appels.

### 2.3 `search.ts` : `mapProduct()` dupliqué

Le fichier `search.ts` contient une copie simplifiée de `mapProduct()` d'`api.ts`.

**Action** : Exporter `mapProduct` depuis `api.ts` et le réutiliser dans `search.ts`.

### 2.4 `search.ts` : injection ilike non sanitisée

Ligne 59 : `name.ilike.%${filters.query}%` — si `query` contient `%` ou `_` (wildcards PostgREST), cela casse la recherche.

**Action** : Échapper les caractères spéciaux PostgREST avant interpolation.

---

## Phase 3 — Sécurité

### 3.1 `auth-helpers.ts` : rate-limiting côté client uniquement

Le verrouillage de session via `sessionStorage` est contournable en ouvrant un nouvel onglet ou en vidant le storage. C'est une mesure cosmétique, pas une protection réelle.

**Action** : Documenter la limitation, mais conserver le mécanisme comme couche UX. La protection réelle doit être côté Supabase Auth (qui a un rate-limit natif).

### 3.2 CORS `Access-Control-Allow-Origin: *` dans les Edge Functions

Toutes les Edge Functions utilisent `"Access-Control-Allow-Origin": "*"`. Pour la production, cela devrait être restreint au domaine `zandofy.com`.

**Action** : Lire `SITE_BASE_URL` depuis l'environnement et l'utiliser comme origin autorisé. Garder `*` en fallback pour le dev.

---

## Phase 4 — Portabilité multi-environnement (Staging vs Production)

### 4.1 Variable `VITE_SITE_URL` déjà en place — vérifier sa propagation

Le code utilise `import.meta.env.VITE_SITE_URL || "https://zandofy.com"` dans SEOHead, Index, ReferralDashboard, AdminVendorApplications. C'est correct.

**Action** : S'assurer que la variable est configurée dans Vercel pour chaque environnement :
- Staging : `VITE_SITE_URL=https://studio.zandofy.com`
- Production : `VITE_SITE_URL=https://zandofy.com`

### 4.2 `VITE_API_URL` — Backend FastAPI

Le `api-client.ts` utilise `VITE_API_URL` pour appeler le backend FastAPI. Ce backend n'est pas déployé sur Vercel (comme prévu). Pour la stack Vercel + Supabase.com sans backend FastAPI custom, **ce client est inutilisé sauf si le backend Coolify est actif**.

**Action** : Aucun changement de code, mais documenter que `VITE_API_URL` est optionnel et ne doit être défini que si le backend FastAPI est déployé séparément.

### 4.3 Ajout d'un secret `SITE_BASE_URL` dans Supabase

Pour les Edge Functions (sitemap, CORS dynamique).

**Action** : Ajouter le secret via l'outil `add_secret`.

---

## Phase 5 — Guide de duplication pour la Production

### Étapes pour créer l'environnement Production

1. **Supabase** : Créer un nouveau projet Supabase.com dédié à la production
2. **Migrer le schema** : Exécuter toutes les migrations SQL depuis `frontend/supabase/migrations/` dans le nouveau projet
3. **Secrets** : Configurer tous les secrets (SMTP, Kelpay, VAPID, OpenAI, etc.) dans le nouveau projet
4. **Edge Functions** : Déployer via `supabase functions deploy` pointant vers le nouveau projet
5. **Vercel** :
   - Créer un nouveau déploiement Vercel (ou un nouvel environnement "Production" sur le même projet)
   - Variables d'environnement :
     - `VITE_SUPABASE_URL` → URL du nouveau projet Supabase
     - `VITE_SUPABASE_PUBLISHABLE_KEY` → Anon key du nouveau projet
     - `VITE_SUPABASE_PROJECT_ID` → Ref du nouveau projet
     - `VITE_SITE_URL=https://zandofy.com`
   - Domaine : `zandofy.com`
6. **Staging** (existant) : Mettre à jour `VITE_SITE_URL=https://studio.zandofy.com`

---

## Résumé des fichiers à modifier

| Fichier | Action |
|---|---|
| `frontend/supabase/functions/send-email/index.ts` | `getClaims` → `getUser`, `serve` → `Deno.serve` |
| `frontend/supabase/functions/generate-invoice/index.ts` | `getClaims` → `getUser` |
| `frontend/supabase/functions/ai-user-analysis/index.ts` | `serve` → `Deno.serve` |
| `frontend/supabase/functions/ai-recommendations/index.ts` | `serve` → `Deno.serve` |
| `frontend/supabase/functions/impersonate-user/index.ts` | `serve` → `Deno.serve` |
| `frontend/supabase/functions/visual-search/index.ts` | `serve` → `Deno.serve` |
| `frontend/supabase/functions/generate-sitemap/index.ts` | URL dynamique + slug |
| `frontend/src/services/api-client.ts` | Supprimer fallback localStorage |
| `frontend/src/services/api.ts` | Étendre interface Product, nettoyer `as any`, exporter `mapProduct` |
| `frontend/src/services/search.ts` | Réutiliser `mapProduct`, sanitiser ilike |
| Ajout secret `SITE_BASE_URL` | Via outil secrets |

**Estimation** : ~15 modifications ciblées, aucun changement structurel ni breaking change. Toutes les fonctionnalités existantes restent intactes.

