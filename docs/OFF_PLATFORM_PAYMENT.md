# Paiement hors plateforme (`off_platform`)

## Parcours client

1. Checkout avec mode **Paiement hors plateforme**.
2. Commande créée en statut `awaiting_payment`.
3. Client paie le vendeur hors site (Mobile Money, virement, etc.).
4. Client uploade la preuve depuis **Dashboard** → détail commande.

## Stockage fichier

- Bucket : `delivery-proofs` (privé)
- Chemin : `payment-proofs/{order_id}/{field}-{timestamp}.jpg`
- RLS : migration `20260523120000_payment_proof_storage_rls.sql`

## Colonne base de données (état actuel)

| Situation | Colonne utilisée | Remarque |
|-----------|------------------|----------|
| Preuve paiement **produit** (`awaiting_payment` + `off_platform`) | `shipping_payment_proof_url` | Nom historique ; sémantique = preuve produit tant que la commande n’a pas avancé |
| Preuve frais **expédition** (paiement différé) | `shipping_payment_proof_url` | Après validation produit / hors `awaiting_payment` |
| Preuve **last mile** | `last_mile_payment_proof_url` | — |
| Photo hub (vendeur) | `hub_pickup_proof_url` | Chemin `hub-proofs/{order_id}/...` |

Le vendeur valide la preuve produit depuis `VendorOrderManager` en lisant `shipping_payment_proof_url` puis passe la commande en `pending` avec `shipping_payment_status = paid`.

## Évolution possible (non implémentée)

Colonne dédiée `off_platform_product_proof_url` pour séparer produit et logistique — voir plan vague 4 option B si le reporting l’exige.
