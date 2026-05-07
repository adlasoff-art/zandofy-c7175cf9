## Diagnostic

Deux bugs cumulés expliquent le comportement observé :

**Bug n°1 — le toggle ne persiste pas (toggle revient désactivé au refresh)**
Dans `AdminSettingsPage.tsx` (ligne 456-463), le `<Switch>` ne fait que `setMaintenance(...)` en mémoire. Aucun `upsert` n'est déclenché — il faut cliquer le bouton "Sauvegarder" en bas de page pour que `handleSave` envoie la valeur en base. Sans clic, le rechargement relit la valeur précédente (désactivée) depuis la DB.

À l'inverse, les `payment_methods` auto-sauvegardent (`updatePaymentMethod` ligne 159-165). Il faut le même pattern pour la maintenance.

**Bug n°2 — la page maintenance ne s'affiche pas en navigation privée même après sauvegarde**
`MaintenanceGuard` lit `maintenance_mode` via `usePlatformBootstrap`, qui appelle l'edge function `platform-bootstrap`. Cette fonction renvoie :
```
Cache-Control: public, max-age=300, s-maxage=300, stale-while-revalidate=3600
CDN-Cache-Control: public, max-age=300
```
→ La réponse est cachée **5 min sur le CDN Supabase** et **5 min côté navigateur**. En navigation privée, le navigateur n'a rien en cache local mais le **CDN sert toujours la version pré-bascule** pendant jusqu'à 5 min (et jusqu'à 1 h via `stale-while-revalidate`). Côté React Query : `staleTime: 5min` + `refetchOnMount: false` aggravent la chose pour les onglets déjà ouverts.

Conclusion : même si on corrige le bug n°1, la bascule met jusqu'à 5 min à apparaître pour un visiteur en navigation privée. Inacceptable pour un kill-switch.

## Plan

### 1. Auto-save du toggle maintenance (`frontend/src/pages/admin/AdminSettingsPage.tsx`)

- Extraire `saveMaintenance(config)` (callback) qui upsert `maintenance_mode` immédiatement, comme `savePaymentMethods`.
- Le `<Switch>` appelle directement `saveMaintenance({ ...prev, enabled, end_time: ... })`.
- Les inputs `title`, `message`, `duration_minutes` continuent de passer par `handleSave` global (debounce naturel via le bouton Sauvegarder) — seul l'état `enabled` doit être instantané.
- À la sauvegarde, invalider la query React Query `["platform-bootstrap"]` pour que l'admin voie l'effet sans F5.
- Toast clair : "Maintenance activée" / "Maintenance désactivée".

### 2. Sortir `maintenance_mode` du bootstrap caché (`frontend/src/components/MaintenanceGuard.tsx` + nouvelle hook)

Le bootstrap reste utile pour branding/SEO/topbar (5 min de cache OK). Mais `maintenance_mode` doit être réactif sous 10 s max.

- Créer `frontend/src/hooks/use-maintenance-mode.ts` :
  - Lit directement `platform_settings` (table publique en lecture anon, déjà OK via RLS) avec une simple requête `select('value').eq('key', 'maintenance_mode').maybeSingle()`.
  - `staleTime: 10s`, `refetchOnWindowFocus: true`, `refetchInterval: 30_000` quand l'app a le focus.
  - Pas d'edge function → pas de cache CDN → propagation instantanée.
- `MaintenanceGuard` consomme cette hook au lieu de `useBootstrapSetting('maintenance_mode')`.
- Retirer `maintenance_mode` de la liste `BOOTSTRAP_KEYS` dans `use-platform-bootstrap.ts` ET dans l'edge function `platform-bootstrap/index.ts` (pour ne pas le servir avec un cache 5 min). À redéployer via le workflow GitHub Actions habituel.

### 3. Documentation rapide dans l'UI admin

Sous le toggle, ajouter un petit texte : "La bascule est immédiate (≤ 30 s pour les visiteurs déjà sur le site, instantanée pour les nouveaux)."

## Détails techniques

- **Pas de migration DB** nécessaire : la colonne `value` JSON existe déjà, RLS lecture anon en place (sinon le guard ne marcherait pas du tout).
- **Edge function** : modifier `frontend/supabase/functions/platform-bootstrap/index.ts` (retirer `"maintenance_mode"` de `BOOTSTRAP_KEYS`) et redéployer via `deploy-edge-functions.yml` après merge dans `develop` puis `main`.
- **Bypass admin** : conservé tel quel (le guard attend déjà `adminChecked`).
- **Compatibilité staging/prod** : les deux instances Supabase ont la même table `platform_settings` et la même RLS — aucun risque de divergence.

## Validation après déploiement

1. Activer le toggle dans `/admin/settings` → vérifier toast "Maintenance activée" sans clic Sauvegarder.
2. F5 sur l'admin → toggle reste activé.
3. Ouvrir `https://zandofy.com` en navigation privée fraîche → page maintenance s'affiche immédiatement.
4. Désactiver le toggle → onglet visiteur déjà ouvert : la page disparaît dans les 30 s.
5. Vérifier qu'un admin connecté contourne toujours la page.
