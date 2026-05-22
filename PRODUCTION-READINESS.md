# Zandofy — Prêt pour la production

Checklist et variables à fournir avant mise en ligne (**Vercel** + **Supabase**).

---

## 1. Côté projet (dépôt)

| Élément | Statut attendu |
|--------|----------------|
| Migrations SQL | Fichiers dans `supabase/migrations/` |
| Edge Functions | Source dans `supabase/functions/` |
| Frontend | Build `frontend/` (`npm run build`) |
| Secrets | Aucun `.env` réel committé ; `frontend/.env.example` à jour |

---

## 2. Variables obligatoires

### Vercel (frontend — `VITE_*` uniquement)

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | URL du projet Supabase **production** |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clé anon production |
| `VITE_SUPABASE_PROJECT_ID` | Référence projet production |
| `VITE_SITE_URL` | `https://www.zandofy.com` (ou domaine canonique) |

### Supabase (secrets — Dashboard / Edge Functions)

| Variable | Description |
|----------|-------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Jamais dans le frontend |
| KelPay / Resend / SMTP / webhooks | Selon fonctionnalités actives |
| Clés AI, VAPID push, etc. | Selon besoin |

---

## 3. Vérifications avant prod

- [ ] Repo GitHub à jour, pas de secrets dans l’historique récent
- [ ] Vercel production pointe vers le projet Supabase **production** (pas staging)
- [ ] Migrations testées sur **staging** puis appliquées sur **production** (même fichier)
- [ ] Edge Functions déployées sur staging puis production
- [ ] Smoke tests : auth, catalogue, checkout, dashboard vendeur

---

## 4. Étapes de déploiement

1. **GitHub** : merge vers `main` (ou branche connectée à Vercel production).
2. **Vercel** : build et déploiement automatique du dossier `frontend/`.
3. **Supabase staging** : exécuter les nouvelles migrations SQL ; tester.
4. **Supabase production** : exécuter les **mêmes** fichiers SQL ; déployer les Edge Functions.
5. **DNS / Cloudflare** : domaine et SSL vers Vercel + endpoints Supabase.

---

## 5. Documentation liée

- `docs/ENVIRONMENTS.md`
- `AGENTS.md`
- `AUDIT-SECURITE.md` (si présent)
