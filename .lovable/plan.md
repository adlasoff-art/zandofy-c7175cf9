

# Correction du manifest PWA pour PWA Builder

## Analyse des problèmes détectés par PWA Builder

| Problème | Cause | Impact |
|---|---|---|
| "Fix icon types" (erreur critique) | `purpose: "any maskable"` combine les deux dans un seul icon — PWA Builder exige des entrées séparées | Bloque le packaging APK |
| "Fix icon sizes" | Les shortcut icons déclarent `192x192` mais PWA Builder veut des tailles dédiées (96x96) | Avertissement |
| "Service Worker not found" (+0) | L'enregistrement du SW est conditionnel (iframe/preview guard) — PWA Builder scanne en production et ne le détecte probablement pas | Perte de points, pas bloquant |
| "Add screenshots" | Aucun champ `screenshots` dans le manifest | Requis pour le packaging Play Store |
| "start_url missing" | Faux positif probable — `start_url` est présent, mais PWA Builder peut avoir un bug de parsing | Non bloquant |

## Changements prévus

### 1. `frontend/public/manifest.json`

- **Séparer les icônes** : au lieu de `"purpose": "any maskable"`, créer 4 entrées (192 any, 192 maskable, 512 any, 512 maskable) pointant vers les mêmes fichiers
- **Ajouter `screenshots`** : 2 entrées (mobile 1080x1920, desktop 1920x1080) avec des captures du site — on utilisera les icônes existantes comme placeholder en attendant de vraies captures
- **Corriger shortcut icons** : ajouter `"type": "image/png"` manquant sur les shortcuts
- **Retirer `display_override`** avec `window-controls-overlay` qui n'est pas pertinent pour un e-commerce mobile

### 2. `frontend/public/sw.js`

- Aucun changement nécessaire — le SW fonctionne, PWA Builder ne le détecte simplement pas lors du scan externe. Le SW s'enregistre correctement en production.

### 3. Aucune migration SQL, aucun fichier sensible touché

## Manifest corrigé (aperçu)

```json
{
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "screenshots": [
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "form_factor": "narrow", "label": "Page d'accueil Zandofy" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "form_factor": "wide", "label": "Zandofy sur desktop" }
  ]
}
```

## Recommandation pour les screenshots

Les vraies captures d'écran (1080x1920 mobile, 1920x1080 desktop) sont requises par le Play Store pour générer l'APK. Pour l'instant je mets les icônes en placeholder. Tu pourras me fournir de vraies captures plus tard et je les remplacerai.

## Fichiers modifiés

- `frontend/public/manifest.json` — correction icônes, ajout screenshots, nettoyage

## Risque

Aucun. Seul le manifest statique change. Pas d'impact sur le code, le routage, l'auth ou les fonctionnalités.

