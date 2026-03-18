

## Plan : Popup de mise à jour PWA

### Problème
Actuellement, le Service Worker se met à jour silencieusement (`skipWaiting`). Les utilisateurs PWA peuvent rester bloqués sur une version obsolète avec des assets périmés, causant des écrans blancs.

### Solution
Deux modifications :

**1. `frontend/src/main.tsx`** — Détecter quand un nouveau Service Worker est installé et émettre un événement custom :
- Enregistrer le SW avec suivi de l'état `updatefound` → `statechange`
- Quand un nouveau SW passe en `installed` et qu'il y a déjà un SW actif (= mise à jour), dispatcher un événement `sw-update-available` sur `window`

**2. Créer `frontend/src/components/PWAUpdatePrompt.tsx`** — Composant popup :
- Écoute l'événement `sw-update-available`
- Affiche un dialog/banner avec le message "Une nouvelle version est disponible" + bouton "Mettre à jour"
- Au clic : envoie `SKIP_WAITING` au nouveau SW en attente, puis `window.location.reload()` pour charger la nouvelle version
- Bilingue FR/EN via `useI18n`
- Design cohérent : overlay fixe en bas de l'écran, style similaire au `PWAInstallBanner`

**3. `frontend/src/App.tsx`** — Ajouter `<PWAUpdatePrompt />` à côté de `<PWAInstallBanner />`

**4. `frontend/public/sw.js`** — Le SW écoute déjà `SKIP_WAITING` (ligne 211) et appelle `self.skipWaiting()`. Retirer le `self.skipWaiting()` automatique dans l'événement `install` pour que le nouveau SW **attende** que l'utilisateur clique "Mettre à jour" avant de prendre le contrôle.

### Flux utilisateur
```text
Déploiement → Navigateur détecte nouveau SW → SW installé en attente
→ Popup "Nouvelle version disponible !" apparaît
→ Utilisateur clique "Mettre à jour"
→ SKIP_WAITING envoyé → nouveau SW activé → page rechargée
→ Version à jour chargée
```

### Fichiers modifiés
| Fichier | Action |
|---------|--------|
| `frontend/public/sw.js` | Retirer `self.skipWaiting()` de l'événement `install` |
| `frontend/src/main.tsx` | Ajouter détection `updatefound` + événement custom |
| `frontend/src/components/PWAUpdatePrompt.tsx` | Nouveau composant popup |
| `frontend/src/App.tsx` | Ajouter `<PWAUpdatePrompt />` |

