# Déploiement — preuves de paiement (RLS Storage)

Migration : [`supabase/migrations/20260523120000_payment_proof_storage_rls.sql`](../supabase/migrations/20260523120000_payment_proof_storage_rls.sql)

## Ordre

1. **Staging** — Supabase SQL Editor → coller le fichier migration → Run.
2. Checklist smoke (ci-dessous) sur `studio-staging.zandofy.com`.
3. **Production** — même fichier, fenêtre faible trafic.
4. Aucun redeploy frontend obligatoire pour débloquer l’upload (chemins déjà corrects).

## Checklist smoke staging

- [ ] Client : commande `off_platform` → dashboard → upload JPG preuve → pas d’erreur RLS.
- [ ] Client : aperçu de la preuve visible après upload (URL signée).
- [ ] Vendeur : voit la preuve et peut « Valider le paiement » → statut `pending`.
- [ ] Client : `DeferredPaymentModal` — preuve frais expédition ou last mile.
- [ ] Sécurité : autre utilisateur ne peut pas uploader sur `payment-proofs/{order_id}/...` d’autrui.
- [ ] Non-régression : livreur — upload chemin `{user_id}/...` toujours OK.
- [ ] Vendeur : upload photo hub (`hub-proofs/{order_id}/...`).

## Rollback (si besoin)

```sql
DROP POLICY IF EXISTS "Customers upload payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Customers read own payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Customers update own payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Store team read payment proofs on store orders" ON storage.objects;
DROP POLICY IF EXISTS "Store team upload hub proofs" ON storage.objects;
DROP POLICY IF EXISTS "Store team read hub proofs on store orders" ON storage.objects;
DROP POLICY IF EXISTS "Store team update hub proofs on store orders" ON storage.objects;
DROP POLICY IF EXISTS "Customers read own hub proofs" ON storage.objects;
```

## Monitoring 24h (production)

- Logs Supabase → Storage → erreurs 403 sur bucket `delivery-proofs`.
- Tickets support « preuve paiement » / « row-level security ».

## Sémantique champs `orders` (hors plateforme)

| Contexte | Colonne | Statut typique |
|----------|---------|----------------|
| Preuve paiement **produit** hors plateforme | `shipping_payment_proof_url` | `awaiting_payment` |
| Preuve frais **expédition** | `shipping_payment_proof_url` | `deferred` / après expédition |
| Preuve **last mile** | `last_mile_payment_proof_url` | — |
| Photo **hub** vendeur | `hub_pickup_proof_url` | — |

Voir aussi [`docs/OFF_PLATFORM_PAYMENT.md`](OFF_PLATFORM_PAYMENT.md).
