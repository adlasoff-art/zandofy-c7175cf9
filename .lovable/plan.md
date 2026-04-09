

# Plan de Sécurisation Avancée — Zandofy

## Résumé

Mise en place d'un ensemble de protections de cybersécurité couvrant : le blocage géographique par pays (admin-configurable), la protection anti-bot sur les formulaires, le rate-limiting côté serveur sur les Edge Functions critiques, la correction des failles détectées par l'audit (storage, realtime, XSS), et le durcissement global de la plateforme.

---

## Lot A — Blocage Géographique Configurable (Geo-Blocking)

**Objectif** : L'admin coche des pays dans le panel admin → les visiteurs de ces pays voient "Site inaccessible".

1. **Migration DB** : Créer une entrée `platform_settings` avec clé `geo_blocked_countries` (JSONB : `{ "blocked": ["RU", "CN", "KP", ...] }`).

2. **Interface Admin** : Ajouter un onglet "Pays bloqués" dans les paramètres de sécurité admin, avec la liste complète des pays (checkbox multi-sélection). Sauvegarder dans `platform_settings`.

3. **Hook `useGeoBlocking`** : Au chargement de l'app (dans `App.tsx`), détecter le pays du visiteur via l'API de géolocalisation déjà en place (`useGeoDetection`), comparer avec la liste bloquée, et afficher un écran plein "Ce site n'est pas disponible dans votre région" avec un design minimaliste.

4. **Edge Function `geo-check`** : Pour les appels API critiques (paiement, inscription), vérifier l'en-tête `X-Forwarded-For` / `CF-IPCountry` côté serveur et rejeter avec 403.

---

## Lot B — Protection Anti-Bot & Anti-Spam (Formulaires)

**Objectif** : Protéger tous les formulaires contre les soumissions automatisées.

1. **Cloudflare Turnstile** (gratuit) : Intégrer le widget Turnstile sur les formulaires critiques :
   - Inscription / Connexion
   - Mot de passe oublié
   - Support (guest tickets)
   - Contact / "Me notifier"

2. **Honeypot Fields** : Ajouter un champ caché CSS (`display:none`) sur chaque formulaire. Si rempli → rejet silencieux.

3. **Composant `<FormProtection>`** : Créer un composant wrapper qui combine Turnstile + honeypot, réutilisable partout.

---

## Lot C — Rate Limiting Serveur (Edge Functions)

**Objectif** : Empêcher la saturation des requêtes (anti-DDoS applicatif).

1. **Migration DB** : Créer une table `rate_limit_entries` :
   ```
   id, identifier (IP ou user_id), endpoint, request_count, window_start, created_at
   ```
   Avec index sur `(identifier, endpoint, window_start)`.

2. **Utilitaire `checkRateLimit`** (partagé entre Edge Functions) : Avant chaque traitement, vérifier le nombre de requêtes dans la fenêtre glissante. Limites par endpoint :
   - Auth (login/signup) : 10 req/min
   - Paiement : 5 req/min
   - Recherche : 30 req/min
   - Envoi d'email : 3 req/min
   - Webhooks : 60 req/min

3. **Réponse 429** : Retourner `Too Many Requests` avec header `Retry-After`.

---

## Lot D — Correction des Failles Détectées (Audit)

L'audit de sécurité a identifié **7 problèmes**. Corrections :

### Erreurs critiques (3)

| Faille | Correction |
|--------|------------|
| **Realtime sans RLS** — 15 tables diffusent des données sensibles (paiements, adresses, GPS) à tous les abonnés | Retirer les tables sensibles de la publication realtime OU ajouter des politiques de filtrage par canal |
| **Storage `supplier-images`** — DELETE/UPDATE sans vérification de propriétaire | Ajouter un contrôle de chemin : `(storage.foldername(name))[1]` doit correspondre au supplier de l'utilisateur |
| **Storage `product-media`** — INSERT ouvert à tout utilisateur authentifié | Restreindre l'INSERT au propriétaire du store via `(storage.foldername(name))[1]` |

### Avertissements (4)

| Faille | Correction |
|--------|------------|
| **RLS `USING(true)`** sur opérations d'écriture | Identifier et restreindre les policies permissives |
| **`store_payment_numbers`** lisible publiquement | Restreindre SELECT aux utilisateurs authentifiés en cours de transaction |
| **`delivery-proofs`** bucket public | Rendre privé, restreindre SELECT au client, rider et staff |
| **`chat-media`** bucket public | Rendre privé, restreindre SELECT aux participants de la conversation |

---

## Lot E — Durcissement XSS et Injection

1. **`document.write(html)`** dans `DashboardPage.tsx` (facture PDF) : Remplacer par `Blob + URL.createObjectURL` comme déjà fait ailleurs dans l'audit.

2. **Sanitisation systématique** : Vérifier que tous les `dangerouslySetInnerHTML` utilisent `DOMPurify.sanitize()` (déjà OK pour blog et modération, mais vérifier les cas restants).

3. **Validation d'entrées côté Edge Functions** : Ajouter une validation Zod systématique sur toutes les Edge Functions qui acceptent du JSON (certaines en manquent).

---

## Lot F — Durcissement Auth & Sessions

1. **Rate limiting serveur** des tentatives de connexion : La limitation actuelle est côté client (localStorage, contournable). Ajouter un check serveur dans la table `failed_login_attempts` AVANT le `signInWithPassword`.

2. **Invalidation de session** : Après 3 changements de mot de passe en 24h, forcer la déconnexion de toutes les sessions.

3. **Headers de sécurité** (via `index.html` meta tags puisque pas de serveur custom) :
   - `<meta http-equiv="X-Content-Type-Options" content="nosniff">`
   - CSP minimal via meta tag

---

## Détails techniques

### Fichiers à créer
- `frontend/src/hooks/useGeoBlocking.ts` — Hook de blocage géographique
- `frontend/src/components/security/GeoBlockScreen.tsx` — Écran "Site inaccessible"
- `frontend/src/components/security/FormProtection.tsx` — Turnstile + honeypot wrapper
- `frontend/supabase/functions/geo-check/index.ts` — Vérification géo serveur
- 2-3 migrations SQL (rate_limit_entries, storage policies, realtime cleanup)

### Fichiers à modifier
- `frontend/src/App.tsx` — Intégrer le geo-blocking au niveau racine
- `frontend/src/pages/AuthPage.tsx` — Ajouter Turnstile + honeypot
- `frontend/src/pages/DashboardPage.tsx` — Fix XSS facture (`document.write`)
- `frontend/src/lib/auth-helpers.ts` — Rate limiting serveur
- Edge Functions existantes — Ajouter rate limiting utilitaire
- `frontend/index.html` — Meta tags de sécurité
- Admin settings page — Onglet pays bloqués

### Dépendances
- Clé de site Cloudflare Turnstile (gratuit, à configurer comme secret)

### Ordre d'implémentation recommandé
1. Lot D (corrections audit — failles existantes)
2. Lot E (XSS/injection)
3. Lot F (auth hardening)
4. Lot C (rate limiting serveur)
5. Lot B (anti-bot)
6. Lot A (geo-blocking)

