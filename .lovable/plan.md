

# Correction du bouton "Installer" PWA + Preservation du tracking

## Contexte analytique verifie

Le systeme de tracking PWA fonctionne en 2 couches :
1. **`trackPWAInstall()`** — ecrit dans `analytics_events` (event_type = "pwa_install") ET dans `pwa_installs` (upsert par device_id)
2. **`trackPWAPresence()`** — met a jour `last_seen_at` dans `pwa_installs` a chaque session PWA

La page Admin Analytics lit depuis `pwa_installs` pour afficher le compteur d'installations.

**Les changements ci-dessous ne touchent PAS aux appels `trackPWAInstall` ni `trackPWAPresence`.** Ils corrigent uniquement la logique d'affichage et de declenchement du bouton. Les 2 appels `trackPWAInstall(user?.id)` (lignes 69 et 102) restent exactement en place.

## Changements dans `PWAInstallBanner.tsx`

### 1. Ne pas detruire le prompt en cas d'annulation

**Avant** (ligne 107-108) : apres `prompt()`, les refs sont mises a `null` dans tous les cas — meme si l'utilisateur refuse.
**Apres** : ne mettre a `null` que si `outcome === "accepted"`. Si l'utilisateur annule, le bouton reste fonctionnel pour un nouvel essai.

### 2. Augmenter le timeout du fallback Android

**Avant** : 3 secondes.
**Apres** : 6 secondes — laisse plus de temps au navigateur d'emettre `beforeinstallprompt` sur connexions lentes.

### 3. Re-capturer le prompt tardif

Ajouter dans le `useEffect` : si `beforeinstallprompt` arrive apres que le fallback manuel est deja affiche, basculer automatiquement vers le bouton natif (desactiver `showAndroidFallback`). Cela couvre le cas ou le SW met du temps a s'activer.

### 4. Feedback si prompt indisponible

Si l'utilisateur clique "Installer" mais que le prompt natif n'existe pas, afficher les instructions manuelles avec un message explicatif (deja partiellement en place via `showFallbackMessage`).

## Impact sur le tracking

| Element | Modifie ? | Detail |
|---|---|---|
| `trackPWAInstall()` appels | Non | Les 2 appels restent identiques (lignes 69 et 102) |
| `trackPWAPresence()` dans App.tsx | Non | Aucun changement |
| Table `pwa_installs` | Non | Aucune migration |
| Table `analytics_events` | Non | Aucune migration |
| Page Admin Analytics | Non | Les queries sur `pwa_installs` restent inchangees |
| KPIs `pwa_sessions` / `web_sessions` | Non | Calcules dans `get_analytics_kpis`, pas impactes |

## Fichier modifie

- `frontend/src/components/PWAInstallBanner.tsx` — 4 corrections logiques, 0 changement de tracking

## Risque

Aucun. Seule la logique d'affichage du banner change. Le tracking PWA reste intact a 100%.

