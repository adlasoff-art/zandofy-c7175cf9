

# Audit Complet & Plan de Passage en Production — Zandofy

---

## PARTIE 1 : DIAGNOSTIC (Problèmes identifiés)

### A. Failles de Sécurité (Critiques)

| # | Problème | Sévérité |
|---|----------|----------|
| S1 | **Push subscriptions lisibles publiquement** — La table `push_subscriptions` a une policy RLS `USING (true)` sur SELECT pour le rôle public. Les credentials Web Push (endpoint, p256dh, auth) de TOUS les utilisateurs sont exposés à n'importe qui sans authentification. | CRITIQUE |
| S2 | **Produits brouillon visibles publiquement** — La policy `Public read products` utilise `USING (true)` sans filtre `publish_status = 'published'`. Les 27 produits actuels sont tous en "draft" et donc exposés. | ÉLEVÉ |
| S3 | **Abonnements vendeurs lisibles publiquement** — `vendor_subscriptions` expose tier, payment_method, paid_until à tous. | MOYEN |
| S4 | **Platform settings lisibles publiquement** — Toute la table `platform_settings` est lisible sans restriction. Si des clés sensibles y sont stockées, elles sont exposées. | MOYEN |
| S5 | **XSS via `dangerouslySetInnerHTML`** — Le contenu des blog posts et descriptions produits est injecté sans sanitisation (pas de DOMPurify). Un vendeur malveillant peut injecter du JavaScript. | ÉLEVÉ |
| S6 | **Pas d'ErrorBoundary** — Aucun ErrorBoundary React n'est implémenté. Une erreur JS dans n'importe quel composant = écran blanc complet (le bug signalé). | ÉLEVÉ |

### B. Bugs de Stabilité

| # | Problème | Impact |
|---|----------|--------|
| B1 | **Écran blanc au chargement** — Absence d'ErrorBoundary + Service Worker stale-while-revalidate qui sert un ancien `index.html` en cache. Si le JS bundle a changé, le HTML cache pointe vers des assets inexistants → écran blanc. | Fréquent |
| B2 | **2 transactions KelPay bloquées en "failed"** — Les transactions avec `transactionstatus: Sent` marquées comme "failed" (bug corrigé dans le dernier message, migration SQL non encore exécutée). | Mineur |
| B3 | **Service Worker trop agressif** — La stratégie `stale-while-revalidate` pour la navigation sert l'ancien shell sans forcer le rechargement après déploiement. Les utilisateurs voient des versions périmées. | Fréquent |

### C. URLs en dur (Lovable → Production)

| # | Fichier | Problème |
|---|---------|----------|
| U1 | `SEOHead.tsx` | `SITE_URL = "https://zandofy.lovable.app"` en dur |
| U2 | `Index.tsx` | JSON-LD avec `zandofy.lovable.app` |
| U3 | `ReferralDashboard.tsx` | Liens WhatsApp/SMS avec `zandofy.lovable.app` |
| U4 | `AdminVendorApplicationsPage.tsx` | Emails avec `zandofy.lovable.app` |

### D. Qualité du Code

| # | Problème | Étendue |
|---|----------|---------|
| D1 | **951 occurrences de `as any`** dans 71 fichiers — contournement du typage TypeScript, masque des bugs potentiels | Large |
| D2 | **`console.log` résiduel** dans `PrecisionShippingEstimate.tsx` | Mineur |
| D3 | **QueryClient sans `staleTime` global** — retry à 1 seulement, pas de staleTime par défaut → re-fetch excessifs | Performance |

### E. Performance & PWA

| # | Problème |
|---|----------|
| P1 | Le SW cache les réponses API Supabase indistinctement — les mutations POST sont ignorées mais les GET d'API avec token JWT sont cachés, pouvant servir des données périmées |
| P2 | Pas de versioning automatique du SW — le bump de `CACHE_NAME` est manuel (`zandofy-v6`) |

---

## PARTIE 2 : PLAN D'ACTION (Priorité production)

### Phase 1 — Sécurité (Bloquant pour la prod)

1. **Corriger les policies RLS** (migration SQL) :
   - `push_subscriptions` : supprimer la policy publique SELECT, la remplacer par `auth.uid() = user_id`
   - `products` : ajouter `AND publish_status = 'published'` à la policy publique
   - `vendor_subscriptions` : restreindre SELECT aux colonnes non sensibles ou exiger authentification
   - `platform_settings` : ajouter un filtre par whitelist de clés publiques (ex: `key IN ('footer_config', 'maintenance_mode', 'seo_settings', ...)`)

2. **Ajouter DOMPurify** pour sanitiser le HTML avant `dangerouslySetInnerHTML` dans :
   - `BlogPostPage.tsx` (contenu blog)
   - `ProductModerationDetail.tsx` (description produit)

3. **Exécuter la migration SQL KelPay** pour corriger les 2 transactions bloquées.

### Phase 2 — Stabilité (Écran blanc)

4. **Ajouter un ErrorBoundary global** englobant `<Suspense>` dans `App.tsx` — affiche un message d'erreur convivial au lieu d'un écran blanc.

5. **Améliorer le Service Worker** :
   - Ajouter un mécanisme de détection de nouvelle version (comparer le hash du bundle)
   - Afficher un bandeau "Nouvelle version disponible — Recharger" au lieu de servir silencieusement un cache périmé
   - Option : passer en stratégie **network-first** pour la navigation, cache-first uniquement pour les assets statiques

### Phase 3 — Production-Ready (URLs & Config)

6. **Remplacer toutes les URLs `zandofy.lovable.app` par une variable d'environnement** `VITE_SITE_URL` :
   - `SEOHead.tsx`, `Index.tsx`, `ReferralDashboard.tsx`, `AdminVendorApplicationsPage.tsx`
   - Configurer `VITE_SITE_URL=https://zandofy.com` sur Vercel

7. **Configurer le QueryClient** avec un `staleTime` global de 30s pour réduire les re-fetch inutiles.

### Phase 4 — Qualité & Nettoyage

8. **Supprimer les `console.log`** restants.

9. **Documenter la stratégie `as any`** — flaggé comme dette technique, pas bloquant pour la prod mais à résoudre progressivement (lié au typage auto-généré Supabase).

### Phase 5 — Déploiement Staging → Production

10. **Workflow de déploiement** :

```text
GitHub (main) → Vercel (frontend)
                 ↓
              zandofy.com
                 ↓
Supabase.com (backend: DB + Auth + Edge Functions + Storage)
```

**Étapes concrètes** :
1. Appliquer toutes les corrections (Phases 1-4)
2. Configurer sur Vercel les variables d'environnement de production :
   - `VITE_SUPABASE_URL` = URL du projet Supabase prod
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = clé anon prod
   - `VITE_SUPABASE_PROJECT_ID` = ID projet prod
   - `VITE_SITE_URL` = `https://zandofy.com`
3. Déployer les 12 Edge Functions sur Supabase prod
4. Configurer le domaine `zandofy.com` sur Vercel (DNS A record)
5. Vérifier le SSL automatique
6. Tester manuellement les flux critiques : inscription, connexion, ajout panier, paiement Mobile Money, suivi commande

---

## Résumé des priorités

| Priorité | Action | Effort |
|----------|--------|--------|
| 🔴 P0 | Fix RLS push_subscriptions + products | 1 migration SQL |
| 🔴 P0 | Ajouter DOMPurify (XSS) | 2 fichiers |
| 🟠 P1 | ErrorBoundary global | 1 composant |
| 🟠 P1 | Fix Service Worker (écran blanc) | 1 fichier |
| 🟡 P2 | Remplacer URLs en dur | 4 fichiers + 1 env var |
| 🟡 P2 | Fix RLS platform_settings + vendor_subscriptions | 1 migration |
| 🟢 P3 | QueryClient staleTime + cleanup console.log | 2 fichiers |

Souhaitez-vous que je commence l'implémentation par les corrections P0 (sécurité critique) ?

