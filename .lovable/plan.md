

# Plan de corrections critiques — Zandofy

## Corrections à appliquer

### 1. Suppression du fallback `studio.zandofy.com` dans Keccel CardPay (legacy)

**Fichier** : `supabase/functions/keccel-cardpay/index.ts` (version racine)

Le fichier contient probablement un fallback hardcodé vers `studio.zandofy.com` pour `SITE_BASE_URL`. Ce fallback doit être supprimé — si `SITE_BASE_URL` n'est pas configuré, la fonction doit retourner une erreur explicite (comme le fait déjà la version dans `frontend/supabase/functions/`).

### 2. Mise à jour de `docs/SAFETY_POLICY.md` vers v2.0

Remplacement complet par la version fournie couvrant :
- Protocoles de déploiement (interdiction push direct sur `main`)
- Gestion des secrets (standard Bearer)
- Protocoles de paiement (validation domaines)
- Protection des données et RLS
- Maintenance des archives

### 3. Fix React `useContext` — déduplication dans `vite.config.ts`

Ajout de `resolve.dedupe` pour `react` et `react-dom` afin d'éviter les erreurs de double-instance React qui causent le crash `Cannot read properties of null (reading 'useContext')`.

---

**Note** : Le fichier `.github/workflows/deploy-edge-functions.yml` est déjà à jour (confirmé dans le message précédent).

