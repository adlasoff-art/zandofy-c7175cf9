## Problème 1 — Page Flotte Opérateur

### 1A. Le rider affiche "KYC en attente" même après approbation admin

**Cause** : la carte du livreur est rouge orange basée sur `delivery_operator_riders.status` (`kyc_required` / `pending`) et sur `missing_steps` calculés par `get_riders_kyc_overview`.

Quand l'admin approuve le KYC du user (`user_kyc.kyc_status = 'approved'`) sans avoir ajouté la pièce verso :
- la table `delivery_operator_riders` n'est jamais resynchronisée → `status` reste à `kyc_required` ;
- `get_riders_kyc_overview` continue à lister `document_back` dans `missing_steps` car elle se base sur les fichiers présents, sans tenir compte du fait que l'admin a explicitement validé un dossier sans verso.

**Correction** :

a) **Trigger DB** : à chaque `UPDATE` sur `user_kyc` qui passe à `kyc_status = 'approved'`, mettre à jour tous les rattachements `delivery_operator_riders` de ce user où `status IN ('kyc_required','pending')` → `status = 'active'` + `activated_at = now()`.

b) **RPC `get_riders_kyc_overview`** : si `user_kyc.kyc_status = 'approved'`, forcer `missing_steps = []` et `kyc_status = 'approved'` dans le retour (le verso devient optionnel par décision admin).

c) **Composant `RiderCard`** : recalculer `needsKyc` en tenant compte de `kyc.kyc_status === 'approved'` → ne plus afficher l'encart orange et masquer le bouton « Relancer par email » dans ce cas.

### 1B. « Failed to send a request to the Edge Function » sur Relancer par email

**Cause racine** : la fonction `operator-remind-rider-kyc` a été créée dans `supabase/functions/` (racine du repo), mais le workflow `.github/workflows/deploy-edge-functions.yml` est configuré avec `working-directory: frontend` et `supabase functions deploy` → il ne déploie **que** ce qui est sous `frontend/supabase/functions/`. La fonction n'a donc jamais touché la prod (`vpt...yxf`). Le fetch retourne un network error → toast « Failed to send a request to the Edge Function ».

D'autres fonctions du Lot 11B (`operator-invite-rider`, `operator-decide-order`…) sont bien sous `frontend/supabase/functions/` → elles fonctionnent. C'est la nouvelle qui est à la mauvaise adresse.

**Correction** :

a) Déplacer `supabase/functions/operator-remind-rider-kyc/index.ts` → `frontend/supabase/functions/operator-remind-rider-kyc/index.ts` (`_shared/email.ts` existe déjà côté frontend, aucun ajustement d'import nécessaire).

b) Supprimer le doublon racine pour ne garder qu'une seule source de vérité.

c) Après le merge sur `main`, le workflow déploie automatiquement la fonction sur la prod Supabase.

**Note (Bug 1A appliqué d'abord rend Bug 1B caduc** sur ce livreur précis : le bouton disparaîtra. La fonction reste utile pour les autres riders réellement en attente.)

---

## Problème 2 — Admin > Transitaires > Modifier > « Compte transporteur lié »

### Comportement actuel

`TransporterUserPicker` (le combobox d'email) appelle la RPC `admin_search_users(p_query, p_limit)` qui cherche **tous les profils** par email/prénom/nom (sans filtre de rôle). Un admin doit donc taper au moins 2 caractères puis sélectionner.

### Pourquoi ça affiche « Aucun utilisateur trouvé » même avec l'email exact

Trois causes possibles, à vérifier dans cet ordre :

1. **RPC absente en prod** : la migration `20260423234042_…_admin_search_users.sql` est sous `supabase/migrations/` (racine) et non sous `frontend/supabase/migrations/`. Selon la convention prod, seules les migrations dans `frontend/supabase/migrations/` partent sur la base prod via la pipeline. → À vérifier avec `select proname from pg_proc where proname='admin_search_users'` sur la prod.

2. **Le RPC lève `Forbidden`** silencieusement si `has_role(auth.uid(), 'admin')` est `false` pour la session courante (ex. JWT expiré, rôle perdu).

3. **Cas légitime** : aucun profil ne matche réellement (casse différente, espaces, profil non créé pour l'email du futur transitaire).

### Refonte UX demandée — afficher uniquement les comptes « Transitaire »

L'utilisateur veut qu'apparaissent **uniquement les profils qui ont le rôle `forwarder`** dans `user_roles`. C'est plus sûr (pas de fuite d'info) et plus clair : on lie un compte qui sait déjà se connecter à l'espace transitaire.

**Correction** :

a) **Nouvelle RPC `admin_search_forwarder_users(p_query, p_limit)`** (admin-only, security definer), identique à `admin_search_users` mais avec `INNER JOIN user_roles ur ON ur.user_id = p.id AND ur.role = 'forwarder'`. Si `p_query` est vide ou `null`, retourner les **20 premiers** transitaires par ordre alpha (au lieu de ne rien retourner) — pour que l'admin voie immédiatement la liste à l'ouverture.

b) **`TransporterUserPicker`** :
   - Appeler `admin_search_forwarder_users` au lieu de `admin_search_users`.
   - Activer la query dès l'ouverture du popover (même sans query) pour pré-afficher la liste des transitaires existants.
   - Mettre à jour le placeholder + texte d'aide : « Seuls les utilisateurs ayant le rôle Transitaire apparaissent ici. Ajoutez d'abord le rôle dans Admin > Utilisateurs. ».
   - Conserver la recherche par email/nom pour les bases avec beaucoup de transitaires.

c) **Migration** côté `frontend/supabase/migrations/` (chemin déployé en prod) pour que la nouvelle RPC arrive bien sur `vpt...yxf`. Et faire pareil pour la migration historique `admin_search_users` si elle manque réellement en prod (à confirmer par lecture pg_proc avant).

### Logique finale, pour qu'on s'aligne

Un compte apparaîtra dans le sélecteur « Compte transporteur lié » **si et seulement si** :
- il existe une ligne `profiles` avec un email ou un nom qui matche la recherche (ou si la recherche est vide → top 20) ;
- ET ce profil a une ligne dans `user_roles` avec `role = 'forwarder'` ;
- ET la session courante a le rôle `admin` (gate de la RPC).

Workflow opérateur attendu :
1. Admin > Utilisateurs > attribuer le rôle « Transitaire » au user lambda (déjà fait).
2. Admin > Transitaires > Modifier la fiche → ouvrir « Compte transporteur lié » → la liste contient maintenant le user. Sélectionner. Sauvegarder.
3. Le user se connecte, voit son espace transitaire avec les commandes, paramètres, zones couvertes, etc., **liés à la configuration choisie**.

---

## Récapitulatif des changements

### Code
- `frontend/src/pages/operator/OperatorFleetPage.tsx` — recalculer `needsKyc` via `kyc.kyc_status`.
- `frontend/src/components/admin/forwarders/TransporterUserPicker.tsx` — appeler la nouvelle RPC, query active dès l'ouverture, copy mise à jour.
- **Déplacer** `supabase/functions/operator-remind-rider-kyc/` → `frontend/supabase/functions/operator-remind-rider-kyc/`.

### Migrations (sous `frontend/supabase/migrations/`)
- Trigger `sync_kyc_approved_to_operator_riders` sur `user_kyc`.
- Mise à jour de `get_riders_kyc_overview` (court-circuit si approved).
- Création RPC `admin_search_forwarder_users`.
- (Si confirmé manquant en prod) re-création de `admin_search_users` côté frontend.

### Hors scope
- Pas de changement du workflow GitHub Actions (la convention `frontend/supabase/functions/` reste la règle).
- Pas de changement à `delivery_operators` ni au schéma transitaire.
- Pas de notification email automatique aux opérateurs lors de l'approbation KYC (on peut l'ajouter dans un lot suivant si tu le veux).

### Validation après déploiement
1. Sur la fiche du livreur Mike Adlas : la pastille passe « Actif », l'encart orange disparaît, le bouton « Relancer par email » disparaît.
2. Sur un autre rider réellement en attente : « Relancer par email » répond « Rappel envoyé », puis 2ᵉ clic → « Rappel déjà envoyé récemment ».
3. Admin > Transitaires > Modifier : ouvrir le picker → liste des transitaires existants visible immédiatement, recherche par email fonctionne, le user lambda passé en rôle forwarder apparaît bien.
