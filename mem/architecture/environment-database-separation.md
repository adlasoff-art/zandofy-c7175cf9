---
name: Environment Database Separation
description: Production = Supabase.com personnel (vpt...yxf). Staging = wgi...wete. Lovable Cloud (uog...zpu) = preview only, NEVER source of truth.
type: constraint
---
**Stack de production réelle (priorité absolue, 4000+ users/jour)** :
- Frontend : `https://zandofy.com` (Vercel, branche `main`)
- Backend / DB / Edge Functions / Storage : projet Supabase.com personnel `vpt...yxf` (`https://vpttoqojmiqxgudknyxf.supabase.co`), CDN images derrière Cloudflare
- Déploiement : GitHub → Vercel (frontend) + GitHub Actions (`deploy-edge-functions.yml`) → Supabase prod

**Stack de staging** :
- Frontend : `https://studio-staging.zandofy.com` (build séparé, branche `develop`)
- Backend / DB : projet Supabase `wgi...wete` (`https://wgidwyrdnboivfphwete.supabase.co`)
- N'est JAMAIS sollicitée par les visiteurs publics de `zandofy.com`

**Lovable Cloud (`uog...zpu`)** : UNIQUEMENT pour les prévisualisations dans l'éditeur Lovable. Ne contient que des données de seed/test. **Jamais** la source de vérité, jamais à utiliser pour diagnostiquer un bug de prod.

**Règle de preconnect / preload public (CRITIQUE)** : dans `frontend/index.html` (servi par Vercel sur `zandofy.com`), seul `vpttoqojmiqxgudknyxf.supabase.co` doit apparaître en `<link rel="preconnect">` ou `<link rel="preload">`. NE JAMAIS ajouter `wgidwyrdnboivfphwete.supabase.co` (staging) ni Lovable Cloud — gaspille un slot preconnect (limite navigateur 4-6) et ouvre une connexion TCP+TLS parasite à chaque visite. Le build staging a son propre `index.html` avec ses propres `VITE_*`.

**Règle de raisonnement** : tout bug rapporté par l'utilisateur concerne la prod (`zandofy.com` + Supabase `vpt...yxf`). Tester via les outils Lovable (qui pointent sur `uog...zpu`) peut donner des faux négatifs (UUID introuvables, données absentes). Toujours interpréter ces résultats avec cette mise en garde.
