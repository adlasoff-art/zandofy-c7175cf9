

# Configuration du secret SITE_BASE_URL

## Action unique

Ajouter le secret `SITE_BASE_URL` avec la valeur `https://studio.zandofy.com` via l'outil `add_secret` de Lovable Cloud.

Ce secret est utilisé par les Edge Functions suivantes :
- **generate-sitemap** : pour générer les URLs correctes dans le sitemap XML
- **Toutes les Edge Functions** : pour le CORS dynamique (restreindre l'origin autorisé)

## Détail technique

Le code référence déjà ce secret :
```typescript
const SITE_URL = (Deno.env.get("SITE_BASE_URL") || "https://zandofy.com").replace(/\/$/, "");
```

Une fois configuré, les Edge Functions utiliseront `https://studio.zandofy.com` au lieu du fallback. Lors du passage en production, il suffira de configurer `SITE_BASE_URL=https://zandofy.com` dans le nouveau projet.

