

# Plan : Correction des problèmes d'indexation Google Search Console

## Problèmes identifiés (depuis la capture)

| Problème | Pages | Cause probable |
|----------|-------|----------------|
| Bloquée par robots.txt | 4 | Le sitemap référence des URLs qui sont aussi dans `Disallow` du robots.txt (contradiction) |
| Page en double sans URL canonique | 1 | Certaines pages n'ont pas de balise `<link rel="canonical">` — le composant `SEOHead` ne l'ajoute que si `canonical` est passé en prop |
| Introuvable (404) | 5 | Probablement des anciennes URLs ou des pages SPA non reconnues par le crawler |
| Exclue par balise noindex | 5 | Pages admin/vendor/dashboard qui ont un meta robots injecté dynamiquement |

## Corrections proposées

### 1. robots.txt — Supprimer la contradiction sitemap/disallow

Le sitemap dynamique (edge function) pourrait inclure des URLs `/admin`, `/vendor`, etc. qui sont bloquées par `robots.txt`. Cela crée une contradiction que Google signale.

**Action** : Vérifier l'edge function `generate-sitemap` pour s'assurer qu'elle n'inclut PAS les chemins bloqués. De plus, le `robots.txt` référence **deux sitemaps** — le statique `/sitemap.xml` n'existe probablement pas (aucun fichier trouvé dans `public/`), ce qui cause une 404.

**Fix robots.txt** :
- Retirer la ligne `Sitemap: https://zandofy.com/sitemap.xml` (fichier inexistant)
- Garder uniquement le sitemap dynamique de l'edge function

### 2. Canonical manquant — Ajouter un fallback automatique

Le composant `SEOHead` n'ajoute la balise canonical que si la prop `canonical` est fournie. Certaines pages (ex: checkout, certaines sous-pages) ne passent pas cette prop.

**Fix `SEOHead.tsx`** : Ajouter un fallback automatique — si `canonical` n'est pas fourni, utiliser `window.location.pathname` comme canonical par défaut. Cela garantit que **toute page** a une URL canonique.

### 3. Pages 404 — Pas d'action code nécessaire

Les 404 sont probablement des URLs mortes indexées avant (anciennes routes supprimées ou URLs mal formées). La SPA routing Lovable gère déjà le fallback vers `index.html`. Ces pages disparaîtront naturellement du rapport GSC une fois que Google les re-crawle.

**Recommandation** : Inspecter les URLs exactes en 404 dans GSC pour vérifier qu'elles ne correspondent pas à des routes valides cassées.

### 4. Pages noindex — Comportement attendu

Les 5 pages exclues par `noindex` sont probablement les routes `/admin`, `/vendor`, `/dashboard`, etc. C'est le comportement voulu — ces pages ne doivent pas être indexées.

**Pas d'action** nécessaire.

---

## Fichiers modifiés

| Fichier | Action |
|---------|--------|
| `frontend/public/robots.txt` | Retirer la ligne du sitemap statique inexistant |
| `frontend/src/components/SEOHead.tsx` | Ajouter un canonical par défaut basé sur `window.location.pathname` quand aucun canonical n'est fourni |

## Risques

- **Aucun risque de régression** : on corrige un fichier statique et on ajoute un fallback non-cassant dans SEOHead
- Le canonical automatique utilise le pathname courant, ce qui est la pratique standard recommandée par Google

