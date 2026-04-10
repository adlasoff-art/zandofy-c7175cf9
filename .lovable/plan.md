

# Plan : Pack Sécurité Pré-Lancement — Failles 1 à 6

## Résumé

Corriger les 6 failles de sécurité restantes en une seule opération. Aucun changement de structure de table. Uniquement des modifications de politiques RLS, un trigger SQL, et des ajustements frontend mineurs. La faille 7 (Realtime granulaire phase 2) est reportée post-lancement.

**Score estimé après corrections : ~93/100** (contre ~80 actuellement).

---

## Faille 1 — Retirer les tables sensibles du Realtime

Les tables `messages`, `deliveries`, `delivery_chats`, `dispute_messages`, `support_messages` diffusent des données privées (contenu des messages, adresses de livraison) à tout abonné authentifié.

**Migration SQL** : Retirer ces 5 tables de `supabase_realtime`. Tables conservées : `orders`, `notifications`, `shipments`, `order_status_history` (protégées par RLS au niveau table).

**Frontend** : Remplacer les listeners Realtime sur `messages` et `delivery_chats` par du polling (30s). Les composants concernés :
- `InternalChat` / `ConversationMessages` — polling des messages
- `DeliveryChat` — polling des messages livreur
- Les `support_messages` et `dispute_messages` utilisent déjà du polling via `useQuery`

---

## Faille 2 — Protéger le WhatsApp des boutiques

Actuellement, la politique `Public read stores` utilise `USING (true)` pour `{public}`, exposant `whatsapp_number`, `ban_reason`, `suspension_reason` à tous.

**Migration SQL** :
1. Supprimer la politique `Public read stores`
2. Créer 2 nouvelles politiques SELECT :
   - **Non authentifié** : accès limité aux colonnes non sensibles via une fonction `SECURITY DEFINER` qui retourne les données sans `whatsapp_number`, `ban_reason`, `suspension_reason` — OU plus simplement, remplacer par une politique qui redirige vers `stores_public` (la vue existe déjà)
   - **Authentifié** : `USING (true)` pour les colonnes de base + `whatsapp_number` visible uniquement via la table (les authentifiés peuvent contacter)
   
En pratique, l'approche la plus propre et sans casse :
- Garder `USING (true)` sur la politique SELECT de `stores` mais **pour `{authenticated}` uniquement** (pas `{public}`)
- Ajouter une politique SELECT `{anon}` avec `USING (true)` — les visiteurs non connectés passent par `stores_public` (vue sans colonnes sensibles)
- Le bouton WhatsApp sur `StorePage.tsx` et `VendorProfileCard.tsx` sera conditionné à l'authentification

**Frontend** :
- `StorePage.tsx` : requêter `stores_public` au lieu de `stores` pour les visiteurs non connectés, ou conditionner l'affichage du bouton WhatsApp à `session !== null`
- `VendorProfileCard.tsx` : conditionner le lien WhatsApp à l'utilisateur connecté
- `api.ts` (fetchProducts) : la requête inclut `whatsapp_number` dans le join `stores` — adapter pour ne l'inclure que si authentifié, ou accepter que les authentifiés y aient accès (comportement voulu)

---

## Faille 3 — error_reports : bloquer l'injection d'email

**Migration SQL** : Ajouter un trigger `BEFORE INSERT` sur `error_reports` qui force `user_email` à être dérivé du profil si `auth.uid()` est défini, ou `NULL` si anonyme. Empêche un attaquant d'injecter un email arbitraire.

**Frontend** : Dans `error-reporter.ts`, supprimer l'envoi de `user_email` depuis le client (le trigger s'en charge).

---

## Faille 4 — pwa_installs : restreindre la lecture

**Migration SQL** :
- Remplacer `Anyone can read pwa installs` (`USING (true)`, `{public}`) par :
  - Admins peuvent tout lire
  - Utilisateurs authentifiés ne lisent que leurs propres lignes (`user_id = auth.uid()`)
- Restreindre la politique INSERT : `WITH CHECK (user_id IS NULL OR user_id = auth.uid())`

---

## Faille 5 — rider_ratings : restreindre la lecture

**Migration SQL** : Remplacer `Authenticated read rider ratings` (`USING (true)`) par :
- L'auteur peut lire ses propres avis (`user_id = auth.uid()`)
- Le livreur concerné peut lire ses avis (`rider_id = auth.uid()`)
- Les admins/managers peuvent tout lire

---

## Faille 6 — service_plans

Déjà corrigée. La table s'appelle `service_packages` et la politique publique utilise déjà `USING (is_active = true)`. Aucune action nécessaire.

---

## Fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| Migration SQL | Retrait 5 tables du Realtime, nouvelles politiques RLS pour `stores`, `pwa_installs`, `rider_ratings`, trigger `error_reports` |
| `frontend/src/services/error-reporter.ts` | Supprimer `user_email` du payload client |
| `frontend/src/pages/StorePage.tsx` | Conditionner bouton WhatsApp à l'authentification |
| `frontend/src/components/VendorProfileCard.tsx` | Conditionner lien WhatsApp à l'authentification |
| Composants de chat (si Realtime utilisé) | Remplacer par polling si nécessaire |

## Fichier SQL téléchargeable

Conformément à SAFETY_POLICY, un fichier SQL complet sera généré pour synchronisation staging/production.

## Impact sur l'expérience utilisateur

- Les visiteurs non connectés voient toujours les boutiques et produits normalement
- Le bouton WhatsApp n'apparaît que pour les utilisateurs connectés (comportement logique : il faut un compte pour contacter un vendeur)
- Les messages et chats fonctionnent identiquement (polling au lieu de Realtime, délai max 30s)
- Aucun changement visible pour les admins

