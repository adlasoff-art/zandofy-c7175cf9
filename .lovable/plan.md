## Contexte

Les 537 URLs legacy pointant vers `wgidwyrdnboivfphwete.supabase.co` (staging) ont été réécrites en base de production vers `vpttoqojmiqxgudknyxf.supabase.co`. Validation confirmée : `cms_banners`, `categories`, `product_images`, `cms_menu_items`, `cms_popups` → tous à 0 ligne legacy.

Le `<link rel="preconnect">` vers le domaine staging dans `frontend/index.html` était une mitigation temporaire explicitement documentée. Il devient inutile et gaspille un slot preconnect (limite navigateur 4-6).

## Changements

### 1. `frontend/index.html`
- Supprimer le bloc `<link rel="preconnect" href="https://wgidwyrdnboivfphwete.supabase.co">` (et son `dns-prefetch` éventuel)
- Vérifier que `vpttoqojmiqxgudknyxf.supabase.co` reste bien préconnecté (c'est lui qui sert maintenant 100% des images)

### 2. `mem/architecture/environment-database-separation.md`
- Retirer la section « Exception temporaire — preconnect staging pour images legacy » (devenue obsolète)
- Garder le reste de la mémoire intacte

## Hors périmètre

- Aucun changement DB (déjà fait manuellement via SQL Editor prod)
- Aucun changement de script (`scripts/perf-cleanup/*` reste pour archive/rollback)
- Pas de suppression de la table `_backup_urls_20260506` (à garder ~1 semaine au cas où, puis l'utilisateur la droppera manuellement)

## Validation après merge prod

1. Ouvrir https://zandofy.com sur mobile en navigation privée → DevTools Network → vérifier qu'aucune requête `wgidwyrdnboivfphwete` n'apparaît
2. Re-run PageSpeed mobile (https://pagespeed.web.dev/) → le LCP devrait baisser (gain estimé : 200-400 ms via préconnect + CDN Cloudflare actif sur prod)