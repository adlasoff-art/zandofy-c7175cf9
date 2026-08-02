# Guide ops SEO / Search Console — Zandofy

Document de référence pour finaliser le référencement marketplace (phase GSC + canonique).  
Mis à jour : 2026-08-02.

---

## 0. Diagnostic live (important)

| Observation | Cause | Action |
|-------------|--------|--------|
| GSC ne récupère pas `https://www.zandofy.com/sitemap.xml` | **www → 307 → apex** (`zandofy.com`) | Soumettre le sitemap en **apex**, ou inverser la redirection |
| `https://zandofy.com/sitemap.xml` = ancien XML court | Fichier statique `frontend/public/sitemap.xml` **prioritaire** sur le rewrite Vercel | Fichier **supprimé** ; rewrite → Edge `generate-sitemap` |
| `sitemap-dynamic.xml` = catalogue + hubs | Rewrite OK vers Edge Function | Garder en GSC |
| Edge `generate-sitemap` déjà à jour | Déployée récemment | Redeploy après chaque change code |

**Canonique retenue (alignée infra actuelle) :** `https://zandofy.com`  
(www redirige déjà vers apex — Cloudflare/Vercel.)

---

## 1. Redeploy Edge Function `generate-sitemap`

### A. Via GitHub Actions (si le workflow est branché sur `main`)

1. Merger `develop` → `main` (ou push sur la branche qui déclenche le workflow).  
2. Workflow : [`.github/workflows/deploy-edge-functions.yml`](../.github/workflows/deploy-edge-functions.yml).  
3. Vérifier l’onglet **Actions** GitHub → job deploy Edge Functions.

### B. Via CLI (projet **production** `vpttoqojmiqxgudknyxf`)

```bash
cd c:\Users\HP\zandofy\zandofy-c7175cf9
npx supabase login
npx supabase functions deploy generate-sitemap --project-ref vpttoqojmiqxgudknyxf
```

### C. Via Dashboard Supabase

1. Projet **zandofy-live-production**  
2. **Edge Functions** → `generate-sitemap`  
3. Si Git sync : push sur `main` suffit.  
4. Sinon : CLI (B). L’UI « Deploy » seule ne tire pas toujours le code du repo.

### Vérifier

```bash
curl.exe -sL "https://vpttoqojmiqxgudknyxf.supabase.co/functions/v1/generate-sitemap" | more
curl.exe -sL "https://zandofy.com/sitemap.xml" | more
```

Attendu : URLs `https://zandofy.com/product/...`, `/help-center`, pas de commentaires `<!-- Homepage -->`.

### Redeploy « toutes » les Edge Functions

```bash
npx supabase functions deploy --project-ref vpttoqojmiqxgudknyxf
```

Ou laisser le workflow GitHub déployer la liste définie dans le YAML.

---

## 2. Search Console — Sitemaps

1. Propriété **domaine** `zandofy.com` (déjà OK).  
2. **Indexation → Sitemaps**  
3. **Ajouter** : `https://zandofy.com/sitemap.xml`  
4. **Garder** : `https://zandofy.com/sitemap-dynamic.xml` (1119 pages — OK)  
5. **Retirer / ignorer** l’échec `https://www.zandofy.com/sitemap.xml` (redirect) — ne plus utiliser www pour le sitemap tant que www → apex.

Après deploy front (sans fichier statique) : renvoyer / attendre relecture de `sitemap.xml`.

---

## 3. Demander l’indexation (pas à pas)

Je ne peux pas cliquer dans ton compte GSC. Procédure humaine :

1. Barre du haut GSC → coller l’URL → Entrée  
2. **Demander une indexation**  
3. Passer à l’URL suivante (quota journalier limité)

### Liste à demander (host **apex**)

Déjà indexé (exemple) : `/faq` — skip ou redemander si titres SEO changés.

| # | URL | Priorité |
|---|-----|----------|
| 1 | `https://zandofy.com/` | Critique (accueil) |
| 2 | `https://zandofy.com/category/fashion` | Critique (tuer « Acheter en ligne ») |
| 3 | `https://zandofy.com/stores` | Haute |
| 4 | `https://zandofy.com/about` | Haute |
| 5 | `https://zandofy.com/help-center` | Haute |
| 6 | `https://zandofy.com/become-vendor` | Haute |
| 7 | `https://zandofy.com/affiliate-program` | Moyenne |
| 8 | `https://zandofy.com/popular` | Moyenne |
| 9 | `https://zandofy.com/trends` | Moyenne |
| 10 | `https://zandofy.com/blog` | Moyenne |

Optionnel ensuite : `/pricing`, `/loyalty-program`, `/privacy`, `/terms`.

---

## 4. Unifier www / apex

### État actuel (mesuré)

```
https://www.zandofy.com/*  →  307  →  https://zandofy.com/*
```

Donc **apex est déjà la canonique live**.

### Recommandation

| Couche | Config |
|--------|--------|
| **Cloudflare** | Garder redirect **www → apex** (301/307). Ne pas inverser sauf décision produit. |
| **Vercel Domains** | `zandofy.com` = primary ; `www.zandofy.com` = redirect to apex |
| **Vercel env** | `VITE_SITE_URL=https://zandofy.com` (et `SITE_URL` idem pour meta-injector) |
| **Supabase Edge** | `SITE_URL` dans `generate-sitemap` = `https://zandofy.com` |
| **robots.txt / canonicals** | Apex |
| **GSC** | Propriété domaine `zandofy.com` ; sitemaps et inspections en apex |

### Si un jour tu veux passer à www

1. Cloudflare Redirect Rule : `zandofy.com` → `https://www.zandofy.com/$1` (301)  
2. Vercel : www = primary  
3. Env + sitemap + code → `https://www.zandofy.com`  
4. Resoumettre sitemaps www dans GSC  

---

## 5. Checklist phase

- [x] Suppression temporaire `/` annulée  
- [ ] `VITE_SITE_URL=https://zandofy.com` sur Vercel prod (corriger si encore en www)  
- [ ] Front prod sans `public/sitemap.xml` (rewrite actif)  
- [ ] Edge `generate-sitemap` redeployée (apex)  
- [ ] GSC : sitemap apex `sitemap.xml` OK  
- [ ] Indexation demandée pour la liste §3  
- [ ] Dans 3–14 j : SERP « zandofy » + Mode sans ancien titre  
- [ ] Plus tard : Google Business Profile, metas produits, OG upload  

Voir aussi : [`SEO_MARKETPLACE_PLAYBOOK.md`](../SEO_MARKETPLACE_PLAYBOOK.md), [`SEO_BOT_PRERENDER.md`](../SEO_BOT_PRERENDER.md).
