

# Visiteurs par pays et par ville — Analytics Dashboard

## Constat

La table `analytics_events` possède déjà les colonnes `country` et `city` (type text), mais elles ne sont jamais remplies par le hook `use-analytics.ts`. Les widgets n'existent pas non plus dans le dashboard.

## Plan d'implémentation

### 1. Géolocalisation IP côté client

**Fichier** : `frontend/src/hooks/use-analytics.ts`

Au `session_start`, appeler une API de géolocalisation gratuite (ip-api.com, pas de clé requise) une seule fois par session, puis stocker country/city en `sessionStorage` pour les réutiliser dans tous les événements suivants.

```typescript
// Appelé une fois au session_start
async function getGeoData(): Promise<{ country: string; city: string }> {
  const cached = sessionStorage.getItem("z_geo");
  if (cached) return JSON.parse(cached);
  try {
    const res = await fetch("http://ip-api.com/json/?fields=country,city", { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    const geo = { country: data.country || "", city: data.city || "" };
    sessionStorage.setItem("z_geo", JSON.stringify(geo));
    return geo;
  } catch { return { country: "", city: "" }; }
}
```

Injecter `country` et `city` dans chaque `trackEvent` si disponible.

### 2. Deux fonctions SQL (migration)

**`get_analytics_top_countries(p_since)`** : agrège les sessions uniques par `country`, retourne `country` + `session_count`, trié par session_count DESC, LIMIT 50.

**`get_analytics_top_cities(p_since)`** : idem par `city` (inclut `country` pour contexte), LIMIT 50.

### 3. Deux widgets dans le dashboard

**Fichier** : `frontend/src/pages/admin/AdminAnalyticsPage.tsx`

- Ajouter deux queries (`admin-analytics-top-countries` et `admin-analytics-top-cities`) appelant les RPC ci-dessus
- Passer les données à `OverviewTab`
- Ajouter deux `PaginatedWidget` dans la grille existante (à côté des pages/produits/boutiques) :
  - 🌍 **Visiteurs par pays** — drapeau emoji + nom du pays + nombre de sessions
  - 🏙️ **Visiteurs par ville** — nom de la ville (pays) + nombre de sessions

### 4. Fix erreur QueryClient

L'erreur runtime `No QueryClient set` vient probablement d'un import/mount hors du provider — je vérifierai et corrigerai si nécessaire.

## Fichiers concernés

| Action | Fichier |
|--------|---------|
| Modifier | `frontend/src/hooks/use-analytics.ts` — géolocalisation IP |
| Migration | Fonctions SQL `get_analytics_top_countries`, `get_analytics_top_cities` |
| Modifier | `frontend/src/pages/admin/AdminAnalyticsPage.tsx` — queries + widgets |

## Risque

Faible. L'API ip-api.com est appelée une seule fois par session avec timeout 3s et fallback silencieux. Les données existantes (country = NULL) seront simplement ignorées par les widgets jusqu'à ce que de nouvelles sessions remplissent les colonnes.

