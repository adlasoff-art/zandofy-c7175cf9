

# Correction du toggle "Boutique plateforme" + Système de contestation vendeur

## Problème identifié

Le toggle ne fonctionne pas car la politique RLS sur la table `stores` pour UPDATE ne permet que `owner_id = auth.uid()`. L'administrateur n'est pas le propriétaire des boutiques tierces, donc la mise à jour de `is_platform_owned` échoue silencieusement (0 rows updated, pas d'erreur retournée).

## Plan d'implémentation

### 1. Migration SQL

**a) Ajouter une politique RLS admin UPDATE sur `stores`**
```sql
CREATE POLICY "Admins update any store"
  ON public.stores FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
```

**b) Créer la table `platform_ownership_claims`** pour gérer les contestations vendeur (72h)
- `id`, `store_id` (FK stores), `vendor_id` (owner), `status` (pending/accepted/expired/dismissed), `created_at`, `resolved_at`, `expires_at` (created_at + 72h)
- RLS : vendeurs lisent/créent les leurs, admins voient tout

**c) Trigger** : quand `stores.is_platform_owned` passe de `false` à `true`, insérer automatiquement une notification au `owner_id` + créer un claim `pending` avec `expires_at = now() + interval '3 days'`.

### 2. Page `AdminVendorPricingPage.tsx` — Correction du save

Après le `.update({ is_platform_owned })`, vérifier le résultat (`data`, `error`, `count`) et afficher un toast d'erreur si ça échoue. Actuellement l'erreur RLS passe inaperçue car le code ne vérifie pas le résultat du update sur stores.

### 3. Notification vendeur (app + email)

Quand l'admin active `is_platform_owned` :
- **Notification in-app** : insérée via le trigger SQL dans `notifications` (type: `system`, lien vers `/vendor`)
- **Email** : envoyé via le service SMTP existant (appel depuis le code frontend après save réussi, ou via une edge function)

### 4. Bouton "Revendiquer indépendante" côté vendeur

Dans `VendorDashboardPage.tsx`, afficher une **bannière d'alerte** quand :
- Le store a `is_platform_owned = true`
- Il existe un claim `pending` non expiré pour ce store

La bannière affiche : "Votre boutique a été marquée comme appartenant à la plateforme. Si c'est une erreur, vous avez jusqu'au [date] pour contester."

Bouton "Revendiquer indépendante" → crée/met à jour le claim et notifie l'admin.

Après 72h (expires_at dépassé), le bouton disparaît et le statut est considéré confirmé.

### 5. Vue admin des contestations

Dans `AdminVendorPricingPage.tsx`, afficher un badge "Contestation en cours" à côté des boutiques ayant un claim `pending`. L'admin peut voir le détail et choisir d'accepter (repasser en indépendant) ou de rejeter.

### Résumé des fichiers

| Fichier | Action |
|---------|--------|
| Migration SQL | RLS admin update stores + table `platform_ownership_claims` + trigger notification |
| `AdminVendorPricingPage.tsx` | Fix save, vérifier résultat update, badge contestation |
| `VendorDashboardPage.tsx` | Bannière alerte + bouton "Revendiquer indépendante" |
| `AdminSidebar.tsx` | Pas de changement (contestations visibles inline) |

