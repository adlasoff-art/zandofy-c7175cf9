

# Plan : KPIs Financiers Avancés, Modération Avis & Audit Workflow

## Contexte & Diagnostic

Après analyse complète du code et de la base de données, voici l'état actuel et les lacunes identifiées :

### Ce qui existe déjà
- **Paiements commandes** : KPI basique dans OverviewTab (nombre réussis/échoués/en attente + montant total)
- **Modération avis** : Page admin `/admin/review-moderation` fonctionnelle avec approbation/suppression
- **Trigger bonus 0.10%** : `credit_review_bonus_points()` existe et fonctionne en base
- **Colonnes reviews** : `is_approved`, `reward_granted`, `approved_by`, `approved_at` — toutes présentes en production
- **ShippingPaymentModal** : Paiement shipping/last-mile via KelPay fonctionnel
- **Pipeline commandes** : Toutes les étapes existent (pending → delivered)

### Ce qui manque
1. **Pas de colonne `payment_type`** dans `payment_transactions` → impossible de distinguer paiement commande vs expédition vs livraison
2. **Pas de KPI shipping/last-mile** dans le dashboard admin
3. **Pas de KPI frais passerelle (2.5%)** → on ne calcule pas le net après déduction Mobile Money
4. **Pas de setting admin** pour configurer le % bonus avis (fixé en dur dans le trigger SQL)
5. **Pas de setting admin** pour configurer le % frais passerelle

---

## Tâches à implémenter

### 1. Migration DB : Ajouter `payment_type` à `payment_transactions`
- Ajouter colonne `payment_type TEXT DEFAULT 'order'` (valeurs : `order`, `shipping`, `last_mile`)
- Idempotent avec `IF NOT EXISTS`
- **Zone ORANGE** — Impact modéré, backward compatible

### 2. Mise à jour Edge Function `kelpay-payment` (ou code frontend)
- Le `ShippingPaymentModal` envoie déjà `payment_type` dans le body, mais l'edge function ne le stocke pas car elle n'existe plus dans `supabase/functions/`
- Il faudra s'assurer que lors de la création d'un `payment_transaction`, le `payment_type` est enregistré
- **Note** : L'edge function kelpay-payment a été déployée mais n'est plus dans le code source local. Elle devra être recréée ou mise à jour

### 3. Nouveaux KPIs dans le Dashboard Admin (OverviewTab ou nouvel onglet Finance)
Ajouter une section **"Revenus & Passerelle"** avec :
- **Paiements commandes** : Montant brut des paiements réussis pour les commandes
- **Paiements expédition** : Montant brut des paiements shipping réussis
- **Paiements livraison domicile** : Montant brut des paiements last-mile réussis
- **Frais passerelle (2.5%)** : Montant estimé prélevé par KelPay sur tous les paiements Mobile Money réussis
- **Revenu net plateforme** : Total brut - Frais passerelle
- **Preuves de paiement validées** : Montant des commandes avec `shipping_payment_proof_url` ou `last_mile_payment_proof_url` validées (quand `shipping_payment_status = 'paid'`)

### 4. Admin configurable : % bonus avis et % frais passerelle
- Ajouter dans `platform_settings` une entrée `gateway_fees` avec `{ mobile_money_fee_pct: 2.5 }`
- Ajouter une entrée `review_bonus` avec `{ bonus_pct: 0.10 }`
- Ajouter les contrôles dans `AdminSettingsPage.tsx`
- Mettre à jour le trigger SQL `credit_review_bonus_points` pour lire le % depuis `platform_settings` au lieu du 0.001 en dur

### 5. Audit du workflow commande (récapitulatif pour vous)
Le workflow complet est :
```text
awaiting_payment → pending → confirmed → preparing → in_shipping → shipped (hub) → [choix client] → assigning_rider → rider_assigned → out_for_delivery → delivered
```
- **Paiement initial** : Au checkout (KelPay ou COD)
- **Paiement expédition différé** : À l'étape `shipped` (arrivée hub), le client peut payer via ShippingPaymentModal
- **Paiement last-mile** : Avant passage à `out_for_delivery`, le client paie les frais de livraison domicile
- **Preuves manuelles** : Upload via `PaymentProofUpload` côté vendeur/client
- Tout est opérationnel côté flux. Le manque est uniquement côté reporting/KPI.

---

## Détails techniques

### Migration SQL
```sql
ALTER TABLE public.payment_transactions 
  ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'order';
```
+ Insertion des settings par défaut `gateway_fees` et `review_bonus` dans `platform_settings`.

### Fichiers modifiés
| Fichier | Type de modif |
|---|---|
| `supabase/migrations/new.sql` | Migration : `payment_type`, settings |
| `frontend/src/components/admin/dashboard/OverviewTab.tsx` | Ajout section KPIs financiers détaillés |
| `frontend/src/pages/admin/AdminSettingsPage.tsx` | Ajout contrôles % bonus avis + % frais passerelle |
| `frontend/src/pages/admin/AdminReviewModerationPage.tsx` | Afficher le % configurable au lieu de 0.10% en dur |
| `frontend/src/components/payments/ShippingPaymentModal.tsx` | Stocker `payment_type` dans la transaction |
| `supabase/functions/kelpay-payment/index.ts` | Recréer/mettre à jour pour stocker `payment_type` |
| Trigger SQL `credit_review_bonus_points` | Lire `bonus_pct` depuis `platform_settings` |

### Risques (conformément à la SAFETY_POLICY)
- **Zone ORANGE** : Modification du dashboard admin et des settings
- **Aucun risque Zone ROUGE** : Pas de modification du Header, Layout, Auth
- **Backward compatible** : La colonne `payment_type` a un DEFAULT, les données existantes seront marquées `order`
- Le trigger de bonus sera modifié pour lire un setting dynamique — fallback au 0.001 si le setting n'existe pas

