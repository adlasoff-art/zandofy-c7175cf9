# 🛡️ Zandofy Safety & Protocol Policy (v2.0)

> **Statut** : Critique / Force Exécutoire  
> **Date de révision** : 2 Avril 2026  
> **Cible** : IA Lovable & Collaborateurs

## 1. Protocoles de Déploiement

* **Interdiction de Push Direct :** Aucun code ne doit être poussé sur `main` sans avoir été validé sur la branche `develop` et testé sur l'instance Supabase de test (`zandofy-production`).
* **Parité des Edge Functions :** Toute modification des fonctions Edge doit être déployée simultanément sur les environnements de Test et de Production via le workflow GitHub Actions établi.

## 2. Gestion des Secrets et Identifiants

* **Standard Bearer :** Les tokens de passerelle de paiement (ex: KelPay) doivent impérativement être configurés avec le préfixe `Bearer ` suivi d'un espace.
* **Isolement des Clés :** Les clés OpenAI et les credentials SMTP ne doivent jamais être exposés côté client. Ils doivent rester strictement dans les variables d'environnement côté serveur (Supabase Vault ou Vercel Secrets).

## 3. Protocoles de Paiement et Callbacks

* **Validation des Domaines :** Toutes les URLs de redirection de paiement (Callback URLs) doivent pointer exclusivement vers le domaine de production `https://zandofy.com` pour la branche `main`.
* **Tests de Transaction :** Aucun changement touchant à la logique de panier ou de checkout ne peut être déployé en production sans un test de succès de transaction sur l'environnement de staging.

## 4. Protection des Données et RLS

* **Politiques de Stockage (Storage) :** Les 7 buckets de stockage doivent avoir des politiques RLS (Row Level Security) strictes. L'accès public est limité à la lecture seule pour les images produits.
* **Authentification :** Seule l'authentification Google est autorisée. Tout vestige de code relatif à Apple ou Facebook Login doit être retiré pour éviter les failles de sécurité ou les erreurs de redirection.

## 5. Maintenance des Archives

* L'accès à l'ancien site (via `hostingersite.com`) est strictement réservé à la récupération de données et ne doit en aucun cas être lié au nouveau domaine ou exposé aux utilisateurs finaux.

---

> Ce document est une directive absolue. Toute déviation doit être justifiée et validée par l'administrateur.

---

## 6. Versionning PWA (CRITIQUE — 600+ utilisateurs installés)

**Source unique** : `frontend/src/version.ts` (`APP_VERSION`, `SHOW_UPDATE_PROMPT`).
Le Service Worker est enregistré via `/sw.js?v=${APP_VERSION}` dans `main.tsx`.

| Bump | Quand | `SHOW_UPDATE_PROMPT` | Push broadcast |
|------|-------|----------------------|----------------|
| patch | correctif mineur / texte | `false` | non (silencieux) |
| minor | fin d'un lot / nouvelle feature | `true` | oui (`notify-app-update`) |
| major | refonte UX / breaking | `true` | oui |

### Runbook hard refresh (ops)

1. Bump `APP_VERSION` in `frontend/src/version.ts` (minor/major).
2. Set `SHOW_UPDATE_PROMPT = true` (patch → leave `false` for silent SW).
3. Deploy frontend (Vercel).
4. Admin → Notifications / PWA card → broadcast `notify-app-update`.
5. Clients: modal « Mettre à jour maintenant » → `CLEAR_CACHES` + reload.
6. Checkout path: update prompt is **deferred** until the user leaves `/checkout`.
7. After Branding (logo) save: `platform-bootstrap` cache is invalidated in-app; purge CDN if logo still stale.

### Checkout sessions (1 paiement → N commandes)

Voir [`docs/guides/CHECKOUT_SESSIONS.md`](guides/CHECKOUT_SESSIONS.md).
Remboursements = **par `order_ref`**, pas par session seule. Défaut vendeur `multi_vendor_ok` (opt-out `solo_only`).

### Protocole Lovable (obligatoire — Option B)

À la fin de chaque itération significative, Lovable DOIT demander à
l'administrateur :
*"Veux-tu bumper la version pour notifier les utilisateurs PWA installés ?"*.
Aucun bump silencieux n'est autorisé.

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
