

# Plan d'implémentation — Corrections et améliorations

## Résumé des changements

Quatre chantiers principaux :
1. Cartes produits non-cliquables dans les pages catégories
2. Journal d'audit élargi (activité utilisateurs + pagination + nettoyage auto)
3. Emails de confirmation de commande non délivrés + testeur de délivrabilité
4. Réflexion sur les push notifications (pas d'action)

---

## 1. Cartes produits non-cliquables dans les catégories

**Problème identifié** : Dans `CategoryPage.tsx`, le composant `<ProductCard>` n'est PAS enveloppé dans un `<Link>`, contrairement à `StorePage`, `SearchPage` et `ProductPage` (produits similaires) où il l'est. De plus, le `mapProduct` local ne remonte ni `galleryImages` ni `slug`, ce qui empêche le hover d'image et le lien vers le produit.

**Corrections** :
- **`CategoryPage.tsx`** : Envelopper chaque `<ProductCard>` dans un `<Link to={/product/${p.slug || p.id}}>` avec `cursor-pointer`
- **`CategoryPage.tsx` — `mapProduct`** : Ajouter les champs manquants : `slug`, `galleryImages`, `storeIsCertified`, `storeIsVerified` depuis la requête (le select inclut déjà `product_images`)
- Appliquer la même correction à `WishlistPage.tsx` et `SharedWishlistPage.tsx` si même problème

---

## 2. Journal d'audit élargi

**Situation actuelle** : La table `admin_audit_logs` ne trace que les actions admin (ban, rôle, warning). La table `user_activity_logs` existe (hook `use-activity-logger.ts`) mais n'est pas exploitée dans le journal d'audit admin.

**Changements** :

### Base de données (migration SQL)
- Créer une table `user_activity_logs` si elle n'existe pas encore (vérification nécessaire), avec colonnes : `id`, `user_id`, `action`, `metadata` (jsonb), `created_at`
- Ajouter les RLS appropriées (lecture admin/manager uniquement)
- Créer une fonction `cleanup_old_activity_logs()` en PL/pgSQL avec la logique de rétention :
  - Après 6 mois : supprimer les entrées de plus de 6 mois
  - Après 1 an : garder seulement les 6 derniers mois (juin-décembre)
- Planifier un job `pg_cron` mensuel pour le nettoyage automatique

### Actions utilisateurs tracées (ajout au hook existant)
- `login`, `logout`, `profile_update`, `search`, `page_view`
- `address_add/delete`, `payment_method_add/delete`
- `order_placed`, `order_cancelled`
- `product_add`, `product_update`, `product_delete` (vendeurs)
- `kyc_submitted`, `password_changed`, `settings_changed`

### Interface admin (`AdminAuditPage.tsx`)
- **Onglets** : "Actions admin" (existant) + "Activité utilisateurs" (nouveau)
- **Pagination** : Limiter à 50 par page avec navigation
- **Filtres** :
  - Par utilisateur (recherche par nom/email)
  - Par type d'action (chips existants étendus)
  - Par période (date de début / date de fin)
- **Nettoyage manuel** : Bouton pour purger les logs de plus de X mois (admin uniquement)

---

## 3. Emails de confirmation de commande

### Diagnostic
Les secrets SMTP sont configurés (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_EMAIL`, `SMTP_PORT`). La fonction `notify-order-status` est censée envoyer les emails via SMTP/nodemailer. Aucun log n'est trouvé, ce qui suggère que la fonction n'est pas invoquée correctement ou pas déployée.

### Problèmes identifiés
1. **`order-notifications.ts`** : Le service client utilise `supabase.functions.invoke("notify-order-status")` mais la liste des statuts notifiables ne contient PAS `"pending"` — or c'est le statut défini après paiement Mobile Money réussi (`kelpay-callback` met le statut à `"pending"`)
2. **Paiement hors plateforme** : Quand le vendeur confirme le paiement, il faut aussi déclencher la notification

### Corrections
- **`order-notifications.ts`** : Ajouter `"pending"` à la liste `NOTIFIABLE_STATUSES`
- **`VendorOrderManager.tsx`** : S'assurer que lorsqu'un vendeur confirme un paiement hors plateforme (passage de `awaiting_payment` → `confirmed`), `triggerOrderStatusNotification` est bien appelé
- **Redéployer** la fonction `notify-order-status` pour s'assurer qu'elle est active
- **Vérifier** que le lien de suivi dans l'email pointe vers le bon domaine (actuellement `zandofy.lovable.app` — devrait utiliser `SITE_BASE_URL`)

### Testeur de délivrabilité email (admin)
- **`AdminNotificationsPage.tsx`** : Ajouter une section "Test de délivrabilité" avec :
  - Un champ email libre
  - Un bouton "Envoyer un email test"
  - Appel à `send-email` edge function avec un message par défaut
  - Affichage du résultat (succès/échec avec détail de l'erreur)

### Emails via le centre de notifications admin
- Le canal "Email" dans le centre de notifications insère seulement dans la table `notifications` (in-app) — il n'envoie PAS réellement d'emails SMTP
- **Correction** : Quand le canal est "email", appeler aussi la fonction `send-email` pour chaque destinataire (avec un template générique contenant titre + message)

---

## 4. Push notifications (réflexion uniquement)
Les VAPID keys sont configurées. Le service worker `sw-push.js` existe. La table `push_subscriptions` existe. Pour que les push fonctionnent sur mobile (PWA) :
- L'utilisateur doit avoir autorisé les notifications dans le navigateur
- Le service worker doit être enregistré et actif
- Le `notify-order-status` tente déjà d'envoyer des push mais marque seulement "attempted" sans réellement utiliser web-push

Pas d'action immédiate — juste un constat pour plus tard.

---

## Fichiers impactés

| Fichier | Type de changement |
|---|---|
| `frontend/src/pages/CategoryPage.tsx` | Link + mapProduct enrichi |
| `frontend/src/pages/WishlistPage.tsx` | Link wrapper |
| `frontend/src/pages/SharedWishlistPage.tsx` | Link wrapper |
| `frontend/src/pages/admin/AdminAuditPage.tsx` | Refonte complète (onglets, pagination, filtres) |
| `frontend/src/services/order-notifications.ts` | Ajout "pending" aux statuts |
| `frontend/src/pages/admin/AdminNotificationsPage.tsx` | Testeur email + envoi SMTP réel |
| `frontend/supabase/functions/notify-order-status/index.ts` | URL dynamique via SITE_BASE_URL |
| Migration SQL | Table user_activity_logs + cleanup cron |

## Migrations SQL (fichier téléchargeable fourni après implémentation)
- `user_activity_logs` : table + RLS + index
- Fonction et cron de nettoyage automatique des logs

