

# Fix Géo-tracking Analytics — Mixed Content Bloqué

## Problème identifié

**Cause racine confirmée** : `ip-api.com` est appelé en `http://` (ligne 65 de `use-analytics.ts`). Comme zandofy.com est servi en HTTPS, les navigateurs bloquent silencieusement cette requête (mixed content). Résultat : les 301 événements récents ont tous `country = NULL` et `city = NULL`.

Le hook `use-geo-detection.ts` utilise déjà `https://ipapi.co/json/` qui fonctionne en HTTPS gratuitement — il suffit d'aligner `use-analytics.ts` sur la même API.

## Fix

### Fichier : `frontend/src/hooks/use-analytics.ts`

Remplacer l'appel `http://ip-api.com/json/?fields=country,city` par `https://ipapi.co/json/` et adapter le parsing :

```typescript
async function getGeoData(): Promise<{ country: string; city: string }> {
  const cached = sessionStorage.getItem("z_geo");
  if (cached) {
    try { return JSON.parse(cached); } catch { /* ignore */ }
  }
  try {
    const res = await fetch("https://ipapi.co/json/", { signal: AbortSignal.timeout(3000) });
    const data = await res.json();
    const geo = { country: data.country_name || "", city: data.city || "" };
    sessionStorage.setItem("z_geo", JSON.stringify(geo));
    return geo;
  } catch {
    return { country: "", city: "" };
  }
}
```

**Un seul fichier modifié, une seule ligne changée (URL + champ `country_name` au lieu de `country`).** Aucune migration, aucun impact sur les données existantes. Les nouvelles sessions commenceront à remplir `country` et `city` immédiatement.

## Risque

Nul. Changement isolé à la fonction `getGeoData()`. Fallback silencieux en cas d'échec. ipapi.co est déjà utilisé ailleurs dans le projet.

