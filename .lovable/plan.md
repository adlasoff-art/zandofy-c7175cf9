

## Plan : 4 fonctionnalités restantes

### 1. Impersonation admin fonctionnelle

**Problème** : L'edge function `impersonate-user` retourne les infos du user cible mais ne génère PAS de token de session. Le frontend attend `access_token` + `refresh_token` qui n'arrivent jamais, donc rien ne se passe.

**Solution** : Utiliser `supabaseAdmin.auth.admin.generateLink({ type: 'magiclink', email })` pour obtenir un lien de login, puis extraire le token. Alternative plus fiable : utiliser `supabaseAdmin.auth.admin.createUser` n'est pas applicable ici. La meilleure approche pour Supabase est d'utiliser un **mode lecture seule en local** :

- Modifier l'edge function pour qu'elle retourne les données complètes du user cible (profil, rôles, commandes récentes, stats).
- Côté frontend, au lieu de switcher de session (risque de sécurité), ouvrir un **panneau d'impersonation** qui affiche le dashboard tel que le voit l'utilisateur cible, en chargeant ses données via l'admin (service role dans l'edge function).
- Ajouter un bandeau jaune "Mode impersonation — Vous voyez le compte de [nom]" avec un bouton "Quitter".

**Fichiers modifiés** :
| Fichier | Changement |
|---------|-----------|
| `frontend/supabase/functions/impersonate-user/index.ts` | Retourner données complètes (commandes, stats, adresses, wallet) via service role |
| `frontend/src/components/admin/UserDetailDrawer.tsx` | Stocker les données retournées et ouvrir le panneau impersonation |
| `frontend/src/components/admin/ImpersonationPanel.tsx` | **Nouveau** — Dashboard lecture seule affichant les données du user cible |
| `frontend/src/contexts/ImpersonationContext.tsx` | **Nouveau** — Context pour gérer l'état d'impersonation global + bandeau |

### 2. Relance de paiement depuis le dashboard client

**Problème** : Quand un paiement Mobile Money échoue ou reste en `awaiting_payment`, le client doit recréer une commande au lieu de relancer le paiement.

**Solution** :
- Dans `DashboardPage.tsx`, pour les commandes en statut `awaiting_payment` ou `payment_failed`, afficher un bouton "Relancer le paiement".
- Au clic, appeler `kelpay-payment` avec l'`order_id` existant (qui crée une nouvelle `payment_transaction` liée à la même commande).
- Réutiliser le même flux USSD/polling que le checkout.
- Créer un composant `RetryPaymentModal` avec le formulaire numéro de téléphone + opérateur.

**Fichiers modifiés** :
| Fichier | Changement |
|---------|-----------|
| `frontend/src/components/payments/RetryPaymentModal.tsx` | **Nouveau** — Modal de relance paiement (numéro, opérateur, polling) |
| `frontend/src/pages/DashboardPage.tsx` | Bouton "Relancer" sur les commandes `awaiting_payment` / `payment_failed`, ouvre le modal |
| `frontend/supabase/functions/kelpay-payment/index.ts` | Accepter les relances (vérifier que la commande appartient au user, créer nouvelle transaction) |

### 3. Expiration automatique des commandes `awaiting_payment`

**Solution** : Edge function cron qui passe les commandes `awaiting_payment` datant de +30 minutes en `payment_failed`.

**Fichiers** :
| Fichier | Changement |
|---------|-----------|
| `frontend/supabase/functions/expire-pending-orders/index.ts` | **Nouveau** — Requête UPDATE orders SET status='payment_failed' WHERE status='awaiting_payment' AND created_at < now() - interval '30 minutes' |

**SQL** (via insert tool, pas migration) : Créer le cron job `pg_cron` qui appelle cette function toutes les 5 minutes.

### 4. Filtrage vendeur : masquer commandes non abouties

**Problème** : `VendorOrderManager.tsx` charge toutes les commandes du store sans filtrer.

**Solution** : Ajouter `.not("status", "in", "(awaiting_payment,payment_failed)")` à la requête du vendeur pour ne montrer que les commandes dont le paiement est confirmé.

**Fichier modifié** :
| Fichier | Changement |
|---------|-----------|
| `frontend/src/components/vendor/VendorOrderManager.tsx` | Filtrer les statuts `awaiting_payment` et `payment_failed` de la requête |

---

### SQL à exécuter (insert tool, pas migration)

```sql
-- Activer pg_cron et pg_net si pas déjà fait
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Cron : expirer les commandes awaiting_payment > 30 min, toutes les 5 min
SELECT cron.schedule(
  'expire-pending-orders',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://uogkklwfvwoxkifpkzpu.supabase.co/functions/v1/expire-pending-orders',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZ2trbHdmdndveGtpZnBrenB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4ODY0MzcsImV4cCI6MjA4NzQ2MjQzN30.9NhIOytfsQ7Gdufs0goV6Lk97IyMkda362jh3IGMVi4"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

---

### Résumé : 7 fichiers modifiés/créés

| # | Fichier | Action |
|---|---------|--------|
| 1 | `frontend/supabase/functions/impersonate-user/index.ts` | Modifier — retourner données complètes |
| 2 | `frontend/src/components/admin/ImpersonationPanel.tsx` | Créer — vue lecture seule |
| 3 | `frontend/src/contexts/ImpersonationContext.tsx` | Créer — contexte + bandeau |
| 4 | `frontend/src/components/admin/UserDetailDrawer.tsx` | Modifier — intégrer impersonation panel |
| 5 | `frontend/src/components/payments/RetryPaymentModal.tsx` | Créer — relance paiement |
| 6 | `frontend/src/pages/DashboardPage.tsx` | Modifier — bouton relance |
| 7 | `frontend/supabase/functions/expire-pending-orders/index.ts` | Créer — cron expiration |
| 8 | `frontend/src/components/vendor/VendorOrderManager.tsx` | Modifier — filtrer commandes |

