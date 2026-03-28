

# Plan : Corrections de sécurité P0/P1 + Templates email paiements

## Ce qui est EXCLU (en attente de KelPay)
- Point 3 : Vérification HMAC du callback KelPay → Nécessite le webhook secret de KelPay

---

## Tâche 1 — P0 : Sanitiser autocomplete (search.ts)

**Fichier** : `frontend/src/services/search.ts` ligne 105
- Appliquer `sanitizeLike(query)` dans `autocompleteProducts()` comme c'est déjà fait dans `searchProducts()`
- Changement d'une seule ligne

---

## Tâche 2 — P0 : Supprimer le bypass maintenance hardcodé

**Fichier** : `frontend/src/components/MaintenancePage.tsx` lignes 107-119
- Supprimer entièrement le bloc invisible `onDoubleClick` qui contient le code `"zandofy-admin-bypass"` en clair
- **Fichier** : `frontend/src/components/MaintenanceGuard.tsx` lignes 74, 94
- Supprimer les vérifications `sessionStorage.getItem("maintenance_bypass")` — les admins passent déjà via la vérification de rôle `isAdmin` (ligne 91), ce bypass est redondant et dangereux

---

## Tâche 3 — P1 : Sécuriser send-email (contrôle de rôle)

**Fichier** : `frontend/supabase/functions/send-email/index.ts`
- Ajouter une vérification de rôle admin/manager avant d'autoriser l'envoi
- Vérifier que le `to` est un email valide (regex basique)
- Redéployer la fonction

---

## Tâche 4 — P1 : CORS dynamique sur les Edge Functions sensibles

**Fonctions concernées** : `send-email`, `admin-users`, `impersonate-user`
- Remplacer `"Access-Control-Allow-Origin": "*"` par une lecture de `SITE_BASE_URL` pour restreindre l'origin
- Les fonctions publiques (callback KelPay, generate-sitemap) restent en wildcard car elles doivent accepter des requêtes externes

---

## Tâche 5 — Templates email pour paiements shipping et last-mile

**Fichier** : `frontend/supabase/functions/notify-order-status/index.ts`
- Ajouter des templates pour les événements de paiement (pas juste les statuts de commande)
- Créer une nouvelle Edge Function ou étendre `kelpay-callback` pour déclencher un email spécifique quand un paiement shipping ou last-mile réussit

Templates à créer :
| Template | Déclencheur | Contenu |
|---|---|---|
| `shipping_payment_success` | Paiement expédition réussi via KelPay | "Votre paiement de $X pour l'expédition de la commande #REF a été confirmé" |
| `last_mile_payment_success` | Paiement livraison domicile réussi | "Votre paiement de $X pour la livraison à domicile de la commande #REF a été confirmé" |

**Implémentation** : Dans `kelpay-callback/index.ts`, après la mise à jour réussie d'un paiement shipping/last_mile, invoquer `notify-order-status` avec un type étendu ou envoyer directement l'email via SMTP avec le template approprié.

---

## Fichiers modifiés

| Fichier | Modification |
|---|---|
| `frontend/src/services/search.ts` | sanitizeLike sur autocomplete |
| `frontend/src/components/MaintenancePage.tsx` | Suppression bypass hardcodé |
| `frontend/src/components/MaintenanceGuard.tsx` | Suppression sessionStorage bypass |
| `frontend/supabase/functions/send-email/index.ts` | Ajout vérif rôle admin |
| `frontend/supabase/functions/send-email/index.ts` | CORS dynamique |
| `frontend/supabase/functions/admin-users/index.ts` | CORS dynamique |
| `frontend/supabase/functions/impersonate-user/index.ts` | CORS dynamique |
| `frontend/supabase/functions/kelpay-callback/index.ts` | Envoi email après paiement shipping/last_mile |
| `frontend/supabase/functions/notify-order-status/index.ts` | Ajout templates paiement |

## Risques
- **Zone ORANGE** : Modifications des Edge Functions et du MaintenanceGuard
- **Aucun risque Zone ROUGE** : Pas de modification du Header, Layout, Auth principal
- **Backward compatible** : Les admins utilisent déjà le bypass par rôle, la suppression du bypass secret ne casse rien

