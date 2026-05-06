
# Correctif : retirer le preconnect staging du HTML public

## Contexte

Dans `frontend/index.html`, j'avais ajouté au lot 1 perf un `preconnect` vers `https://wgidwyrdnboivfphwete.supabase.co` en pensant qu'il s'agissait d'un "CDN images legacy". C'est faux : cette URL est le projet **staging** (`studio-staging.zandofy.com`). Elle n'a aucun rôle public et ne sert jamais d'image sur `zandofy.com`.

Confirmé par l'utilisateur :
- Toutes les images publiques sont sur le projet **prod** `vpttoqojmiqxgudknyxf.supabase.co`.
- C'est ce projet qui est derrière Cloudflare et qui sert le trafic visiteur.

Conséquences du bug actuel :
- Chaque visite de `zandofy.com` ouvre une connexion TCP+TLS inutile vers le projet staging (gaspillage de slot preconnect, le navigateur en limite 4 à 6).
- Mauvais signal d'architecture publique.
- Charge réseau parasite sur le projet staging.

## Changements (1 seul fichier touché côté frontend public)

### 1. `frontend/index.html` — bloc preconnect

**Avant :**
```html
<link rel="preconnect" href="https://vpttoqojmiqxgudknyxf.supabase.co" crossorigin />
<link rel="preconnect" href="https://wgidwyrdnboivfphwete.supabase.co" crossorigin />
<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
```

**Après :**
```html
<!-- Preconnect: prod Supabase only (REST + Storage + Auth + CDN images via Cloudflare) -->
<link rel="preconnect" href="https://vpttoqojmiqxgudknyxf.supabase.co" crossorigin />
<link rel="preconnect" href="https://fonts.googleapis.com" crossorigin />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
```

Le commentaire mensonger "legacy Storage CDN" disparaît également.

## Mise à jour de la mémoire projet

Mettre à jour `mem://architecture/environment-database-separation` pour figer la règle :

> **Règle de preconnect / preload public** : seul `vpttoqojmiqxgudknyxf.supabase.co` (prod) doit apparaître dans `frontend/index.html`. L'URL staging `wgidwyrdnboivfphwete.supabase.co` n'est jamais sollicitée par les visiteurs publics — ne jamais la précharger ni la préconnecter dans le HTML servi par Vercel.

## Ce que je NE touche PAS

- `vite.config.ts`, `OptimizedImage.tsx`, `HeroBanner.tsx`, `usePlatformFont.ts`, `use-analytics.ts`, `BrandLogo.tsx` : optimisations LCP/CLS du tour précédent restent en place.
- `vercel.json` : inchangé.
- Aucune migration DB. Aucun changement RLS. Aucune Edge Function.
- CSP : `connect-src 'self' https://*.supabase.co wss://*.supabase.co …` — déjà permissif (wildcard), pas besoin d'y toucher. L'auth/REST staging continuera de fonctionner depuis `studio-staging.zandofy.com` qui a son propre `index.html` (build avec ses propres `VITE_*`).

## Validation

1. Ouvrir le DevTools Network sur `zandofy.com` après déploiement → vérifier qu'aucune requête `wgidwyrdnboivfphwete` n'apparaît au boot.
2. Relancer PageSpeed mobile → un `preconnect` parasite en moins, marginal mais propre.
3. Smoke staging : `studio-staging.zandofy.com` continue de tourner normalement (son propre build a ses propres URLs).

## Détails techniques

Pas de risque de régression : un `preconnect` est purement informatif pour le navigateur (pré-ouvre un socket). Le retirer ne casse aucune requête réelle — les URLs Supabase utilisées par l'app sont injectées via `VITE_SUPABASE_URL` au runtime, indépendamment des balises HTML.

