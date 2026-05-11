# Zandofy Safety Policy v2.0

## Environnements

| Env | Projet | Domaine | Branche |
|-----|--------|---------|---------|
| Staging | zandofy-production | studio.zandofy.com | `develop` |
| Production | zandofy-live | zandofy.com | `main` |

## Règles de sécurité

1. **Pas de push direct sur `main`** — toute modification passe par `develop` puis PR.
2. **Parité des Edge Functions** — déploiement simultané staging + production.
3. **Callbacks de production** — toujours valider vers `https://zandofy.com` via `SITE_BASE_URL`.
4. **Authentification** — exclusivement Google OAuth.
5. **Stabilité du domaine principal** — priorité absolue.

## Règles de migration de base de données

6. **Export SQL obligatoire** — À chaque modification de la structure de la base de données (création de table, ajout/suppression de colonne, modification de politique RLS, création de fonction/trigger, etc.), un fichier SQL téléchargeable contenant la migration complète doit être fourni à l'utilisateur. Ce fichier permet la synchronisation manuelle avec les environnements Staging et Production via le SQL Editor.

## Règles générales

- Ne jamais modifier les fichiers sensibles sans approbation explicite (voir `AGENTS.md`).
- Ne jamais mélanger les variables staging et production.
- Traiter le code généré par Lovable comme du code brouillon jusqu'à revue.

## Versionning PWA (CRITIQUE — 600+ utilisateurs installés)

**Source unique** : `frontend/src/version.ts` (constantes `APP_VERSION` et `SHOW_UPDATE_PROMPT`).

Le SW est enregistré via `/sw.js?v=${APP_VERSION}` dans `main.tsx` : tout changement
d'`APP_VERSION` est donc détecté par le navigateur et déclenche `updatefound`.

### Règle SemVer simplifiée

| Bump | Quand | `SHOW_UPDATE_PROMPT` | Push broadcast |
|------|-------|----------------------|----------------|
| patch (1.9.0 → 1.9.1) | correctif visuel/texte/micro-fix | `false` | non |
| minor (1.9.1 → 1.10.0) | nouvelle feature, fin d'un lot | `true` | oui (`notify-app-update`) |
| major (1.x → 2.0.0) | refonte UX, breaking change | `true` | oui |

### Protocole obligatoire pour Lovable (Option B)

1. **À la fin de chaque itération significative**, Lovable DOIT demander :
   *"Veux-tu bumper la version (ex : 1.9.0 → 1.10.0 minor / 1.9.1 patch) pour
   notifier les 600+ utilisateurs PWA installés ?"*
2. Si **patch** → mettre à jour `APP_VERSION`, garder `SHOW_UPDATE_PROMPT = false`.
   Les utilisateurs reçoivent silencieusement le nouveau code au prochain reload.
3. Si **minor / major** → mettre à jour `APP_VERSION` ET `SHOW_UPDATE_PROMPT = true`,
   puis appeler l'edge function `notify-app-update` (admin) pour broadcaster une
   push "Nouvelle version Zandofy v1.x.0 — Touchez pour mettre à jour".
4. **Ne JAMAIS bumper sans demander.** L'objectif est d'éviter de spammer les
   utilisateurs avec une modale de mise à jour à chaque itération technique.

## 7. Intégration Keccel CardPay (IMMUABLE)

Règles officielles confirmées par l'équipe Keccel (WhatsApp). Toute déviation provoque
un rejet `{"code":"1","description":"Missing X parameter"}`.

**Endpoint** : `POST https://api.keccel.net/cardpay`
**Auth** : header `Authorization: Bearer <KELPAY_TOKEN>` (token brut, jamais "Bearer Bearer").

**Payload — EXACTEMENT 7 champs, TOUS en minuscules** :
- `merchantcode` (secret `KECCEL_CARD_MERCHANT_CODE` = `JAMSIO` pour Zandofy)
- `reference` (≤ 25 chars)
- `amount` (STRING entière, `Math.ceil`)
- `currency` (`USD`)
- `description`
- `callbackurl`
- `returnurl`

**INTERDICTIONS ABSOLUES** :
- Aucune clé en camelCase (`merchantCode`, `callbackUrl`, `returnUrl`).
- Aucun champ extra (`language`, `customerEmail`, `customerName`, `customerPhone`,
  `notifyUrl`, `country`, `channel`, etc.).
- Aucune boucle de variantes lors du debug — un seul payload conforme.
- Toute modification du payload (ajout de champ, changement de casse, changement de
  `merchantcode`) requiert une **confirmation écrite préalable** de l'équipe Keccel.

Référence mémoire détaillée : `mem://features/keccel-cardpay-constraints`.
