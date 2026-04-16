

# Diagnostic GSC zandofy.com — Comparatif et plan d'action

## Ce que disent vraiment vos exports

| Date | Indexées | Non indexées | Impressions |
|---|---|---|---|
| 09/04 | — | — | 8 |
| 10/04 | 8 | 22 | 3 |
| 11/04 | 8 | **137** ← saut | 2 |
| 12/04 | 8 | 137 | 3 |
| 13/04 | 8 | 137 | 1 |

Les données s'arrêtent au 13/04. C'est une **latence GSC normale** (3-4 jours). Les chiffres affichés aujourd'hui reflètent l'état du site **avant** vos derniers correctifs.

## Réponse à votre question principale : ancien WordPress ou nouveau projet ?

**Mélange des deux**, voici la décomposition :

### Vient du nouveau projet (Lovable/Vercel) — la majorité
- **114 "Détectées, non indexées"** → ce sont les pages produits/boutiques listées par votre `generate-sitemap` Edge Function. Elles correspondent aux **117 pages découvertes** dans votre sitemap. Google les connaît mais ne les juge pas prioritaires (site neuf, autorité faible).
- **5 "Bloquées par robots.txt"** → vos routes `/dashboard`, `/admin`, `/vendor`, etc. **C'est voulu**, à laisser tel quel.
- **1 "Page en double sans canonical"** → bug réel du nouveau projet (manque de balise `<link rel="canonical">` sur certaines pages).
- **1 "Page avec redirection"** → probablement le 301 du sitemap découvert ci-dessous.

### Vient probablement de l'ancien WordPress
- **5 "404 Introuvables"** → URLs WordPress mortes (`/wp-content/...`, `/?p=123`, articles legacy). À rediriger ou ignorer.
- **4 "Exclue par noindex"** → résidus possibles de pages WordPress encore en cache GSC, ou pages neuves avec noindex involontaire.
- **4 "Indexées malgré blocage robots.txt"** → pages historiques encore connues de Google (anciennes pages WordPress qui ne sont plus servies mais dont l'URL reste).

## Bugs RÉELS confirmés dans le code (à corriger)

### 1. Le sitemap pointe vers le **mauvais projet Supabase**
Dans `frontend/public/robots.txt` ligne 10 :
```
Sitemap: https://uogkklwfvwoxkifpkzpu.supabase.co/...   ← projet LOVABLE CLOUD (preview)
```
Or production utilise le projet `vpttoqojmiqxgudknyxf` (visible dans le 301 retourné par `https://zandofy.com/sitemap-dynamic.xml`). **Le sitemap référencé dans votre robots.txt n'est pas celui de production.** Google suit la redirection 301, donc ça marche, mais c'est fragile et incohérent.

### 2. Le sitemap déclaré dans GSC (`/sitemap-dynamic.xml`) renvoie un **301**
GSC accepte mais c'est sous-optimal. Il faut soit déclarer directement l'URL Supabase finale, soit servir le XML directement sur le domaine.

### 3. Cloudflare est bien actif (réponse `server: cloudflare`)
Contrairement à ce que vous pensiez, **Cloudflare est en frontal** (probablement via Vercel ou DNS). Cela ajoute le bloc "Cloudflare Managed Content" dans votre robots.txt servi (avant vos règles). Pas grave, mais à savoir.

### 4. Canonical manquant sur certaines pages
Confirmé par GSC ("Page en double sans URL canonique"). À auditer dans `SEOHead.tsx` et pages produits/boutiques.

## Côté Google Search Console — ce qu'il faut faire

### À NE PAS faire
- **Ne supprimez pas** la nouvelle propriété.
- **Ne refaites pas** la configuration GSC : votre nouvelle propriété fonctionne (sitemap lu le 16/04, 117 pages découvertes = bon signe).

### À FAIRE manuellement dans GSC
1. **Supprimer définitivement l'ancienne propriété WordPress** (Paramètres → Supprimer la propriété). La "Suppression temporaire" du 10/04 expire au bout de 6 mois, ce n'est pas la bonne action.
2. **Garder uniquement la propriété de domaine** (`zandofy.com`) qui couvre tout (HTTP/HTTPS/www/non-www).
3. **Demander l'indexation manuelle** de 5-10 URLs prioritaires : `/`, `/search`, `/about`, top 5 produits/boutiques (Inspection URL → Demander indexation).
4. **Patienter 7-14 jours** : les "Détectées non indexées" baisseront naturellement avec l'autorité qui se construit.

## Plan de correction code (3 fichiers)

### 1. `frontend/public/robots.txt`
Remplacer la ligne Sitemap par l'URL canonique du domaine :
```
Sitemap: https://zandofy.com/sitemap-dynamic.xml
```

### 2. `frontend/vercel.json` (à vérifier/créer)
Au lieu d'un 301 vers Supabase, faire un **rewrite transparent** pour que `/sitemap-dynamic.xml` serve directement le XML sans redirection :
```json
{ "rewrites": [{ "source": "/sitemap-dynamic.xml", "destination": "https://vpttoqojmiqxgudknyxf.supabase.co/functions/v1/generate-sitemap" }] }
```

### 3. Audit canonical dans `SEOHead.tsx` et pages produits
S'assurer que chaque page produit/boutique passe un `canonical` explicite (déjà partiellement fait, à étendre aux pages qui ne l'ont pas).

## Ce qui n'est PAS à faire
- Ne pas réécrire le sitemap (il fonctionne, 117 pages détectées).
- Ne pas toucher au `noindex` du `index.html` (déjà sur `index, follow`).
- Ne pas paniquer sur les 137 non indexées : c'est l'état normal d'un site neuf de moins de 30 jours sans backlinks.

## Résultat attendu
- Sitemap servi sans 301 = crawl plus efficace
- Cohérence robots.txt ↔ sitemap réel
- Disparition progressive des 5 404 WordPress (à mesure que Google oublie l'ancien site)
- Passage de 8 → 30-50 pages indexées sous 2-3 semaines (sans backlinks externes, ce sera plus lent)

