

# Audit de Vérification Post-Sécurisation — Failles & Lacunes Restantes

Après inspection complète du code, des politiques RLS, du storage, du realtime et des Edge Functions, voici les problèmes non résolus ou partiellement traités.

---

## Failles Restantes Identifiées

### 1. CRITIQUE — Realtime diffuse des tables sensibles sans filtrage

Les tables suivantes sont toujours dans `supabase_realtime` et exposent des données sensibles à tout abonné authentifié :

- `payment_transactions` (montants, statuts de paiement)
- `customer_locations` (coordonnées GPS des clients)
- `rider_locations` (positions GPS des livreurs)
- `withdrawal_requests` (demandes de retrait financier)

**Action** : Migration pour retirer ces 4 tables de la publication realtime.

---

### 2. CRITIQUE — Storage `product-media` INSERT toujours ouvert

La politique INSERT reste `auth.uid() IS NOT NULL` — n'importe quel utilisateur authentifié peut uploader dans n'importe quel dossier. Le plan prévoyait de restreindre via `storage.foldername(name)[1]` au store du propriétaire.

**Action** : Remplacer la politique INSERT par une vérification de propriété du store via le chemin du fichier.

---

### 3. CRITIQUE — Storage `supplier-images` DELETE/UPDATE sans vérification de propriétaire

Deux politiques dupliquées existent pour DELETE et UPDATE, et aucune ne vérifie la propriété. Tout utilisateur authentifié peut supprimer/modifier les images de n'importe quel fournisseur.

**Action** : Supprimer les doublons et ajouter un contrôle `storage.foldername(name)[1]` lié au supplier de l'utilisateur.

---

### 4. IMPORTANT — Buckets `delivery-proofs` et `chat-media` toujours publics

Le plan prévoyait de les rendre privés. Ils sont encore en `public: true`, ce qui signifie que les URLs sont devinables et accessibles sans authentification.

**Action** : Migration pour passer ces buckets en `public = false` et ajuster les politiques SELECT.

---

### 5. IMPORTANT — Rate limiting non intégré dans les Edge Functions

La table `rate_limit_entries` et la fonction `check_rate_limit()` existent en base, mais **aucune des 20 Edge Functions ne les utilise**. Le rate limiting serveur est donc inactif.

**Action** : Ajouter l'appel `check_rate_limit` (via RPC Supabase) dans les Edge Functions critiques : `kelpay-payment`, `keccel-cardpay`, `send-email`, `admin-users`, `push-notifications`.

---

### 6. IMPORTANT — Rate limiting login reste côté client (localStorage)

`auth-helpers.ts` utilise toujours `localStorage` comme mécanisme principal de rate limiting. Un attaquant peut simplement vider le localStorage pour contourner le verrouillage. Le `fromTable("failed_login_attempts").insert()` est en "fire-and-forget" et n'est jamais vérifié côté serveur AVANT l'authentification.

**Action** : Créer une Edge Function `auth-rate-check` qui vérifie la table `failed_login_attempts` côté serveur avant de permettre `signInWithPassword`.

---

### 7. MOYEN — FormProtection (honeypot) non utilisé sur les formulaires

Le composant `FormProtection` et `HoneypotField` sont créés mais **jamais importés ni utilisés** dans aucun formulaire (AuthPage, contact, support, etc.).

**Action** : Intégrer `HoneypotField` dans AuthPage, les formulaires de support guest, et le formulaire de contact.

---

### 8. MOYEN — Pas de Content-Security-Policy (CSP) dans index.html

Les headers `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` et `Permissions-Policy` sont présents, mais le **CSP** (Content-Security-Policy) est absent. C'est la protection anti-XSS la plus importante côté navigateur.

**Action** : Ajouter un meta tag CSP minimal qui autorise les origines connues (self, supabase, CDN images).

---

### 9. MINEUR — Politique RLS `USING(true)` persistante sur `error_reports` INSERT

La table `error_reports` a une politique INSERT avec `WITH CHECK (true)`. C'est intentionnel (tout le monde doit pouvoir reporter des erreurs), mais cela pourrait être exploité pour remplir la base.

**Action** : Acceptable si un rate-limit est appliqué côté client. Documenter comme "accepté".

---

## Résumé des actions par priorité

| # | Priorité | Action | Type |
|---|----------|--------|------|
| 1 | CRITIQUE | Retirer `payment_transactions`, `customer_locations`, `rider_locations`, `withdrawal_requests` du realtime | Migration SQL |
| 2 | CRITIQUE | Restreindre INSERT `product-media` au propriétaire du store | Migration SQL |
| 3 | CRITIQUE | Fixer DELETE/UPDATE `supplier-images` avec vérification propriétaire | Migration SQL |
| 4 | IMPORTANT | Passer `delivery-proofs` et `chat-media` en buckets privés | Migration SQL |
| 5 | IMPORTANT | Intégrer `check_rate_limit` dans les Edge Functions critiques | Code Edge Functions |
| 6 | IMPORTANT | Rate limiting login côté serveur réel | Edge Function + AuthPage |
| 7 | MOYEN | Intégrer les honeypots dans les formulaires existants | Code frontend |
| 8 | MOYEN | Ajouter CSP meta tag | index.html |
| 9 | MINEUR | Ignorer `error_reports` (intentionnel) | Documentation |

---

## Détails techniques

### Fichiers à modifier
- 1 migration SQL combinée (items 1-4)
- 5 Edge Functions (item 5) : `kelpay-payment`, `keccel-cardpay`, `send-email`, `admin-users`, `push-notifications`
- `frontend/src/pages/AuthPage.tsx` (items 6-7)
- `frontend/src/pages/HelpCenterPage.tsx` ou formulaire support guest (item 7)
- `frontend/index.html` (item 8)

### Ordre d'implémentation
1. Migration SQL (critiques 1-4 en un seul fichier)
2. Edge Functions rate limiting (item 5)
3. Honeypots sur formulaires (item 7)
4. CSP header (item 8)
5. Marquer `error_reports` comme ignoré dans le scan de sécurité (item 9)

