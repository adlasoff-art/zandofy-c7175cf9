

# Plan : Tarification last-mile par commune/quartier — Checkout + Tracking + Admin

## Résumé

Intégrer le calcul automatique des frais de livraison à domicile (last-mile) basé sur la commune et le quartier du client, à deux niveaux : dès le checkout (le client peut payer d'avance) ET au moment du choix différé sur la tracking page (changement d'avis). Ajouter les champs de tarification dans l'interface admin Géographie.

---

## 1. Admin Géographie — Champs tarification commune/quartier

**Fichier** : `AdminGeographyPage.tsx`

- Étendre `CommuneRow` avec `delivery_fee: number`, `is_deliverable: boolean`
- Étendre `QuartierRow` avec `delivery_surcharge: number`
- Ajouter dans le formulaire Communes : champ "Frais livraison ($)" + toggle "Livrable"
- Ajouter dans le formulaire Quartiers : champ "Surcharge ($)"
- Ajouter les colonnes correspondantes dans les tableaux
- Les SELECT et INSERT/UPDATE incluront ces champs (ils existent déjà en DB)

## 2. Utilitaire de calcul last-mile

**Nouveau fichier** : `src/lib/last-mile-fee.ts`

- Fonction `calculateLastMileFee(commune: string, quartier: string, city: string)` :
  - Lookup dans `communes` par nom + ville → récupère `delivery_fee`, `is_deliverable`
  - Lookup dans `quartiers` par nom + `commune_id` → récupère `delivery_surcharge`, `is_restricted`
  - Retourne `{ fee: commune.delivery_fee + quartier.delivery_surcharge, deliverable: boolean, restricted: boolean }`
- Fonction `checkDeliveryAvailability(...)` retourne si la zone est livrable

## 3. Checkout — Calcul et affichage du last-mile fee

**Fichier** : `CheckoutPage.tsx`

État actuel : `lastMileFee = 0` en dur, pas de calcul.

Modifications :
- Quand le client choisit "Livraison à domicile", appeler `calculateLastMileFee()` avec la commune et le quartier de l'adresse sélectionnée
- Afficher le montant estimé sous l'option : "Frais de livraison locale : $X.XX"
- Si la zone n'est pas livrable (`is_deliverable = false` ou quartier restreint), désactiver le bouton avec message "Non disponible dans votre zone"
- Recalculer à chaque changement d'adresse
- Intégrer `lastMileFee` dans le total de la commande (si `deliveryOption === "home_delivery"`)
- Écrire `last_mile_fee` réel dans l'order INSERT (au lieu de 0)
- Ajouter le choix de paiement last-mile : "Payer maintenant" ou "Payer à la réception"
- Si "Payer maintenant" → inclus dans le total ; si "Payer à la réception" → `last_mile_payment_status: "deferred"`

## 4. Tracking Page — Calcul au changement d'avis

**Fichier** : `TrackingPage.tsx` (composant `DeliveryChoicePanel`)

- Quand le client choisit "Livraison à domicile" au stade hub (il avait choisi hub_pickup ou n'avait pas choisi), appeler `calculateLastMileFee()` avec l'adresse de la commande
- Afficher le montant estimé avant confirmation
- Permettre au client de choisir/modifier son adresse de livraison (sélection parmi ses adresses enregistrées)
- Enregistrer le `last_mile_fee` calculé sur la commande

## 5. Récapitulatif checkout — Ligne last-mile visible

Dans le récapitulatif de commande (étape confirmation), ajouter une ligne :
- "Livraison locale : $X.XX" (ou "Gratuit" si hub_pickup, ou "À payer à réception" si déféré)

---

## Fichiers impactés

| Fichier | Modification |
|---------|-------------|
| `AdminGeographyPage.tsx` | Champs `delivery_fee`, `is_deliverable`, `delivery_surcharge` dans formulaires et tableaux |
| `src/lib/last-mile-fee.ts` | Nouveau — utilitaire de calcul commune + quartier |
| `CheckoutPage.tsx` | Calcul dynamique last-mile, intégration dans le total, choix paiement |
| `TrackingPage.tsx` | Calcul last-mile au changement d'avis, sélection adresse |

## Section technique

- Aucune migration SQL requise : les colonnes `communes.delivery_fee`, `communes.is_deliverable`, `quartiers.delivery_surcharge` existent déjà
- Le calcul se fait côté client via des requêtes Supabase simples (lookup par nom de commune/quartier)
- Le `lastMileFee` est recalculé à chaque changement d'adresse ou de `deliveryOption`
- La formule : `total_last_mile = commune.delivery_fee + quartier.delivery_surcharge`
- Rétro-compatibilité : si aucun montant n'est défini (0), la livraison locale reste gratuite

