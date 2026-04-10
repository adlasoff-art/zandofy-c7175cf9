

# Plan : Lots 2 & 3 (Sécurité) + Bouton Install PWA

## Résumé

Trois chantiers en séquence : (1) Hashing SHA-256 des tokens d'impersonation, (2) Masquage PII pour collaborateurs, (3) Amélioration du bouton Install PWA mobile.

---

## LOT 2 — Impersonation Token Hashing (Faille 2)

### Migration SQL
- Ajouter colonne `token_hash TEXT` à `impersonation_tokens`
- Rendre `token` nullable (`ALTER COLUMN token DROP NOT NULL`)
- Index unique sur `token_hash`

### Edge Function `impersonate-user/index.ts`
- **Action `start`** : après génération du token aléatoire, calculer `SHA-256(token)` via `crypto.subtle.digest`, stocker le hash dans `token_hash`, mettre `token = NULL`, retourner le token brut au client
- **Action `exchange`** : recevoir le token brut, le hasher, chercher par `.eq("token_hash", hash)` au lieu de `.eq("token", token)`

Le fichier `supabase/functions/impersonate-user/index.ts` ET `frontend/supabase/functions/impersonate-user/index.ts` seront mis à jour (les deux copies existent).

---

## LOT 3 — PII Masking pour Collaborateurs

### Approche frontend (sans casse)
Dans `VendorOrderManager.tsx`, détecter si l'utilisateur courant est un collaborateur (pas le owner) et son `sub_role`. Si `sub_role` n'est pas `orders` ni `logistics` :
- Masquer `shipping_phone` (afficher `***`)
- Masquer `shipping_email`
- Afficher uniquement prénom + ville (pas adresse complète)

Les collaborateurs `orders` et `logistics` conservent l'accès complet (besoin métier).

### Fichiers modifiés
- `VendorOrderManager.tsx` : ajout d'un hook pour récupérer le `sub_role` du collaborateur courant et conditionner l'affichage

---

## PWA Install — Bouton natif Android + iOS

### Situation actuelle
Le composant `PWAInstallBanner.tsx` gère déjà 3 cas :
1. Android natif (`beforeinstallprompt`) → bouton "Installer" ✅ déjà fonctionnel
2. Android fallback (si `beforeinstallprompt` ne se déclenche pas) → instructions manuelles seulement
3. iOS → instructions manuelles (Share → Add to Home Screen)

### Améliorations
1. **Android fallback** : ajouter un bouton blanc "Installer" à droite du texte "Confirmer/Ajouter" qui tente de déclencher `beforeinstallprompt` une dernière fois, ou redirige vers les instructions du navigateur
2. **Logique de masquage** : utiliser `localStorage` au lieu de `sessionStorage` pour `pwa_banner_dismissed` afin que la bannière ne réapparaisse pas après fermeture du navigateur
3. **Détection installé** : écouter l'événement `appinstalled` pour masquer la bannière immédiatement après installation

### Fichier modifié
- `PWAInstallBanner.tsx`

---

## Fichiers modifiés (total)

| Fichier | Changement |
|---------|-----------|
| Migration SQL | `token_hash` + index sur `impersonation_tokens` |
| `supabase/functions/impersonate-user/index.ts` | SHA-256 hashing |
| `frontend/supabase/functions/impersonate-user/index.ts` | SHA-256 hashing (copie) |
| `frontend/src/components/vendor/VendorOrderManager.tsx` | Masquage PII par sub_role |
| `frontend/src/components/PWAInstallBanner.tsx` | Bouton Install amélioré + persistence |

## Score sécurité après Lots 2+3 : ~96/100

