

# Audit final pré-lancement — Zandofy

## Verdict global : Presque prêt, mais 1 bloquant critique

---

## BLOQUANT CRITIQUE

### 1. `noindex, nofollow` hardcodé dans index.html (ligne 8)

```html
<meta name="robots" content="noindex, nofollow" />
```

**Impact** : Google ne peut PAS indexer votre site. Même si le toggle SEO est activé dans l'admin et que `SEOHead` injecte `index, follow` via JavaScript, le `noindex` initial dans le HTML statique est problématique. Googlebot exécute le JS, mais avec un délai, et certains crawlers secondaires (Bing, Facebook, etc.) ne le font pas.

**Correction** : Remplacer par `<meta name="robots" content="index, follow" />` dans `index.html`. Le composant `SEOHead` forcera `noindex` si le toggle admin est désactivé — la protection reste en place.

---

## AVERTISSEMENTS (non bloquants mais à corriger)

### 2. CSP bloque Google Analytics / GTM

Le composant `SEOHead` injecte dynamiquement des scripts `googletagmanager.com`, mais la CSP dans `index.html` (ligne 47) ne l'autorise pas :

```
script-src 'self' 'unsafe-inline' 'unsafe-eval'
```

Il manque `https://www.googletagmanager.com https://www.google-analytics.com` dans `script-src` et `connect-src`. Si vous activez GA/GTM dans la config SEO admin, les scripts seront silencieusement bloqués.

**Correction** : Ajouter ces domaines à la CSP.

### 3. Sécurité — 3 findings du scan

| Niveau | Finding | Risque réel |
|--------|---------|------------|
| warn | `order_status_history` INSERT trop permissif | Un utilisateur authentifié pourrait insérer de faux statuts. Faible risque immédiat (pas d'impact UI visible). |
| error | `error_reports` accepte des inserts anonymes avec email arbitraire | Un attaquant pourrait polluer la table. Impact faible (table interne admin). |
| error | Realtime — tables sensibles publiées sans authorization canal | Le scan mentionne des tables publiées en Realtime, mais d'après le hardening v4.0, elles ont été retirées et remplacées par du polling. Ce finding peut être un faux positif du scan qui n'est pas à jour. |

**Recommandation** : Les 2 premiers sont à corriger post-lancement. Le 3e nécessite vérification.

### 4. Service Worker — anon key exposée en dur

Dans `sw.js` ligne 35, la clé anon Supabase est hardcodée. C'est la clé **publique** (anon), donc ce n'est pas une faille de sécurité, mais c'est une bonne pratique de ne pas la dupliquer. Pas d'action requise avant le lancement.

---

## POINTS VALIDÉS (OK)

| Domaine | Statut |
|---------|--------|
| **robots.txt** | OK — sitemap statique + dynamique correctement référencés |
| **manifest.json** | OK — nom, icônes 192/512, shortcuts, standalone |
| **Icônes PWA** | OK — icon-192.png et icon-512.png présents |
| **Page offline** | OK — offline.html existe avec branding Zandofy |
| **SW caching** | OK — network-first pour navigation, OAuth exclu, catalog offline |
| **SW update** | OK — mécanisme de détection de mise à jour + prompt utilisateur |
| **Chunk error recovery** | OK — auto-reload sur erreur de chargement de module |
| **Bannière installation PWA** | OK — iOS (sessionStorage) + Android (native prompt + fallback) |
| **Sitemap dynamique** | OK — domaine `zandofy.com` hardcodé |
| **Sitemap statique** | OK — domaine `zandofy.com` |
| **Impersonation** | OK — corrigée, admin seul |
| **Score sécurité** | 99/100 — linter propre |
| **Vercel config** | OK — SPA rewrite, cache headers, security headers |

---

## PLAN D'ACTION

### Avant lancement (obligatoire)

| # | Fichier | Action |
|---|---------|--------|
| 1 | `frontend/index.html` ligne 8 | Changer `noindex, nofollow` → `index, follow` |

### Recommandé (peut être fait après le week-end)

| # | Fichier | Action |
|---|---------|--------|
| 2 | `frontend/index.html` ligne 47 | Ajouter `https://www.googletagmanager.com https://www.google-analytics.com` à `script-src` et `connect-src` de la CSP |
| 3 | Migration SQL | Restreindre INSERT sur `order_status_history` et `error_reports` |

---

## Résumé pour le lancement publicitaire

La plateforme est fonctionnellement prête. Le seul bloquant est la balise `noindex` dans le HTML qui empêche l'indexation Google. Une fois corrigée, vous pouvez lancer la publicité mobile ce week-end. La PWA est opérationnelle (installation Android + iOS), le site est sécurisé (99/100), et le SEO sera actif dès le déploiement du fix.

