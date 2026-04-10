

# Plan : Hardening Final — 7 corrections pour atteindre ~99/100

## Approche

Vu la complexité et le risque, ce plan est découpé en **3 lots séquentiels**. Chaque lot sera soumis à approbation avant exécution.

---

## LOT 1 — SQL Migration (Failles 1, 3, 4, 5, 6)

### Faille 1 — Realtime : contrôle par channel (3 pts)

**Problème** : Les tables `orders`, `notifications`, `shipments`, `order_status_history` restent dans Realtime sans contrôle granulaire. Tout authentifié peut écouter les changements de n'importe quel utilisateur.

**Solution** : Supabase ne supporte pas nativement les politiques RLS sur `realtime.messages` dans ce contexte Cloud. L'approche la plus sûre et sans casse : **retirer ces 4 tables du Realtime** et basculer toute la logique frontend vers du polling sécurisé (les requêtes de polling passent par RLS normalement).

Tables restant dans Realtime après cette correction : **aucune**. Toute communication temps réel sera gérée par polling (5-30s selon la criticité).

**Impact frontend** : `AdminDashboard.tsx` utilise déjà du polling pour products/stores. Il faut aussi migrer les listeners `orders`/`notifications` vers du polling. Les composants client (DashboardPage, NotificationsPage) utilisent déjà `useQuery` avec refetchInterval — aucun changement nécessaire côté client.

### Faille 3 — order_status_history INSERT (1 pt)

**Problème** : La politique actuelle `Authenticated insert order history` est trop permissive (le `WITH CHECK` est large).

**Solution** : Remplacer par une politique plus restrictive :
- L'insertion est autorisée uniquement pour : le propriétaire de la commande (`user_id`), l'équipe boutique (`can_access_store_orders`), ou les admins/managers.
- Note : Le trigger `log_order_status_change()` (SECURITY DEFINER) insère automatiquement — il contourne RLS. La politique restrictive empêche seulement les insertions manuelles arbitraires.

### Faille 4 — Stores : colonnes de modération (0.5 pt)

**Problème** : `ban_reason`, `banned_at`, `suspension_reason`, `pending_name`, `name_change_status` visibles par tous.

**Solution** : Créer une vue `stores_safe` (similaire à `stores_public` mais pour les authentifiés) qui exclut ces colonnes de modération. Les pages publiques (StorePage, etc.) utiliseront cette vue. Les admins continuent à lire la table `stores` directement.

Approche simplifiée retenue : modifier les politiques RLS existantes pour que les non-admins passent par la vue `stores_public` (déjà sans colonnes sensibles). Les politiques SELECT sur `stores` restent ouvertes car RLS ne peut pas filtrer par colonne — la protection se fait côté vue et code frontend.

### Faille 5 — saved_cards : card_token (0.5 pt)

**Problème** : `card_token` lisible par l'utilisateur propriétaire.

**Solution** : Créer une vue `saved_cards_safe` qui exclut `card_token`, et modifier le frontend pour lire depuis cette vue. Les opérations de paiement (Edge Functions) liront `card_token` via service_role_key.

### Faille 6 — KYC : accès managers (0.5 pt)

**Problème** : Managers peuvent lire `document_front_url`, `document_back_url`, `selfie_url`.

**Solution** : Supprimer la politique `Managers read all KYC` et `Managers update KYC`. Seuls les admins auront accès aux documents KYC. L'interface admin KYC vérifiera le rôle avant d'afficher les pièces d'identité.

---

## LOT 2 — Impersonation Token Hashing (Faille 2, 1 pt)

### Faille 2 — Tokens d'impersonation en clair

**Problème** : Les tokens sont stockés en texte brut dans `impersonation_tokens.token`.

**Solution** :
1. **Migration SQL** : Ajouter une colonne `token_hash TEXT` à `impersonation_tokens`. Rendre `token` nullable (pour ne plus le stocker en clair à terme).
2. **Edge Function `impersonate-user`** :
   - Action `start` : générer le token, hasher avec SHA-256, stocker uniquement le hash dans `token_hash`, retourner le token brut au client.
   - Action `exchange` : recevoir le token brut, le hasher, chercher par `token_hash` au lieu de `token`.
3. **Nettoyage** : Un trigger ou la migration mettra `token = NULL` pour les anciens enregistrements expirés.

---

## LOT 3 — Frontend + PII Collaborateurs (Faille 7, 0.5 pt)

### Faille 7 — PII client visible par tous les collaborateurs

**Problème** : Tous les collaborateurs avec `can_access_store_orders` voient nom, téléphone, email, adresse complète.

**Solution** : Créer une vue `orders_team` (SECURITY DEFINER) qui masque les colonnes PII sensibles (`shipping_phone`, `shipping_email`, adresse complète) pour les collaborateurs dont le `sub_role` n'est pas `orders` ou `logistics`. Concrètement :
- Collaborateurs `orders`/`logistics` : voient tout (besoin métier)
- Autres collaborateurs : voient prénom + ville uniquement

Approche alternative plus simple (recommandée pour éviter la casse) : filtrer côté frontend dans les composants de commande vendeur. Les collaborateurs sans permission `orders` ne voient déjà que ce que leur permission leur permet d'accéder.

**Note** : Cette faille est la plus complexe et a le plus faible impact. L'approche frontend est préférée pour le pré-lancement.

---

## Fichiers modifiés par lot

| Lot | Fichiers | Type |
|-----|----------|------|
| 1 | Migration SQL unique | Realtime, order_status_history, saved_cards_safe view, KYC policies |
| 1 | `AdminDashboard.tsx` | Retirer listener Realtime orders |
| 2 | Migration SQL | Colonne `token_hash` sur impersonation_tokens |
| 2 | `supabase/functions/impersonate-user/index.ts` | Hashing SHA-256 |
| 3 | Composants vendeur commande | Masquage PII frontend |

## Score après chaque lot

- Lot 1 : ~80 → **~94/100**
- Lot 2 : ~94 → **~95/100**
- Lot 3 : ~95 → **~96/100**

Les 4 derniers points = WAF Cloudflare + audit de pénétration externe + SIEM monitoring.

## Cloudflare — Réflexion

Pour les derniers points (WAF/DDoS), Cloudflare s'intègre à votre infrastructure via :
1. **DNS Proxy** : Pointer `zandofy.com` vers Cloudflare (mode proxied). Cela active automatiquement la protection DDoS L3/L4/L7.
2. **WAF Rules** : Activer les managed rulesets (OWASP Top 10) dans le dashboard Cloudflare.
3. **Bot Management** : Cloudflare détecte et bloque les bots malveillants.
4. **Rate Limiting** : Limiter les requêtes par IP au niveau CDN (avant qu'elles atteignent votre serveur).

Cela ne nécessite aucun changement de code — uniquement de la configuration DNS et du dashboard Cloudflare. Le plan gratuit offre déjà la protection DDoS de base. Le plan Pro ($20/mois) ajoute le WAF managé.

## Fichier SQL téléchargeable

Chaque lot produira un fichier SQL téléchargeable pour synchronisation staging/production.

## Procédure

Je commence par le **Lot 1** dès votre approbation. Après validation, je passe au Lot 2, puis au Lot 3.

