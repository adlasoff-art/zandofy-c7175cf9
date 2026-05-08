## Problème observé

Quand un utilisateur clique sur le lien "Réinitialiser mon mot de passe" reçu par email, il atterrit sur la page d'accueil **déjà connecté**, sans avoir saisi de nouveau mot de passe. La page `/reset-password` existe pourtant déjà (`frontend/src/pages/ResetPassword.tsx`) et `AuthPage` envoie bien `redirectTo: ${origin}/reset-password`.

## Cause racine

Deux problèmes combinés :

1. **URL de redirection non autorisée côté Lovable Cloud (Supabase Auth).** Quand `/reset-password` n'est pas dans la liste blanche des "Redirect URLs", Supabase ignore le `redirectTo` envoyé par le client et retombe sur la **Site URL** (`https://zandofy.com/`). Résultat : le token est consommé, la session est créée, et l'utilisateur arrive sur `/` connecté.
2. **`ResetPassword.tsx` n'a aucun filet de sécurité côté global.** Même si l'URL contient `#type=recovery`, `AuthContext` traite l'événement comme un `SIGNED_IN` standard et l'app continue son rendu normal. Si l'utilisateur arrive directement sur `/`, rien ne le redirige vers la page de saisie du nouveau mot de passe.

## Plan de correction

### 1. Intercepter l'événement `PASSWORD_RECOVERY` globalement

Dans `frontend/src/contexts/AuthContext.tsx`, dans le listener `onAuthStateChange`, détecter `event === "PASSWORD_RECOVERY"` et :
- Stocker un flag `isRecoveringPassword` dans le contexte (exposé via `useAuth()`).
- Forcer la navigation vers `/reset-password` si l'utilisateur n'y est pas déjà (utiliser `window.location.pathname` car `AuthContext` n'a pas accès au router).

Cela couvre tous les cas où Supabase renvoie l'utilisateur sur `/` au lieu de `/reset-password`.

### 2. Renforcer `ResetPassword.tsx`

- Ne plus se baser uniquement sur `window.location.hash.includes("type=recovery")` (le hash est consommé par le client Supabase au démarrage).
- Utiliser le flag `isRecoveringPassword` du contexte **OU** la présence d'une session active arrivée via PASSWORD_RECOVERY pour autoriser l'accès.
- Après mise à jour réussie : appeler `supabase.auth.signOut()` puis rediriger vers `/auth` avec un toast "Mot de passe mis à jour, connectez-vous". Cela évite l'incohérence "auto-connecté avec ancienne session de recovery".
- Ajouter un champ **"Confirmer le mot de passe"** + validation (longueur min 8, correspondance des deux champs) — l'utilisateur l'a explicitement demandé.

### 3. Bloquer la navigation hors `/reset-password` pendant la recovery

Dans `App.tsx` (ou un petit composant `RecoveryGuard`), si `isRecoveringPassword === true` et que `location.pathname !== "/reset-password"`, faire un `<Navigate to="/reset-password" replace />`.

### 4. Whitelist côté Lovable Cloud (à faire par l'utilisateur)

Ajouter dans **Cloud → Auth → URL Configuration → Redirect URLs** :
- `https://zandofy.com/reset-password`
- `https://www.zandofy.com/reset-password`
- `https://studio.zandofy.com/reset-password` (si encore utilisé)
- `http://localhost:*/reset-password` (dev)

Sans cela, Supabase continuera de retomber sur la Site URL même avec le code applicatif corrigé. Je le rappellerai à la fin de l'implémentation avec un bouton `<lov-open-backend>`.

## Fichiers touchés

- `frontend/src/contexts/AuthContext.tsx` — ajout flag `isRecoveringPassword` + redirection forcée sur `PASSWORD_RECOVERY`.
- `frontend/src/pages/ResetPassword.tsx` — champ confirmation, validation, signOut après update, lecture du flag contexte.
- `frontend/src/App.tsx` — `RecoveryGuard` minimal autour des routes.

## Hors scope

- Pas de modification du template d'email (les emails par défaut Supabase fonctionnent déjà, le problème est la redirection).
- Pas de modification métier ailleurs.
- Le passage en custom auth-email-hook pour la délivrabilité (spam) est un sujet séparé que tu as dit avoir déjà résolu.
