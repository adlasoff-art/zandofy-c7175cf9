

# Plan : Page de retour paiement + Ajout PayPal + Refactoring carte bancaire + Tokenisation

## Résumé

Implémenter ce qui est faisable immédiatement sans attendre la doc Keccel : la page `/payment/return`, l'ajout de PayPal comme méthode de paiement, le remplacement du formulaire Stripe factice, la table de tokenisation cartes, et l'edge function squelette pour les paiements carte/PayPal.

---

## 1. Page `/payment/return` (Thank You Page pour redirections)

Créer `frontend/src/pages/PaymentReturnPage.tsx` :
- Lit les query params : `?ref={reference}&status={success|failed|cancelled}&order_id={id}`
- Interroge `payment_transactions` par référence pour afficher le statut réel
- Souscrit au realtime sur `payment_transactions` pour mise à jour live (si le webhook arrive après la redirection)
- Affiche : confirmation avec n° commande et montant si succès, bouton "Réessayer" si échec, lien vers le dashboard
- Design cohérent avec la page de confirmation existante dans CheckoutPage

Ajouter la route dans `App.tsx` : `<Route path="/payment/return" element={<PaymentReturnPage />} />`

## 2. Refactoring des méthodes de paiement

### Checkout (`CheckoutPage.tsx`)
- Renommer le type `"stripe"` en `"card"` dans `PaymentMethod` (ou garder `"stripe"` comme clé technique interne mais afficher "Carte bancaire via Keccel")
- Supprimer le formulaire carte factice (inputs 4242 disabled, lignes 1070-1088)
- Remplacer par un message : "Vous serez redirigé vers la page de paiement sécurisé Visa/Mastercard"
- Ajouter `"paypal"` comme 5e option avec icône dédiée

### Hook `use-payment-methods.ts`
- Ajouter `paypal: boolean` dans `PaymentMethodsConfig`

### Admin Settings
- Ajouter le toggle PayPal dans la section moyens de paiement

### Dashboard
- Ajouter le label PayPal dans l'affichage des commandes

## 3. Migration SQL — Table `saved_cards` (tokenisation)

```sql
CREATE TABLE public.saved_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'keccel',
  card_token text NOT NULL,
  last_four text NOT NULL,
  card_brand text, -- visa, mastercard
  expiry_month int,
  expiry_year int,
  is_default boolean DEFAULT false,
  label text, -- "Ma Visa ***1234"
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE saved_cards ENABLE ROW LEVEL SECURITY;

-- Users read/manage own cards only
CREATE POLICY "Users read own cards" ON saved_cards FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users insert own cards" ON saved_cards FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own cards" ON saved_cards FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users delete own cards" ON saved_cards FOR DELETE USING (user_id = auth.uid());
```

Note : la tokenisation réelle dépend de Keccel/Mastercard. Cette table prépare le stockage côté notre DB. Les tokens viendront de l'API Keccel une fois la doc reçue.

## 4. Migration SQL — Colonne `payment_method` étendue

Ajouter `paypal` et `card` comme valeurs acceptées dans les commandes :
- `orders.payment_method` est déjà un `text` libre, pas besoin de migration pour les valeurs
- Ajouter `card_token_id` sur `payment_transactions` pour lier à `saved_cards` :

```sql
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS card_token_id uuid REFERENCES saved_cards(id);
```

## 5. Edge Function squelette `keccel-cardpay`

Créer `supabase/functions/keccel-cardpay/index.ts` :
- Reçoit `order_id`, `payment_method` (card/paypal), `save_card` (boolean)
- Vérifie le JWT, vérifie la propriété de la commande
- Construit `return_url` = `{SITE_BASE_URL}/payment/return?order_id={id}`
- Construit `callback_url` = `{SUPABASE_URL}/functions/v1/kelpay-webhook`
- Appelle `https://api.keccel.net/cardpay` (POST, Content-Type: application/json)
- Crée `payment_transaction` avec statut `pending`
- Retourne l'URL de redirection (Mastercard ou PayPal)
- Paramètres API Keccel : à compléter dès réception de la doc (merchant code `jam` en minuscule pour carte)

## 6. Mise à jour du webhook `kelpay-webhook`

Adapter pour gérer aussi les callbacks carte/PayPal :
- Détecter le type de transaction (mobile_money vs card vs paypal) via le payload
- Même logique : update `payment_transactions.status` et `orders.status`

## Fichiers impactés

| Fichier | Action |
|---------|--------|
| `frontend/src/pages/PaymentReturnPage.tsx` | **Créer** — Thank You page |
| `frontend/src/App.tsx` | **Modifier** — ajouter route `/payment/return` |
| `frontend/src/pages/CheckoutPage.tsx` | **Modifier** — ajouter PayPal, supprimer formulaire Stripe factice, message redirection carte |
| `frontend/src/hooks/use-payment-methods.ts` | **Modifier** — ajouter `paypal` |
| `frontend/src/pages/admin/AdminSettingsPage.tsx` | **Modifier** — toggle PayPal |
| `frontend/src/pages/DashboardPage.tsx` | **Modifier** — label PayPal |
| `supabase/functions/keccel-cardpay/index.ts` | **Créer** — squelette edge function |
| `supabase/functions/kelpay-webhook/index.ts` | **Modifier** — support carte/PayPal |
| Migration SQL | **Créer** — table `saved_cards` + colonne `card_token_id` |

## Ce qui reste à obtenir de Keccel

1. **Documentation API `api.keccel.net/cardpay`** — paramètres POST et format réponse
2. **Endpoint PayPal** — même endpoint ou séparé ?
3. **Support `return_url` et `callback_url`** dans l'appel API
4. **Format du callback carte/PayPal** — identique au Mobile Money ?
5. **Credentials carte** — `jam` (minuscule) confirmé ? Même token ?
6. **Tokenisation** — supportent-ils le stockage de token carte pour paiements récurrents ?

## Arguments à envoyer à Keccel

> Nous développons une plateforme e-commerce professionnelle (Zandofy) et souhaitons offrir une expérience de paiement fluide à nos clients, similaire aux standards internationaux (Amazon, Jumia). Voici pourquoi nous préférons l'intégration API directe plutôt que le terminal :
>
> 1. **Expérience utilisateur** : Le client choisit son moyen de paiement une seule fois sur notre site, puis est redirigé directement vers la page sécurisée Mastercard/PayPal. Pas d'étape intermédiaire avec le terminal.
> 2. **Cohérence visuelle** : Notre marque reste visible tout au long du parcours d'achat.
> 3. **Paiements fractionnés** : Un client peut payer la commande par carte et l'expédition par Mobile Money. Cela nécessite des appels API séparés avec des montants différents.
> 4. **Tokenisation** : Pour les clients réguliers, pouvoir enregistrer leur carte (via token) et payer en un clic lors des prochaines commandes.
> 5. **Webhooks** : Nous avons déjà configuré un endpoint webhook sécurisé pour recevoir les confirmations en temps réel.
> 6. **Return URLs** : Pages de retour dédiées (staging + production) pour rediriger le client après paiement.

## Ordre d'implémentation

1. Migration SQL (table `saved_cards` + colonne)
2. Page `/payment/return`
3. Edge function `keccel-cardpay` (squelette)
4. Refactoring checkout (PayPal + carte)
5. Mise à jour webhook
6. Admin settings (toggle PayPal)

