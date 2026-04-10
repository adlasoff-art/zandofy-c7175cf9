

# Plan : PWA Install Fallback + Audit Sécurité (Score 96 → ~99)

## A — PWA Install : message fallback + persistance iOS

### Android
- Si le clic sur "Installer" ne déclenche rien (`beforeinstallprompt` absent), afficher un message :
  - FR : « Votre navigateur ne prend pas en charge l'installation directe. Suivez les étapes ci-dessous. »
  - EN : « Your browser doesn't support direct installation. Follow the steps below. »
- Le message apparaît au-dessus des instructions manuelles (Menu → Ajouter à l'écran d'accueil).

### iOS
- Utiliser `sessionStorage` au lieu de `localStorage` pour iOS. Ainsi la bannière réapparaît **à chaque nouvelle visite navigateur** tant que l'utilisateur n'a pas installé la PWA sur son téléphone.
- Si l'app est détectée comme installée (`navigator.standalone` ou `display-mode: standalone`), la bannière ne s'affiche plus.

### Fichier modifié
- `frontend/src/components/PWAInstallBanner.tsx`

---

## B — Audit sécurité : 3 corrections (Cloudflare exclu)

Le point Cloudflare (infrastructure) est mis de côté — vous l'étudierez séparément.

### B1. Colonne `token` résiduelle — DROP column (1pt)
- Migration SQL : `ALTER TABLE impersonation_tokens DROP COLUMN IF EXISTS token;`

### B2. `error_reports` — INSERT restreint aux authentifiés (1pt)
- Migration SQL : remplacer la policy INSERT anonyme par une policy authentifiée
- Mise à jour `ErrorBoundary.tsx` : envoyer `user_id` au lieu de `user_email`

### B3. `rate_limit_entries` — fonction SECURITY DEFINER pour écriture (1pt)
- Migration SQL : créer `upsert_rate_limit()` en SECURITY DEFINER

---

## Fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| `PWAInstallBanner.tsx` | Message fallback Android + sessionStorage iOS |
| `ErrorBoundary.tsx` | `user_id` au lieu de `user_email` |
| Migration SQL | DROP token, fix error_reports policy, upsert_rate_limit() |

## Livrable
- Fichier SQL téléchargeable pour synchronisation staging/production

## Score après corrections : ~99/100 (le point restant = Cloudflare, traité ultérieurement)

