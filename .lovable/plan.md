

# Diagnostic Analytics — Problèmes identifiés et corrections

## Résumé des bugs trouvés

### Bug 1 : Clics produits toujours à 0
**Cause** : Le hook `useTrackProductClick()` est **défini** dans `use-analytics.ts` mais **jamais appelé** nulle part. Aucun composant (ProductCard, grilles, etc.) ne l'importe ni ne l'utilise. Les événements `product_click` ne sont donc jamais enregistrés.

**Fix** : Importer et appeler `useTrackProductClick` dans `ProductCard.tsx` quand l'utilisateur clique sur un produit (navigation vers la page produit).

### Bug 2 : PWA installées — compteur qui descend (le plus critique)
**Causes multiples** :

1. **`trackPWAInstall()` n'est jamais appelé** — La fonction existe dans `use-analytics.ts` mais n'est importée/utilisée dans **aucun composant**. Ni dans `PWAInstallBanner.tsx` (quand `appinstalled` se déclenche), ni ailleurs. Donc la table `pwa_installs` ne reçoit des données que via `trackPWAPresence()`.

2. **`trackPWAPresence()` utilise `session_id` comme clé unique** — Le `session_id` est stocké dans `sessionStorage`, qui se réinitialise à chaque nouvelle session navigateur/PWA. Chaque ouverture de la PWA crée un **nouveau** `session_id` → une nouvelle ligne dans `pwa_installs`. Ce n'est pas un compteur d'installations, c'est un compteur de **sessions PWA**.

3. **Le dashboard filtre par date** — `pwa_installs` est filtré avec `created_at >= since`. Avec le filtre "24h", seules les sessions PWA des dernières 24h comptent. Le nombre descend naturellement quand des utilisateurs n'ouvrent pas la PWA pendant la période sélectionnée.

**Fix** : Refondre le système de comptage PWA :
- Appeler `trackPWAInstall()` dans `PWAInstallBanner.tsx` lors de l'événement `appinstalled`
- Utiliser un identifiant **persistant** (basé sur `localStorage` ou fingerprint navigateur) au lieu de `session_id` pour la table `pwa_installs` — un appareil = une ligne
- Le filtre date ne devrait s'appliquer qu'aux **nouvelles installations**, pas au compteur total
- Ajouter un champ `last_seen_at` mis à jour par `trackPWAPresence()` pour distinguer installations actives vs inactives
- Le widget "PWA installées" doit montrer le **total cumulé** (sans filtre date) + les actives récentes

### Bug 3 : Durée moyenne à 0 secondes
**Cause probable** : L'événement `session_end` est envoyé via `navigator.sendBeacon()` avec seulement le `apikey` en query param. PostgREST nécessite aussi le header `Authorization` ou le header `Prefer` peut poser problème. De plus, le header `Content-Type` envoyé par sendBeacon avec un Blob n'inclut pas le `Prefer: return=minimal` requis par PostgREST pour les inserts — les données `session_end` **n'arrivent probablement pas en base**.

**Fix** : Modifier le sendBeacon pour inclure les headers nécessaires. Utiliser un `fetch(..., { keepalive: true })` au lieu de `sendBeacon` pour pouvoir envoyer les headers requis :
```typescript
fetch(url, {
  method: "POST",
  keepalive: true,
  headers: {
    "Content-Type": "application/json",
    "apikey": anonKey,
    "Authorization": "Bearer " + anonKey,
    "Prefer": "return=minimal",
  },
  body: JSON.stringify(row),
});
```

### Bug 4 : Widget "PWA installées" en haut = toujours 0
**Cause** : Le widget du haut (`StatCard` "PWA installées") affiche `pwaCount` qui vient de `pwa_installs.count`. Mais la politique RLS a été modifiée (migration `20260410`) pour restreindre la lecture : seul l'admin avec `has_role(auth.uid(), 'admin')` peut lire toutes les lignes. Si la requête utilise `fromTable` (qui utilise le client Supabase avec le token de l'utilisateur connecté), cela devrait fonctionner pour un admin. Mais il faut vérifier que l'admin connecté a bien le rôle dans `user_roles`.

---

## Plan de corrections

| # | Fichier | Action |
|---|---------|--------|
| 1 | `ProductCard.tsx` | Importer `useTrackProductClick` et l'appeler au clic sur le lien produit |
| 2 | `PWAInstallBanner.tsx` | Importer et appeler `trackPWAInstall(userId)` dans le handler `appinstalled` et après `outcome === "accepted"` |
| 3 | `use-analytics.ts` | Remplacer `session_id` par un `device_id` persistant (localStorage) dans `trackPWAInstall` et `trackPWAPresence`. Ajouter un upsert sur `device_id` au lieu de `session_id`. |
| 4 | `use-analytics.ts` | Remplacer `sendBeacon` par `fetch({ keepalive: true })` avec les headers PostgREST corrects pour `session_end` |
| 5 | `AdminAnalyticsPage.tsx` | Widget "PWA installées" : afficher le total **sans filtre date** pour le compteur principal, et le nombre de la période entre parenthèses |
| 6 | Migration SQL | Ajouter colonne `device_id TEXT` + `last_seen_at TIMESTAMPTZ` à `pwa_installs`, créer un unique index sur `device_id`, mettre à jour la politique d'upsert |

### Risques
- **Aucun risque de régression** sur le front : on ajoute des appels de tracking manquants et on corrige le transport
- **Migration SQL** : ajout de colonnes nullable + index, sans impact sur les données existantes
- Le compteur PWA redémarrera à un chiffre plus précis après correction

