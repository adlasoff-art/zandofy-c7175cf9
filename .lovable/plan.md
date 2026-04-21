

# Fonctionnalité « Trouvez-moi ce produit » (Product Sourcing Requests)

Permettre aux clients connectés (mobile uniquement) de soumettre une demande de recherche pour un produit absent de la plateforme, et donner aux admins/managers un back-office pour répondre et nettoyer.

## Vue d'ensemble du flux

```text
CLIENT (mobile, connecté)              ADMIN / MANAGER
─────────────────────────              ──────────────────
Header → 🔍 icône (avant 🔔)           Sidebar → Catalogue → Demandes produits
   ↓                                       ↓
/sourcing → formulaire                  Liste paginée des demandes
   • nom (optionnel)                       • voir images, nom, client
   • 0-2 images (≤ 4 Mo total)             • répondre (form complet)
   • max 5 soumissions / jour              • bouton "Nettoyer ≥ X jours"
   ↓                                       ↓
Soumission → notification admin         Réponse → notification + email opt-in
   ↓                                                    au client
"Mes demandes" dans /sourcing
   • statut (en attente / répondue / fermée)
   • détails de la réponse (prix, MOQ, couleurs, image)
```

## 1. Base de données (1 migration)

### Tables
- **`product_sourcing_requests`** — demande client
  - `id`, `user_id` (FK profiles, NOT NULL), `product_name` (text, nullable, max 200), `note` (text, max 500), `images` (text[], max 2 URLs), `status` (`pending`/`answered`/`closed`), `created_at`, `updated_at`
- **`product_sourcing_responses`** — réponse admin (1-1 avec request)
  - `id`, `request_id` (FK CASCADE, unique), `responder_id`, `product_name`, `description`, `price`, `currency` (default 'USD'), `min_quantity` (int), `colors` (text[] limité à un set prédéfini), `image_url`, `notify_email_sent` (bool), `created_at`, `updated_at`

### RLS (suit le pattern existant `has_role`)
- **client** : `SELECT/INSERT` sur ses propres demandes uniquement (`user_id = auth.uid()`)
- **client** : `SELECT` sur la réponse liée à ses demandes
- **admin/manager** : `SELECT/UPDATE/DELETE` sur tout
- **admin/manager** : `INSERT/UPDATE/DELETE` sur `product_sourcing_responses`

### Trigger rate-limit (anti-spam serveur, défense en profondeur)
- `BEFORE INSERT` sur `product_sourcing_requests` : refuse si `count(user_id, today) >= 5` → `RAISE EXCEPTION`. Aligné avec la limite UI 5/jour.

### Fonction de nettoyage
- `cleanup_sourcing_requests(p_older_than_days int)` SECURITY DEFINER, search_path public, restreinte via RLS d'appel (admin only via Edge Function ou check `has_role` interne) : supprime requests + responses + retire les fichiers du bucket via Storage API côté Edge Function.

### Storage
- Bucket **`sourcing-images`** privé (lecture admin + propriétaire), policies :
  - INSERT : `auth.uid() = (storage.foldername(name))[1]::uuid` (path = `{user_id}/...`)
  - SELECT : owner OR `has_role('admin'/'manager')`
  - DELETE : admin/manager
- Limite serveur via Edge Function de validation (taille cumulée 4 Mo, max 2 fichiers, MIME image only).

### Notifications & email
- Trigger `AFTER INSERT` sur la table → insère une `notifications` pour chaque admin (type `system`).
- Email batché : Edge Function planifiée (cron 30 min) qui envoie 1 mail récapitulatif quand ≥ 5 nouvelles demandes non notifiées par email s'accumulent. Utilise l'infra email existante (Hostinger SMTP / `notify-*` pattern).

## 2. Frontend client

### Header (`Header.tsx`)
- Nouvelle icône `PackageSearch` ou `Sparkles` insérée **juste avant** le bloc `NotificationCenter` (ligne ~245), affichée seulement si `user` (déjà le pattern existant).
- Lien vers `/sourcing`.
- Petit badge de point coloré si une de ses demandes est passée à `answered` et non lue.

### MobileAccountMenu (`MobileAccountMenu.tsx`)
- Nouvelle entrée dans la section « Paramètres du compte » (ou section dédiée « Aide produit ») : `{ to: "/sourcing", icon: PackageSearch, label: "Trouvez-moi ce produit" }`.

### Page `/sourcing` (nouveau `SourcingPage.tsx`)
- Protégée : redirige vers `/auth` si non connecté (pattern `AccountPage`).
- 2 onglets : **Nouvelle demande** / **Mes demandes**.
- Formulaire :
  - Input nom (optionnel, max 200)
  - Textarea note (optionnel, max 500)
  - Upload max 2 images, validation client : `file.type.startsWith('image/')`, cumul ≤ 4 Mo. Compteur visible.
  - Bouton « Envoyer » désactivé si quota atteint (fetch count du jour côté Supabase).
  - Validation Zod (cohérent avec les durcissements forwarders récents).
- Liste « Mes demandes » : carte avec statut, miniatures, et si `answered` → carte de la réponse (image, prix, MOQ, couleurs en pastilles).
- Section explicative en bas : « À quoi sert cette page », icônes, exemples.

### Route
- Ajout dans `App.tsx` : `<Route path="/sourcing" element={<BanGuard><SourcingPage /></BanGuard>} />`

## 3. Back-office admin

### Page `AdminProductSourcingPage.tsx`
- Accès via `RoleGuard allowedRoles={["admin","manager"]}`.
- Sidebar : nouvelle entrée sous **Catalogue** (groupe existant) → « Demandes produits ».
- UI :
  - Liste paginée filtrable par statut + recherche.
  - Détail latéral : nom, note, images (lightbox), profil client.
  - Formulaire de réponse :
    - nom produit, description, prix + devise, MOQ, image (upload bucket admin existant ou nouveau), couleurs via `Select` multi sur palette **25 nuances prédéfinies** (constante TS partagée `SOURCING_COLOR_PALETTE`).
    - case « Notifier le client par email » (optionnelle, false par défaut) → déclenche Edge Function `notify-sourcing-response`.
  - Bouton **Nettoyer** : ouvre `AlertDialog` (cohérent avec hardening forwarders), choix période (`7j` / `30j` / `90j` / custom date) → appelle Edge Function `cleanup-sourcing` qui supprime images Storage + lignes DB.

## 4. Edge Functions (3)
- **`submit-sourcing-request`** (verify_jwt=true) : validation Zod, check rate limit (defense en profondeur), upload images dans `sourcing-images/{user_id}/`, insert request, insert notif admins.
- **`notify-sourcing-response`** (verify_jwt=true, admin only via `has_role`) : envoie email au client via SMTP existant si demandé.
- **`cleanup-sourcing`** (verify_jwt=true, admin only) : reçoit `older_than_days`, liste les requests, supprime fichiers Storage par batch, puis DELETE en cascade.
- Cron PG (existant `pg_cron`) : email digest admin (≥ 5 nouvelles non notifiées, max 1×/30 min).

## 5. Sécurité (cohérent avec score actuel ~96/100)
- RLS strict (client = ses lignes, admin/manager = tout).
- Trigger rate-limit serveur en plus de la limite UI.
- Bucket privé + policies par dossier `{user_id}`.
- Validation Zod côté client + côté Edge Function (taille, MIME, longueurs).
- Pas de `dangerouslySetInnerHTML`, pas de SQL brut, secrets non exposés.
- Email digest batché → évite le spam, conforme à la mémoire `notification-segmentation`.
- Cleanup admin-only via Edge Function (jamais SQL côté client).

## 6. Détails techniques

**Fichiers créés**
- `frontend/src/pages/SourcingPage.tsx`
- `frontend/src/pages/admin/AdminProductSourcingPage.tsx`
- `frontend/src/components/sourcing/SourcingRequestForm.tsx`
- `frontend/src/components/sourcing/SourcingRequestCard.tsx`
- `frontend/src/components/admin/sourcing/SourcingResponseDialog.tsx`
- `frontend/src/components/admin/sourcing/SourcingCleanupDialog.tsx`
- `frontend/src/lib/sourcing-palette.ts` (25 couleurs)
- `frontend/supabase/functions/submit-sourcing-request/index.ts`
- `frontend/supabase/functions/notify-sourcing-response/index.ts`
- `frontend/supabase/functions/cleanup-sourcing/index.ts`
- `frontend/supabase/functions/sourcing-email-digest/index.ts` (cron)
- `frontend/supabase/migrations/20260421130000_product_sourcing_init.sql`

**Fichiers modifiés**
- `frontend/src/components/Header.tsx` (icône avant Notification)
- `frontend/src/components/MobileAccountMenu.tsx` (entrée menu)
- `frontend/src/components/admin/AdminSidebar.tsx` (lien Catalogue)
- `frontend/src/App.tsx` (routes `/sourcing` + `/admin/sourcing`)

**Migration SQL téléchargeable** : un seul fichier `20260421130000_product_sourcing_init.sql` fourni en artifact pour exécution prod (cohérent avec la SOP : Lovable Cloud auto-déployée, prod via GitHub Actions / artifact manuel).

**i18n** : toutes les chaînes via `t("sourcing.*")` ajoutées à `I18nContext.tsx` (FR/EN), conforme à la mémoire `centralized-i18n-refactor-logic`.

**Toggle de sécurité** : pas de toggle nécessaire (feature isolée, n'impacte pas le checkout). Aucun risque pour les 4000 utilisateurs/jour.

