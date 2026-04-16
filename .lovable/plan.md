

# Optimisation PageSpeed zandofy.com — Plan ciblé sans sacrifice qualité

## Contexte du rapport PageSpeed

**Important** : le test a été effectué depuis l'Europe et a déclenché votre **geo-block** ("Ce site n'est pas disponible dans votre région"). Le LCP mesuré est donc le bouclier rouge, pas votre vraie page d'accueil. Les scores réels avec produits seraient différents (probablement plus bas car plus d'images à charger), mais **les diagnostics réseau/JS/fonts ci-dessous restent 100% valides** car ils concernent le bootstrap commun.

### Scores actuels (mobile)
| Métrique | Valeur | Verdict |
|---|---|---|
| Performance | **78** | À améliorer |
| Accessibilité | 90 | Bon |
| Bonnes pratiques | 96 | Excellent |
| SEO | 91 | Bon |
| FCP | 3,4 s | Lent |
| LCP | 4,3 s | Lent |
| TBT | 0 ms | Excellent |
| CLS | 0,012 | Excellent |

## Problèmes confirmés et corrections proposées

### 1. Google Fonts massif (1 168 ms perdus) — IMPACT MAJEUR
**Problème** : vous chargez **6 familles** × **9 graisses chacune** depuis Google Fonts (DM Sans, Inter, Outfit, Plus Jakarta Sans, Poppins, Roboto). Total : ~54 fichiers de polices possibles, 750 ms de blocage initial.

**Correction sans perte visuelle** :
- Identifier dans le code les polices **réellement utilisées** (probablement 1-2 max : Inter pour le body + 1 display).
- Supprimer les 4-5 familles inutilisées du `<link>` Google Fonts.
- Réduire à 3-4 graisses par famille (400, 500, 600, 700 suffisent dans 99% des cas).
- Ajouter `&display=swap` (peut-être déjà présent — à vérifier).
- **Préconnecter** `fonts.gstatic.com` (pas seulement `fonts.googleapis.com`).

**Gain estimé** : -600 à -900 ms sur FCP/LCP. Aucun changement visuel si on garde les bonnes familles.

### 2. JavaScript inutilisé (180 Kio) — IMPACT MAJEUR
**Problème** : `index-CoKm8oQV.js` fait 254 Kio dont 180 Kio jamais exécutés au chargement initial.

**Correction sans casser le site** :
- Vérifier le `vite.config.ts` pour activer/améliorer le **code-splitting manuel** (`manualChunks`) : séparer vendor React, Radix UI, lucide-icons, Supabase.
- **Lazy-load** les pages lourdes via `React.lazy()` + `Suspense` (Dashboard, Admin, Vendor, Checkout, Map, Blog editor) — ces pages ne sont pas nécessaires pour la home.
- Auditer les imports : remplacer `import * from 'lucide-react'` par imports nommés ciblés (déjà probablement le cas avec Vite tree-shaking, à confirmer).

**Gain estimé** : -100 à -150 Kio sur le bundle initial = -800 ms à -1,2 s sur réseau lent.

### 3. CSS inutilisé (20 Kio)
**Problème** : 20 Kio de règles Tailwind jamais utilisées dans le CSS livré.

**Correction** :
- Vérifier que `tailwind.config.ts` a bien `content` qui couvre uniquement `./src/**/*` (pas de paths trop larges).
- Activer le mode `JIT` (par défaut sur Tailwind v3) — à confirmer.

**Gain estimé** : -15 Kio CSS.

### 4. Préconnexions mal calibrées
**Problème** : 
- Vous préconnectez `uogkklwfvwoxkifpkzpu.supabase.co` (projet Lovable preview, **jamais utilisé en prod**).
- Vous préconnectez `images.unsplash.com` (peu utilisé).
- Vous **ne préconnectez pas** `vpttoqojmiqxgudknyxf.supabase.co` (projet prod réel) → Lighthouse signale 320 ms de gain LCP possible.

**Correction** dans `frontend/index.html` :
- Remplacer `uogkklwfvwoxkifpkzpu.supabase.co` par `vpttoqojmiqxgudknyxf.supabase.co`.
- Garder `images.unsplash.com` seulement si encore utilisé (sinon retirer).
- Ajouter préconnexion à `fonts.gstatic.com`.

**Gain estimé** : -300 ms LCP.

### 5. Appel `ipapi.co` bloquant (1 627 ms)
**Problème** : la détection géo via `ipapi.co/json/` est dans le chemin critique et prend 1,6 s. Couplée à la requête `platform_settings?key=geo_blocked_countries`, elle bloque le rendu.

**Correction sans casser le geo-block** :
- Déplacer l'appel `ipapi.co` **après** le premier rendu (différer dans un `useEffect` plutôt qu'au bootstrap).
- Cacher le résultat dans `sessionStorage` pour les navigations suivantes.
- Afficher la home **immédiatement**, puis remplacer par le bouclier si le pays est bloqué (rare cas → meilleur UX pour 99% des visiteurs).
- Alternative : faire la vérif côté Edge Function Supabase (header CF/Vercel `x-vercel-ip-country`) au lieu de `ipapi.co` côté client.

**Gain estimé** : -1 à -1,5 s sur FCP perçu pour les visiteurs autorisés.

### 6. CLS causé par le swap de police (0,012 — déjà bon)
Très faible, mais peut être éliminé en ajoutant `font-display: optional` ou des **size-adjust fallbacks** (`@font-face` avec `size-adjust`, `ascent-override`). Optionnel.

## Ce que je NE vais PAS toucher
- Les images produits (qualité préservée — vous l'avez explicitement demandé).
- Le service worker / cache strategy (déjà optimisé d'après mémoire).
- Le geo-block lui-même (logique métier).
- Le CSP, les headers de sécurité.
- Le design / les couleurs / la typo visible.

## Fichiers concernés

| Fichier | Modification |
|---|---|
| `frontend/index.html` | Réduire Google Fonts à 1-2 familles, fixer préconnexions |
| `frontend/vite.config.ts` | Améliorer `manualChunks` pour code-splitting |
| Pages lourdes (Dashboard, Admin, etc.) | `React.lazy()` dans `App.tsx` ou router |
| Hook/composant geo-block | Différer `ipapi.co` après premier rendu |
| `frontend/tailwind.config.ts` | Vérifier `content` paths |

## Étape préalable nécessaire
Je dois d'abord **lire** : `frontend/src/App.tsx` (routes), `frontend/vite.config.ts`, le composant qui gère le geo-block, et `frontend/tailwind.config.ts` pour identifier précisément les polices utilisées et les routes à lazy-loader.

## Résultat attendu
- Performance : **78 → 90+** sur mobile
- FCP : 3,4 s → ~1,8 s
- LCP : 4,3 s → ~2,5 s
- Bundle JS initial : 254 Kio → ~130 Kio
- **Aucun changement visuel** pour l'utilisateur

